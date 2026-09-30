import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dialog, shell } from 'electron'
import {
  FREE_ATTACHMENT_CAP,
  FREE_ENTRY_CAP,
  LICENSE_FILENAME,
  LICENSE_PUBLIC_KEY,
  LIFETIME_PRICE_USD,
  STRIPE_PAYMENT_LINK_URL
} from '../../shared/constants'
import { LicenseCryptoError, verifyLicense } from '../../shared/license/crypto'
import type { AccountPurchase, LicenseClaims, LicenseEntitlement, LicenseStatus } from '../../shared/types/license'
import { getLicensePath } from '../files/paths'

export class LicenseServiceError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = 'LicenseServiceError'
  }
}

export interface LicenseServiceOptions {
  licensePath?: string
  publicKey?: string
  checkoutUrl?: string
}

export class LicenseService {
  private claims: LicenseClaims | null = null
  private account: { id: string; email: string } | null = null
  private accountConnected = false
  private purchase: AccountPurchase | null = null
  private verificationError: string | null = null
  private generation = 0
  private checkedAt = 0
  private pending: { generation: number; promise: Promise<LicenseStatus> } | null = null
  private purchaseLookup: (() => Promise<AccountPurchase>) | null = null
  private accountCheckout: (() => Promise<string>) | null = null

  connectAccount(lookup: () => Promise<AccountPurchase>, checkout: () => Promise<string>) {
    this.accountConnected = true
    this.purchaseLookup = lookup
    this.accountCheckout = checkout
  }

  setAccount(account: { id: string; email: string } | null) {
    if (this.account?.id === account?.id && this.account?.email === account?.email) return
    this.generation++
    this.account = account
    this.purchase = null
    this.verificationError = null
    this.checkedAt = 0
  }

  async refreshAccount(force = false): Promise<LicenseStatus> {
    if (!this.purchaseLookup || !this.account) return this.getStatus()
    const generation = this.generation, account = this.account
    if (this.pending?.generation === generation) return this.pending.promise
    if (!force && this.checkedAt && Date.now() - this.checkedAt < 30000) return this.getStatus()
    const promise = (async () => {
      try {
        const purchase = await this.purchaseLookup!()
        if (generation !== this.generation) return this.getStatus()
        if (purchase.email.toLowerCase() !== account.email.toLowerCase()) throw new Error('Your account changed. Sign in again to check your purchase.')
        this.purchase = purchase
        this.verificationError = null
        this.checkedAt = Date.now()
      } catch {
        if (generation === this.generation) {
          this.purchase = null
          this.verificationError = 'Unable to verify your purchase. Connect to the internet and check again.'
        }
      }
      return this.getStatus()
    })()
    this.pending = { generation, promise }
    try { return await promise } finally { if (this.pending?.promise === promise) this.pending = null }
  }

  private activeClaims(): LicenseClaims | null {
    if (this.account && this.purchase?.product === 'lifetime' && this.purchase.orderId && this.purchase.issuedAt) {
      return { v: 1, email: this.account.email, product: 'lifetime', seats: 1, orderId: this.purchase.orderId, issuedAt: this.purchase.issuedAt }
    }
    // Previously activated signed licenses still work, but cannot transfer between signed-in accounts.
    if (!this.accountConnected || (this.account && this.claims?.email.toLowerCase() === this.account.email.toLowerCase())) return this.claims
    return null
  }
  private readonly licensePath: string
  private readonly publicKey: string
  private readonly checkoutUrl: string

  constructor(options: LicenseServiceOptions = {}) {
    this.licensePath = options.licensePath ?? getLicensePath()
    this.publicKey = options.publicKey ?? LICENSE_PUBLIC_KEY
    this.checkoutUrl = options.checkoutUrl ?? STRIPE_PAYMENT_LINK_URL
    this.reload()
  }

  reload(): LicenseStatus {
    if (!existsSync(this.licensePath)) {
      this.claims = null
      return this.getStatus()
    }

    try {
      const raw = readFileSync(this.licensePath, 'utf8')
      this.claims = verifyLicense(raw, this.publicKey)
    } catch {
      this.claims = null
    }
    return this.getStatus()
  }

  getStatus(): LicenseStatus {
    const claims = this.activeClaims()
    const entitlement = this.getEntitlement()
    const paid = entitlement !== 'free'
    return {
      source: this.purchase?.product === 'lifetime' ? 'account' : claims ? 'legacy' : 'free',
      verificationError: this.verificationError,
      entitlement,
      activated: paid,
      email: this.account?.email ?? claims?.email ?? null,
      seats: claims?.seats ?? null,
      issuedAt: claims?.issuedAt ?? null,
      orderId: claims?.orderId ?? null,
      entryCap: paid ? null : FREE_ENTRY_CAP,
      attachmentCap: paid ? null : FREE_ATTACHMENT_CAP,
      lifetimePriceUsd: LIFETIME_PRICE_USD
    }
  }

  getEntitlement(): LicenseEntitlement {
    const claims = this.activeClaims()
    if (!claims) return 'free'
    if (claims.product === 'family') return 'family'
    return 'lifetime'
  }

  isPaid(): boolean {
    return this.getEntitlement() !== 'free'
  }

  activateKey(key: string): LicenseStatus {
    let claims: LicenseClaims
    try {
      claims = verifyLicense(key, this.publicKey)
    } catch (error) {
      if (error instanceof LicenseCryptoError) {
        throw new LicenseServiceError(error.message, error.code)
      }
      throw new LicenseServiceError(
        "That file doesn't match Everkeep's publisher key.",
        'INVALID_LICENSE'
      )
    }

    writeFileSync(this.licensePath, key.trim(), 'utf8')
    this.claims = claims
    return this.getStatus()
  }

  activateFile(filePath: string): LicenseStatus {
    if (!existsSync(filePath)) {
      throw new LicenseServiceError('License file was not found.', 'FILE_NOT_FOUND')
    }
    const raw = readFileSync(filePath, 'utf8')
    return this.activateKey(raw)
  }

  async pickAndActivateFile(): Promise<LicenseStatus | null> {
    const result = await dialog.showOpenDialog({
      title: 'Activate Everkeep license',
      properties: ['openFile'],
      filters: [
        { name: 'Everkeep License', extensions: ['ekey', 'txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return this.activateFile(result.filePaths[0])
  }

  deactivate(): LicenseStatus {
    if (existsSync(this.licensePath)) {
      unlinkSync(this.licensePath)
    }
    this.claims = null
    return this.getStatus()
  }

  async openCheckout(): Promise<{ opened: boolean }> {
    let destination = this.checkoutUrl
    if (this.accountConnected) {
      if (!this.account || !this.accountCheckout) throw new LicenseServiceError('Sign in with your email before purchasing Lifetime.', 'EMAIL_REQUIRED')
      const generation = this.generation
      destination = await this.accountCheckout()
      if (generation !== this.generation) throw new LicenseServiceError('Your account changed. Try checkout again.', 'EMAIL_REQUIRED')
    }
    const url = new URL(destination)
    if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com' || url.username || url.password) throw new LicenseServiceError('Checkout is not configured correctly.', 'INVALID_CHECKOUT')
    await shell.openExternal(url.toString())
    return { opened: true }
  }

  getLicenseFileName(): string {
    return LICENSE_FILENAME
  }
}

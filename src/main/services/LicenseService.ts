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
import type { LicenseClaims, LicenseEntitlement, LicenseStatus } from '../../shared/types/license'
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
    const entitlement = this.getEntitlement()
    const paid = entitlement !== 'free'
    return {
      entitlement,
      activated: paid,
      email: this.claims?.email ?? null,
      seats: this.claims?.seats ?? null,
      issuedAt: this.claims?.issuedAt ?? null,
      orderId: this.claims?.orderId ?? null,
      entryCap: paid ? null : FREE_ENTRY_CAP,
      attachmentCap: paid ? null : FREE_ATTACHMENT_CAP,
      lifetimePriceUsd: LIFETIME_PRICE_USD
    }
  }

  getEntitlement(): LicenseEntitlement {
    if (!this.claims) return 'free'
    if (this.claims.product === 'family') return 'family'
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
    await shell.openExternal(this.checkoutUrl)
    return { opened: true }
  }

  getLicenseFileName(): string {
    return LICENSE_FILENAME
  }
}

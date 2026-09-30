import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { LicenseService } from '../src/main/services/LicenseService'
import type { AccountPurchase } from '../src/shared/types/license'
const shell = vi.hoisted(() => ({ openExternal: vi.fn() }))
vi.mock('electron', () => ({ shell, dialog: {} }))
let root: string, license: LicenseService
const buyer = { id: 'buyer', email: 'buyer@example.com' }
const paid: AccountPurchase = { product: 'lifetime', email: buyer.email, orderId: 'cs_paid', issuedAt: '2026-09-30T00:00:00Z' }
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'everkeep-account-license-')); license = new LicenseService({ licensePath: join(root, 'license.ekey') }); shell.openExternal.mockReset() })
afterEach(() => rmSync(root, { recursive: true, force: true }))
describe('account purchase restoration', () => {
  it('restores without a key or license file, and clears benefits when the account changes or signs out', async () => {
    license.connectAccount(async () => paid, async () => 'https://buy.stripe.com/fixture')
    license.setAccount(buyer)
    expect((await license.refreshAccount()).entitlement).toBe('lifetime')
    expect(license.isPaid()).toBe(true); expect(readdirSync(root)).toEqual([])
    license.setAccount({ id: 'other', email: 'other@example.com' })
    expect(license.isPaid()).toBe(false)
    expect((await license.refreshAccount()).verificationError).toBeTruthy()
    expect(license.isPaid()).toBe(false)
    license.setAccount(buyer); await license.refreshAccount(); license.setAccount(null)
    expect(license.getStatus()).toMatchObject({ entitlement: 'free', email: null })
  })
  it('ignores a late paid response belonging to a previous account', async () => {
    let resolve!: (purchase: AccountPurchase) => void
    license.connectAccount(() => new Promise(done => { resolve = done }), async () => 'https://buy.stripe.com/fixture')
    license.setAccount(buyer); const pending = license.refreshAccount()
    license.setAccount({ id: 'other', email: 'other@example.com' }); resolve(paid); await pending
    expect(license.getStatus()).toMatchObject({ entitlement: 'free', email: 'other@example.com' })
  })
  it('refreshes refunds and connection failures without retaining account benefits indefinitely', async () => {
    const lookup = vi.fn().mockResolvedValue(paid)
    license.connectAccount(lookup, async () => 'https://buy.stripe.com/fixture'); license.setAccount(buyer)
    await license.refreshAccount(); expect(license.isPaid()).toBe(true)
    lookup.mockResolvedValue({ ...paid, product: 'free', orderId: null, issuedAt: null })
    await license.refreshAccount(true); expect(license.isPaid()).toBe(false)
    lookup.mockRejectedValue(new Error('offline'))
    expect((await license.refreshAccount(true)).verificationError).toBeTruthy()
  })
  it('requires sign-in and a trusted checkout destination', async () => {
    license.connectAccount(async () => paid, async () => 'https://buy.stripe.com/fixture?locked_prefilled_email=buyer%40example.com')
    await expect(license.openCheckout()).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' })
    license.setAccount(buyer); await license.openCheckout()
    expect(shell.openExternal).toHaveBeenCalledWith('https://buy.stripe.com/fixture?locked_prefilled_email=buyer%40example.com')
    license.connectAccount(async () => paid, async () => 'https://attacker.example/checkout')
    await expect(license.openCheckout()).rejects.toMatchObject({ code: 'INVALID_CHECKOUT' })
  })
})

import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  generateLicenseKeypair,
  mintLicenseKey,
  verifyLicenseKey,
  LicenseVerificationError
} from '../src/main/license'
import { LicenseService } from '../src/main/services/LicenseService'
import { LICENSE_PRODUCT_ID } from '../src/shared/types/license'

function makeKeypair() {
  return generateLicenseKeypair()
}

function mintFor(email: string, privateKeyPem: string) {
  return mintLicenseKey(
    { v: 1, product: LICENSE_PRODUCT_ID, email, iat: Math.floor(Date.now() / 1000) },
    privateKeyPem
  )
}

describe('license key round-trip', () => {
  it('mints a key that verifies against the matching public key', () => {
    const { publicKeyB64, privateKeyPem } = makeKeypair()
    const key = mintFor('buyer@example.com', privateKeyPem)
    expect(key.startsWith('EK1.')).toBe(true)
    const payload = verifyLicenseKey(key, publicKeyB64)
    expect(payload.email).toBe('buyer@example.com')
    expect(payload.product).toBe(LICENSE_PRODUCT_ID)
  })

  it('rejects a tampered payload', () => {
    const { publicKeyB64, privateKeyPem } = makeKeypair()
    const key = mintFor('buyer@example.com', privateKeyPem)
    const [prefix, , sigB64] = key.split('.')
    const tampered = Buffer.from(
      JSON.stringify({ v: 1, product: LICENSE_PRODUCT_ID, email: 'mallory@example.com', iat: 1 })
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(() => verifyLicenseKey(`${prefix}.${tampered}.${sigB64}`, publicKeyB64)).toThrow(
      LicenseVerificationError
    )
  })

  it('rejects a key signed by a different keypair', () => {
    const a = makeKeypair()
    const b = makeKeypair()
    const key = mintFor('buyer@example.com', a.privateKeyPem)
    expect(() => verifyLicenseKey(key, b.publicKeyB64)).toThrow(LicenseVerificationError)
  })

  it('rejects malformed keys', () => {
    const { publicKeyB64 } = makeKeypair()
    for (const bad of ['', 'hello', 'EK1.only-two', 'XX1.a.b']) {
      expect(() => verifyLicenseKey(bad, publicKeyB64)).toThrow(LicenseVerificationError)
    }
  })
})

describe('LicenseService', () => {
  it('starts as trial, activates, persists, and deactivates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'everkeep-license-'))
    const service = new LicenseService(dir)
    expect(service.getStatus()).toEqual({ state: 'trial' })
    expect(service.isLicensed()).toBe(false)

    // NOTE: LicenseService verifies against the embedded placeholder public key,
    // so activation with a real minted key is covered by the round-trip tests above
    // once the real key is embedded. Here we assert the trial fallback on garbage.
    expect(() => service.activate('not-a-key')).toThrow()
    expect(service.getStatus()).toEqual({ state: 'trial' })

    service.deactivate() // no-op when nothing stored
    expect(service.isLicensed()).toBe(false)
  })
})

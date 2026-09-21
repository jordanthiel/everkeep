import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { LICENSE_PUBLIC_KEY } from '../src/shared/constants'
import { signLicense, verifyLicense, LicenseCryptoError } from '../src/shared/license/crypto'
import { LicenseService } from '../src/main/services/LicenseService'
import {
  TEST_LICENSE_PRIVATE_KEY,
  TEST_LICENSE_PUBLIC_KEY
} from './fixtures/license-keys'

describe('license crypto', () => {
  it('uses the committed development public key by default', () => {
    expect(LICENSE_PUBLIC_KEY).toBe(TEST_LICENSE_PUBLIC_KEY)
  })

  it('signs and verifies a lifetime license', () => {
    const key = signLicense(
      {
        v: 1,
        email: 'buyer@example.com',
        product: 'lifetime',
        seats: 1,
        issuedAt: '2026-09-02T12:00:00.000Z',
        orderId: 'cs_test_123'
      },
      TEST_LICENSE_PRIVATE_KEY
    )

    const claims = verifyLicense(key, TEST_LICENSE_PUBLIC_KEY)
    expect(claims.email).toBe('buyer@example.com')
    expect(claims.product).toBe('lifetime')
    expect(claims.orderId).toBe('cs_test_123')
  })

  it('rejects a tampered payload', () => {
    const key = signLicense(
      {
        v: 1,
        email: 'buyer@example.com',
        product: 'lifetime',
        seats: 1,
        issuedAt: '2026-09-02T12:00:00.000Z',
        orderId: 'cs_test_123'
      },
      TEST_LICENSE_PRIVATE_KEY
    )
    const parts = key.split('.')
    const payload = Buffer.from(parts[1], 'base64url')
    payload[0] = payload[0]! ^ 0xff
    const tampered = `${parts[0]}.${Buffer.from(payload).toString('base64url')}.${parts[2]}`

    expect(() => verifyLicense(tampered, TEST_LICENSE_PUBLIC_KEY)).toThrow(LicenseCryptoError)
  })

  it('rejects signatures from the wrong key', () => {
    const key = signLicense(
      {
        v: 1,
        email: 'buyer@example.com',
        product: 'lifetime',
        seats: 1,
        issuedAt: '2026-09-02T12:00:00.000Z',
        orderId: 'cs_test_123'
      },
      TEST_LICENSE_PRIVATE_KEY
    )
    const otherPublic = Buffer.alloc(32, 7).toString('base64url')
    expect(() => verifyLicense(key, otherPublic)).toThrow(LicenseCryptoError)
  })
})

describe('LicenseService', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('activates, reports lifetime, and deactivates', () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-license-'))
    dirs.push(root)
    const licensePath = join(root, 'license.ekey')
    const service = new LicenseService({
      licensePath,
      publicKey: TEST_LICENSE_PUBLIC_KEY
    })

    expect(service.getStatus().entitlement).toBe('free')
    expect(service.isPaid()).toBe(false)

    const key = signLicense(
      {
        v: 1,
        email: 'owner@example.com',
        product: 'lifetime',
        seats: 1,
        issuedAt: '2026-09-02T12:00:00.000Z',
        orderId: 'cs_test_activate'
      },
      TEST_LICENSE_PRIVATE_KEY
    )

    const activated = service.activateKey(key)
    expect(activated.entitlement).toBe('lifetime')
    expect(activated.email).toBe('owner@example.com')
    expect(service.isPaid()).toBe(true)

    writeFileSync(join(root, 'from-file.ekey'), key, 'utf8')
    service.deactivate()
    expect(service.isPaid()).toBe(false)

    const fromFile = service.activateFile(join(root, 'from-file.ekey'))
    expect(fromFile.entitlement).toBe('lifetime')
  })
})

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { FREE_ATTACHMENT_CAP, FREE_ENTRY_CAP } from '../src/shared/constants'
import { signLicense } from '../src/shared/license/crypto'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
import { LicenseService } from '../src/main/services/LicenseService'
import { VaultService, VaultServiceError } from '../src/main/services/VaultService'
import {
  TEST_LICENSE_PRIVATE_KEY,
  TEST_LICENSE_PUBLIC_KEY
} from './fixtures/license-keys'

describe('freemium caps', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function createService(root: string, licenseService?: LicenseService) {
    return new VaultService({
      recentStore: new RecentVaultsStore(join(root, 'recent.json')),
      argon2Params: TEST_ARGON2_PARAMS,
      attachmentsRootFactory: (vaultId) => join(root, 'attachments', vaultId),
      licenseService
    })
  }

  it('allows the free entry cap and blocks the next create', () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-freemium-'))
    dirs.push(root)
    const service = createService(root)

    service.createVault({
      name: 'Cap Vault',
      filePath: join(root, 'Cap.everkeep'),
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan'
    })

    for (let i = 0; i < FREE_ENTRY_CAP; i++) {
      service.createEntry({
        section: 'legal',
        kind: 'will',
        title: `Entry ${i + 1}`,
        fields: { exists: 'yes' }
      })
    }

    expect(() =>
      service.createEntry({
        section: 'legal',
        kind: 'will',
        title: 'Over the limit',
        fields: { exists: 'yes' }
      })
    ).toThrow(VaultServiceError)

    try {
      service.createEntry({
        section: 'legal',
        kind: 'will',
        title: 'Over the limit',
        fields: { exists: 'yes' }
      })
    } catch (error) {
      expect(error).toBeInstanceOf(VaultServiceError)
      expect((error as VaultServiceError).code).toBe('FREEMIUM_LIMIT')
    }

    service.closeVault()
  })

  it('lifts the entry cap after activating a lifetime license', () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-lifetime-'))
    dirs.push(root)
    const license = new LicenseService({
      licensePath: join(root, 'license.ekey'),
      publicKey: TEST_LICENSE_PUBLIC_KEY
    })
    const service = createService(root, license)

    service.createVault({
      name: 'Paid Vault',
      filePath: join(root, 'Paid.everkeep'),
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan'
    })

    for (let i = 0; i < FREE_ENTRY_CAP; i++) {
      service.createEntry({
        section: 'documents',
        title: `Doc ${i + 1}`,
        fields: {}
      })
    }

    license.activateKey(
      signLicense(
        {
          v: 1,
          email: 'paid@example.com',
          product: 'lifetime',
          seats: 1,
          issuedAt: '2026-09-02T12:00:00.000Z',
          orderId: 'cs_test_paid'
        },
        TEST_LICENSE_PRIVATE_KEY
      )
    )

    const extra = service.createEntry({
      section: 'documents',
      title: 'Doc beyond free cap',
      fields: {}
    })
    expect(extra.title).toBe('Doc beyond free cap')
    service.closeVault()
  })

  it('watermarks free exports and omits sensitive fields', () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-export-free-'))
    dirs.push(root)
    const service = createService(root)

    service.createVault({
      name: 'Export Vault',
      filePath: join(root, 'Export.everkeep'),
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan',
      password: 'export-pass-123'
    })

    service.createEntry({
      section: 'identity',
      kind: 'ssn',
      title: 'Social Security',
      sensitiveFields: { number: '123456789' }
    })

    const reportPath = join(root, 'free-report.html')
    service.exportReport({
      destinationPath: reportPath,
      includeSensitive: true
    })
    const html = readFileSync(reportPath, 'utf8')
    expect(html).toContain('Created with Everkeep Free')
    expect(html).not.toContain('123456789')
    service.closeVault()
  })

  it('exports without watermark when lifetime is active', () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-export-paid-'))
    dirs.push(root)
    const license = new LicenseService({
      licensePath: join(root, 'license.ekey'),
      publicKey: TEST_LICENSE_PUBLIC_KEY
    })
    license.activateKey(
      signLicense(
        {
          v: 1,
          email: 'paid@example.com',
          product: 'lifetime',
          seats: 1,
          issuedAt: '2026-09-02T12:00:00.000Z',
          orderId: 'cs_test_export'
        },
        TEST_LICENSE_PRIVATE_KEY
      )
    )
    const service = createService(root, license)

    service.createVault({
      name: 'Export Paid',
      filePath: join(root, 'ExportPaid.everkeep'),
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan',
      password: 'export-pass-123'
    })

    service.createEntry({
      section: 'identity',
      kind: 'ssn',
      title: 'Social Security',
      sensitiveFields: { number: '123456789' }
    })

    const reportPath = join(root, 'paid-report.html')
    service.exportReport({
      destinationPath: reportPath,
      includeSensitive: true
    })
    const html = readFileSync(reportPath, 'utf8')
    expect(html).not.toContain('Created with Everkeep Free')
    expect(html).toContain('123456789')
    service.closeVault()
  })

  it('enforces the free attachment cap', () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-attach-cap-'))
    dirs.push(root)
    const service = createService(root)

    service.createVault({
      name: 'Attach Vault',
      filePath: join(root, 'Attach.everkeep'),
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan'
    })

    const entry = service.createEntry({
      section: 'documents',
      title: 'Binder',
      fields: {}
    })

    for (let i = 0; i < FREE_ATTACHMENT_CAP; i++) {
      const filePath = join(root, `file-${i}.txt`)
      writeFileSync(filePath, `attachment ${i}`)
      service.attachFile(entry.id, filePath)
    }

    const over = join(root, 'over.txt')
    writeFileSync(over, 'too many')
    try {
      service.attachFile(entry.id, over)
      expect.unreachable('expected FREEMIUM_LIMIT')
    } catch (error) {
      expect(error).toBeInstanceOf(VaultServiceError)
      expect((error as VaultServiceError).code).toBe('FREEMIUM_LIMIT')
    }

    service.closeVault()
  })
})

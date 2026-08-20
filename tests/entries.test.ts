import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
import { VaultService } from '../src/main/services/VaultService'
import {
  buildEntryTitle,
  getSectionDefinition,
  getVisibleFields
} from '../src/shared/sections/definitions'

describe('vault entries across sections', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('creates, reviews, and archives entries; exports a report', () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-entries-'))
    dirs.push(root)
    const service = new VaultService({
      recentStore: new RecentVaultsStore(join(root, 'recent.json')),
      argon2Params: TEST_ARGON2_PARAMS
    })

    service.createVault({
      name: 'Full Vault',
      filePath: join(root, 'Full.everkeep'),
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan',
      password: 'section-pass-123'
    })

    const legal = service.createEntry({
      section: 'legal',
      kind: 'will',
      title: 'Last Will',
      fields: { exists: 'yes', executorOrAgent: 'Taylor Morgan' },
      locationText: 'Home safe'
    })
    expect(legal.section).toBe('legal')

    const identity = service.createEntry({
      section: 'identity',
      kind: 'ssn',
      title: 'Social Security',
      sensitiveFields: { number: '123456789' }
    })
    expect(identity.sensitiveFields.number).toBe('123456789')

        service.markEntryReviewed(legal.id)
    const review = service.listReviewItems()
    expect(review.some((item) => item.title === 'Social Security')).toBe(true)

    const updatedIdentity = service.updateEntry({
      id: identity.id,
      title: 'Social Security — Alex Morgan',
      sensitiveFields: { number: '987654321' }
    })
    expect(updatedIdentity.title).toBe('Social Security — Alex Morgan')
    expect(updatedIdentity.sensitiveFields.number).toBe('987654321')

    const reportPath = join(root, 'report.html')
    const exported = service.exportReport({
      destinationPath: reportPath,
      includeSensitive: false
    })
    expect(exported.path).toBe(reportPath)
    const html = readFileSync(reportPath, 'utf8')
    expect(html).toContain('Last Will')
    expect(html).not.toContain('123456789')

    service.archiveEntry(identity.id)
    expect(service.listEntries('identity')).toHaveLength(0)

    service.closeVault()
    service.openVault({ filePath: join(root, 'Full.everkeep'), password: 'section-pass-123' })
    expect(service.listEntries('legal')[0]?.title).toBe('Last Will')
    service.closeVault()
  })

  it('recovers legacy password-flagged vaults without crypto material', () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-legacy-'))
    dirs.push(root)
    const vaultPath = join(root, 'Legacy.everkeep')
    const service = new VaultService({
      recentStore: new RecentVaultsStore(join(root, 'recent.json')),
      argon2Params: TEST_ARGON2_PARAMS
    })

    // Simulate old behavior: protected flag without verifier/salt.
    service.createVault({
      name: 'Legacy',
      filePath: vaultPath,
      ownerFirstName: 'Sam',
      ownerLastName: 'Morgan'
    })
    const db = service.getDatabaseForTests()
    db?.prepare(
      `UPDATE vault_metadata SET
        is_password_protected = 1,
        password_verifier = NULL,
        encryption_salt = NULL,
        encryption_params = NULL`
    ).run()
    service.closeVault()

    const opened = service.openVault({ filePath: vaultPath })
    expect(opened.metadata.isPasswordProtected).toBe(false)
    expect(service.listPeople().length).toBeGreaterThan(0)

    const protectedSession = service.enablePassword('new-real-password')
    expect(protectedSession.metadata.isPasswordProtected).toBe(true)
    service.closeVault()

    expect(() => service.openVault({ filePath: vaultPath })).toThrow(/password protected/i)
    service.openVault({ filePath: vaultPath, password: 'new-real-password' })
    service.closeVault()
  })
})

describe('identity field layout', () => {
  it('shows document fields without repeating legal name', () => {
    const def = getSectionDefinition('identity')
    expect(getVisibleFields(def, 'passport').map((field) => field.key)).toEqual([
      'personId',
      'number',
      'issued',
      'expires',
      'issuingAuthority'
    ])
    expect(getVisibleFields(def, 'legal_name').map((field) => field.key)).toEqual([
      'personId',
      'fullLegalName',
      'previousNames',
      'dateOfBirth',
      'placeOfBirth'
    ])
    expect(
      buildEntryTitle({
        def,
        kind: 'passport',
        title: '',
        fields: {},
        personName: 'Jane Smith'
      })
    ).toBe('Passport — Jane Smith')
  })
})

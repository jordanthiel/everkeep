import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
import { VaultService } from '../src/main/services/VaultService'

describe('Everkeep vault persistence', () => {
  const dirs: string[] = []

  function tempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix))
    dirs.push(dir)
    return dir
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('creates a vault, writes a person, closes, reopens, and retains the record', () => {
    const root = tempDir('everkeep-vault-')
    const vaultPath = join(root, 'Thiel-Family.everkeep')
    const recentPath = join(root, 'recent-vaults.json')
    const recoveryDir = join(root, 'recovery')

    const service = new VaultService({
      recentStore: new RecentVaultsStore(recentPath),
      recoveryDirectory: recoveryDir,
      argon2Params: TEST_ARGON2_PARAMS
    })

    const created = service.createVault({
      name: 'Thiel Family',
      filePath: vaultPath,
      householdName: 'Thiel Family',
      ownerFirstName: 'Jordan',
      ownerLastName: 'Thiel'
    })

    expect(created.filePath).toBe(vaultPath)
    expect(created.metadata.name).toBe('Thiel Family')
    expect(created.metadata.schemaVersion).toBe(8)
    expect(created.metadata.isPasswordProtected).toBe(false)

    const person = service.createPerson({
      fullName: 'Alex Morgan',
      relationship: 'spouse',
      roles: ['emergency_contact']
    })

    expect(person.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(person.fullName).toBe('Alex Morgan')
    expect(person.roles).toContain('emergency_contact')

    const listedBeforeClose = service.listPeople()
    expect(listedBeforeClose.map((p) => p.fullName)).toEqual(
      expect.arrayContaining(['Jordan Thiel', 'Alex Morgan'])
    )

    service.closeVault()
    expect(service.getStatus().isOpen).toBe(false)

    const reopened = service.openVault({ filePath: vaultPath })
    expect(reopened.metadata.householdName).toBe('Thiel Family')

    const people = service.listPeople()
    const owner = people.find((p) => p.fullName === 'Jordan Thiel')
    const alex = people.find((p) => p.fullName === 'Alex Morgan')
    expect(owner?.relationship).toBe('self')
    expect(alex?.relationship).toBe('spouse')
    expect(alex?.roles).toEqual(['emergency_contact'])

    const recent = service.getRecent()
    expect(recent[0]?.filePath).toBe(vaultPath)

    service.closeVault()
  })

  it('supports backup archive and restore into a new vault file', async () => {
    const root = tempDir('everkeep-backup-')
    const vaultPath = join(root, 'My-Family.everkeep')
    const backupPath = join(root, 'My-Family-backup.everkeep-backup')
    const restoredPath = join(root, 'My-Family-restored.everkeep')

    const service = new VaultService({
      recentStore: new RecentVaultsStore(join(root, 'recent.json')),
      argon2Params: TEST_ARGON2_PARAMS,
      attachmentsRootFactory: (vaultId) => join(root, 'attachments', vaultId)
    })

    service.createVault({
      name: 'My Family',
      filePath: vaultPath,
      ownerFirstName: 'Sam',
      ownerLastName: 'Morgan'
    })

    service.createPerson({
      fullName: 'Jamie Morgan',
      relationship: 'child'
    })

    const backup = await service.backup({ destinationPath: backupPath })
    expect(backup.backupPath).toBe(backupPath)

    service.closeVault()

    const restored = await service.restoreBackup({
      backupPath,
      destinationPath: restoredPath
    })
    expect(restored.metadata.name).toBe('My Family')
    expect(service.listPeople().map((p) => p.fullName)).toEqual(
      expect.arrayContaining(['Sam Morgan', 'Jamie Morgan'])
    )

    service.closeVault()
  })

  it('requires a password when the vault is marked password-protected', () => {
    const root = tempDir('everkeep-password-')
    const vaultPath = join(root, 'Protected.everkeep')

    const service = new VaultService({
      recentStore: new RecentVaultsStore(join(root, 'recent.json')),
      argon2Params: TEST_ARGON2_PARAMS
    })

    service.createVault({
      name: 'Protected',
      filePath: vaultPath,
      password: 'correct-horse-battery'
    })

    expect(service.getStatus().session?.metadata.isPasswordProtected).toBe(true)
    service.closeVault()

    expect(() => service.openVault({ filePath: vaultPath })).toThrow(/password protected/i)

    const opened = service.openVault({
      filePath: vaultPath,
      password: 'correct-horse-battery'
    })
    expect(opened.metadata.isPasswordProtected).toBe(true)
    service.closeVault()
  })

  it('updates a person and persists the change across reopen', () => {
    const root = tempDir('everkeep-update-')
    const vaultPath = join(root, 'Update.everkeep')

    const service = new VaultService({
      recentStore: new RecentVaultsStore(join(root, 'recent.json')),
      argon2Params: TEST_ARGON2_PARAMS
    })

    service.createVault({ name: 'Update', filePath: vaultPath })
    const person = service.createPerson({ fullName: 'Taylor Morgan', relationship: 'partner' })

    service.updatePerson({
      id: person.id,
      phone: '555-0100',
      roles: ['executor', 'healthcare_proxy']
    })

    service.closeVault()
    service.openVault({ filePath: vaultPath })

    const updated = service.getPerson(person.id)
    expect(updated?.phone).toBe('555-0100')
    expect(updated?.roles).toEqual(['executor', 'healthcare_proxy'])

    service.closeVault()
  })
})

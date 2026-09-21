import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { VaultService } from '../src/main/services/VaultService'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
import { FREE_ENTRY_CAP } from '../src/shared/constants'

const fixtures: Array<{root: string; service: VaultService}> = []
function fixture(protectedVault = true) {
  const root = mkdtempSync(join(tmpdir(), 'everkeep-logins-'))
  const service = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), argon2Params: TEST_ARGON2_PARAMS, attachmentsRootFactory: id => join(root, id) })
  const filePath = join(root, 'test.everkeep')
  service.createVault({ name: 'Login test', filePath, ...(protectedVault ? { password: 'vault-password' } : {}) })
  fixtures.push({ root, service })
  return { service, root, filePath }
}
afterEach(() => fixtures.splice(0).forEach(({ service, root }) => { service.closeVault(); rmSync(root, { recursive: true, force: true }) }))
const login = { provider: 'Allstate', username: 'fixture@example.test', website: 'https://example.test/login', password: 'UNIQUE-LOGIN-SECRET', instructions: 'Codes arrive on my phone' }

it('creates one canonical login, links both directions, and synchronizes edits without losing recovery details', () => {
  const { service, filePath } = fixture()
  const policy = service.createEntry({ section: 'insurance', title: 'Car policy', fields: { carrier: 'Allstate' }, login })
  const digital = service.listEntries('digital')[0]
  expect(policy.login?.id).toBe(digital.id)
  expect(digital.linkedRecords).toEqual([expect.objectContaining({ id: policy.id, path: `/insurance?edit=${policy.id}`, archived: false })])
  service.updateEntry({ id: digital.id, fields: { ...digital.fields, recoveryLocation: 'Safe' } })
  service.updateEntry({ id: policy.id, login: { ...policy.login!, username: 'updated@example.test' } })
  expect(service.listEntries('digital')).toHaveLength(1)
  expect(service.listEntries('digital')[0].fields).toMatchObject({ accountIdentifier: 'updated@example.test', recoveryLocation: 'Safe' })
  service.updateEntry({ id: digital.id, sensitiveFields: { password: 'REPLACED-SECRET' } })
  expect(service.listEntries('insurance')[0].login?.password).toBe('REPLACED-SECRET')
  expect(readFileSync(filePath).includes(Buffer.from('REPLACED-SECRET'))).toBe(false)
})

it('reuses a login across records and accounts, unlinks without deletion, and retains archived references', () => {
  const { service } = fixture()
  const policy = service.createEntry({ section: 'insurance', title: 'Car policy', login })
  const account = service.createAccount({ institution: 'Allstate', accountType: 'annuity', login: policy.login! })
  expect(service.listEntries('digital')).toHaveLength(1)
  expect(service.listEntries('digital')[0].linkedRecords).toHaveLength(2)
  expect(service.listEntries('digital')[0].linkedRecords).toContainEqual(expect.objectContaining({ path: `/financial?edit=${account.id}` }))
  service.updateAccount({ id: account.id, notes: 'Retain link' })
  expect(service.listAccounts()[0].login?.id).toBe(policy.login?.id)
  service.updateAccount({ id: account.id, login: null })
  expect(service.listAccounts()[0].login).toBeNull()
  expect(service.listEntries('digital')).toHaveLength(1)
  service.archiveEntry(policy.id)
  expect(service.listEntries('digital')[0].linkedRecords?.[0].archived).toBe(true)
  service.updateAccount({ id: account.id, login: policy.login! })
  service.archiveEntry(policy.login!.id!)
  expect(service.listAccounts()[0].login).toBeNull()
})

it('rejects unprotected passwords and invalid links without partially saving the parent', () => {
  const { service } = fixture(false)
  expect(() => service.createEntry({ section: 'insurance', title: 'Car policy', login })).toThrow(/password protection/i)
  expect(service.listEntries('insurance')).toHaveLength(0)
  expect(() => service.createAccount({ institution: 'Allstate', accountType: 'annuity', login })).toThrow(/password protection/i)
  expect(service.listAccounts()).toHaveLength(0)
  expect(() => service.createEntry({ section: 'digital', title: 'Login', sensitiveFields: { password: login.password } })).toThrow(/password protection/i)
  const policy = service.createEntry({ section: 'insurance', title: 'Car policy', login: { ...login, password: '' } })
  expect(policy.login?.username).toBe(login.username)
  expect(() => service.updateEntry({ id: policy.id, title: 'Do not save this', login: { ...login, password: '', id: policy.id } })).toThrow(/no longer available/)
  expect(service.listEntries('insurance')[0].title).toBe('Car policy')
})

it('rolls back the record if there is no capacity for its new login', () => {
  const { service } = fixture()
  for (let i = 0; i < FREE_ENTRY_CAP - 1; i++) service.createEntry({ section: 'legal', title: `Document ${i}` })
  expect(() => service.createEntry({ section: 'insurance', title: 'Car policy', login })).toThrow()
  expect(service.listEntries('insurance')).toHaveLength(0)
  expect(service.listEntries('digital')).toHaveLength(0)
  service.createEntry({ section: 'insurance', title: 'Without login' })
})

it('keeps credentials and links through lock, rotation, backup and restore; excludes passwords from ordinary exports', async () => {
  const { service, root, filePath } = fixture()
  const policy = service.createEntry({ section: 'insurance', title: 'Car policy', login })
  const parentPreview = service.previewReport({ selection: { people: [], accounts: [], entries: [policy.id] } }).html
  expect(parentPreview).not.toContain(login.password)
  expect(parentPreview).not.toContain(login.username)
  expect(service.previewReport({ selection: { people: [], accounts: [], entries: [policy.login!.id!] } }).html).not.toContain(login.password)
  const backup = await service.backup({ destinationPath: join(root, 'copy.everkeep-backup') })
  service.lockVault(); service.unlockVault('vault-password')
  expect(service.listEntries('insurance')[0].login?.password).toBe(login.password)
  service.rotatePassword('vault-password', 'new-vault-password')
  service.closeVault(); service.openVault({ filePath, password: 'new-vault-password' })
  expect(service.listEntries('insurance')[0].login?.password).toBe(login.password)
  await service.restoreBackup({ backupPath: backup.backupPath, destinationPath: join(root, 'restored.everkeep'), password: 'vault-password' })
  expect(service.listEntries('insurance')[0].login?.password).toBe(login.password)
  expect(service.listEntries('digital')[0].linkedRecords?.[0].id).toBe(policy.id)
})

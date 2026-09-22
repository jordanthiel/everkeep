import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { VaultService } from '../src/main/services/VaultService'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).reverse().forEach(fn => fn()))
function setup(password?: string) {
  const root = mkdtempSync(join(tmpdir(), 'sharing-vault-'))
  cleanups.push(() => rmSync(root, { recursive: true, force: true }))
  const service = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), argon2Params: TEST_ARGON2_PARAMS, attachmentsRootFactory: id => join(root, id) })
  cleanups.push(() => service.closeVault())
  const path = join(root, 'original.everkeep'); service.createVault({ name: 'Shared subject', filePath: path, password }); return { service, root, path }
}
describe('local shared vault persistence', () => {
  it('applies valid edits transactionally and preserves linked relationships and sensitive fields', () => {
    const { service } = setup('test-password')
    const person = service.createPerson({ fullName: 'Owner subject', roles: ['executor'] })
    const account = service.createAccount({ institution: 'Bank', accountType: 'checking', fullAccountNumber: '123456789', ownerPersonIds: [person.id] })
    const data = service.getSharingSnapshot(); data.records.find(record => record.id === person.id)!.fields.phone.value = '555-1212'; data.records.find(record => record.id === account.id)!.fields.notes.value = 'New bank note'
    service.applySharingSnapshot(data)
    expect(service.listPeople()[0]).toMatchObject({ phone: '555-1212', roles: ['executor'] }); expect(service.listAccounts()[0]).toMatchObject({ notes: 'New bank note', fullAccountNumber: '123456789', ownerPersonIds: [person.id] })
    const invalid = service.getSharingSnapshot(); invalid.records.find(record => record.id === person.id)!.fields.phone.value = 'Should roll back'; invalid.records.find(record => record.id === account.id)!.fields.accountType.value = 'bad-type'
    expect(() => service.applySharingSnapshot(invalid)).toThrow(); expect(service.listPeople()[0].phone).toBe('555-1212')
  })
  it('restores a locally archived record when the owner explicitly keeps the shared version', () => {
    const { service } = setup()
    const entry = service.createEntry({ section: 'documents', title: 'Keep online edit', notes: 'Original' })
    const selected = service.getSharingSnapshot()
    selected.records.find(record => record.id === entry.id)!.fields._notes.value = 'Updated remotely'
    service.archiveEntry(entry.id)
    service.applySharingSnapshot(selected)
    expect(service.listEntries('documents')[0].notes).toBe('Updated remotely')
  })
  it('preserves encrypted sharing metadata across lock, restart and a file copy without switching the active file', async () => {
    const { service, path, root } = setup('test-password')
    service.createPerson({ fullName: 'Private identity' })
    const link = { storage: 'file' as const, ownerEmail: 'owner@example.com', serviceUrl: 'https://share.example.com', remoteId: randomUUID(), ownerId: randomUUID(), revision: 3, base: service.getSharingSnapshot(), lastSyncedAt: new Date().toISOString() }
    service.saveSharingLink(link); expect(readFileSync(path).includes(Buffer.from('Private identity'))).toBe(false)
    service.lockVault(); service.unlockVault('test-password'); expect(service.getSharingLink()).toEqual(link)
    expect(() => service.verifySharingPassword('wrong')).toThrow(); expect(() => service.verifySharingPassword('test-password')).not.toThrow()
    const copy = join(root, 'copy.everkeep'); await service.savePortableCopy(copy); expect(service.getStatus().session?.filePath).toBe(path)
    service.closeVault(); service.openVault({ filePath: copy, password: 'test-password' }); expect(service.getSharingLink()).toEqual(link)
    service.closeVault(); service.createVault({ name: 'Different vault', filePath: join(root, 'different.everkeep') }); expect(service.getSharingLink()).toBeNull()
  })
  it('embeds attachments in an unprotected saved file so it opens without the original folder', async () => {
    const { service, root } = setup(); const record = service.createEntry({ section: 'documents', title: 'Directions' })
    const source = join(root, 'source.txt'); writeFileSync(source, 'Portable attachment')
    const attached = service.attachFile(record.id, source)
    const copy = join(root, 'portable.everkeep'); await service.savePortableCopy(copy)
    const attachmentRoot = join(root, service.getStatus().session!.metadata.id)
    service.closeVault(); rmSync(source); rmSync(attachmentRoot, { recursive: true, force: true })
    service.openVault({ filePath: copy }); expect(service.getSharingAttachment(attached.id).toString()).toBe('Portable attachment')
  })
})

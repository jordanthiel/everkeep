import { afterEach, describe, expect, it } from 'vitest'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { VaultService } from '../src/main/services/VaultService'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { EncryptionService, TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
import { decodeProtectedFile } from '../src/main/security/ProtectedVaultFile'
import { openMemoryDatabase, closeDatabase } from '../src/main/database/connection'
import { EMPTY_HANDOFF } from '../src/shared/types/handoff'
import { accountToForm } from '../src/shared/accountForm'
import { presetSelection } from '../src/shared/sections/exportPresets'

const roots: string[] = []
afterEach(() => { roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })) })
function fixture(password?: string) {
  const root = mkdtempSync(join(tmpdir(), 'everkeep-family-')); roots.push(root)
  const filePath = join(root, 'plan.everkeep')
  const service = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), argon2Params: TEST_ARGON2_PARAMS, attachmentsRootFactory: (id) => join(root, 'attachments', id) })
  service.createVault({ name: 'Family fixture', filePath, password })
  return { service, root, filePath }
}

describe('protected family handoff', () => {
  it('encrypts ordinary records and attachments, persists immediately, and releases the database on lock', async () => {
    const { service, root, filePath } = fixture('old-password')
    const contact = service.createPerson({ fullName: 'SECRET CONTACT 473', phone: 'SECRET PHONE 913' })
    service.updateHandoff({ ...EMPTY_HANDOFF, primaryContactId: contact.id, careInstructions: 'SECRET CARE 272', passwordInstructions: 'SECRET ACCESS 289' })
    const entry = service.createEntry({ section: 'documents', title: 'SECRET DOCUMENT 651', notes: 'SECRET NOTE 834', sensitiveFields: { id: 'SECRET ID 728' } })
    const source = join(root, 'sensitive-letter.txt'); writeFileSync(source, 'SECRET FILE CONTENT 293')
    const attachment = service.attachFile(entry.id, source)
    const disk = readFileSync(filePath, 'utf8')
    for (const secret of ['SECRET CONTACT', 'SECRET PHONE', 'SECRET CARE', 'SECRET ACCESS', 'SECRET DOCUMENT', 'SECRET NOTE', 'SECRET ID', 'SECRET FILE CONTENT', 'sensitive-letter.txt']) expect(disk).not.toContain(secret)
    expect(existsSync(`${filePath}-wal`)).toBe(false)
    expect(existsSync(join(root, 'attachments'))).toBe(false)
    const snapshot = join(root, 'snapshot.everkeep'); copyFileSync(filePath, snapshot)
    const decoded = decodeProtectedFile(readFileSync(snapshot), 'old-password')
    const db = openMemoryDatabase(decoded.bytes)
    expect((db.prepare('SELECT content FROM attachment_contents WHERE attachment_id = ?').get(attachment.id) as { content: Buffer }).content.toString()).toBe('SECRET FILE CONTENT 293')
    closeDatabase(db); decoded.bytes.fill(0); new EncryptionService().clearKey(decoded.key)
    const backup = await service.backup({ destinationPath: join(root, 'copy.everkeep-backup') })
    const zip = await JSZip.loadAsync(readFileSync(backup.backupPath))
    expect(Object.keys(zip.files)).toEqual(['vault.everkeep'])
    expect((await service.verifyBackup({ backupPath: backup.backupPath, password: 'old-password' })).attachmentCount).toBe(1)
    service.lockVault()
    expect(service.getDatabaseForTests()).toBeNull()
    expect(() => service.getHandoff()).toThrow(/locked/i)
    expect(() => service.unlockVault('wrong')).toThrow(/incorrect/i)
    expect(service.getStatus().session?.isLocked).toBe(true)
    service.unlockVault('old-password')
    expect(service.getHandoff().careInstructions).toBe('SECRET CARE 272')
    service.rotatePassword('old-password', 'new-password')
    service.closeVault()
    expect(() => service.openVault({ filePath, password: 'old-password' })).toThrow(/incorrect/i)
    service.openVault({ filePath, password: 'new-password' })
    expect(service.listEntries('documents')[0].sensitiveFields.id).toBe('SECRET ID 728')
    expect(service.listAttachments(entry.id)).toHaveLength(1)
    await service.restoreBackup({ backupPath: backup.backupPath, destinationPath: join(root, 'restored.everkeep'), password: 'old-password' })
    expect(service.listAttachments(entry.id)).toHaveLength(1)
    expect(service.getHandoff().careInstructions).toBe('SECRET CARE 272')
    service.closeVault()
  })

  it('migrates an unprotected vault and its files without losing ordinary or sensitive values', () => {
    const { service, root, filePath } = fixture()
    const entry = service.createEntry({ section: 'documents', title: 'Migration fixture', sensitiveFields: { id: '12345678' } })
    const source = join(root, 'original.txt'); writeFileSync(source, 'MIGRATION CONTENT')
    const attachment = service.attachFile(entry.id, source)
    const oldPath = (service.getDatabaseForTests()!.prepare('SELECT storage_path FROM attachments WHERE id = ?').get(attachment.id) as { storage_path: string }).storage_path
    expect(existsSync(oldPath)).toBe(true)
    service.enablePassword('new-password')
    expect(existsSync(oldPath)).toBe(false)
    expect(existsSync(source)).toBe(true)
    expect(readFileSync(filePath, 'utf8')).not.toContain('Migration fixture')
    service.closeVault(); service.openVault({ filePath, password: 'new-password' })
    expect(service.listEntries('documents')[0].sensitiveFields.id).toBe('12345678')
    service.closeVault()
  })

  it('does not replace the current vault or leave a destination after a failed restore', async () => {
    const { service, root, filePath } = fixture('password')
    const backup = await service.backup({ destinationPath: join(root, 'copy.everkeep-backup') })
    const destination = join(root, 'invalid.everkeep')
    await expect(service.restoreBackup({ backupPath: backup.backupPath, destinationPath: destination, password: 'wrong' })).rejects.toThrow(/incorrect/i)
    expect(existsSync(destination)).toBe(false)
    expect(service.getStatus().session?.filePath).toBe(filePath)
    service.closeVault()
  })

  it('rejects missing attachment data in old-style backups', async () => {
    const { service, root, filePath } = fixture()
    const entry = service.createEntry({ section: 'documents', title: 'Document' })
    const source = join(root, 'file.txt'); writeFileSync(source, 'hello')
    service.attachFile(entry.id, source)
    service.getDatabaseForTests()!.pragma('wal_checkpoint(TRUNCATE)')
    const zip = new JSZip(); zip.file('vault.everkeep', readFileSync(filePath))
    const path = join(root, 'incomplete.everkeep-backup'); writeFileSync(path, await zip.generateAsync({ type: 'nodebuffer' }))
    await expect(service.verifyBackup({ backupPath: path })).rejects.toThrow(/missing/i)
    expect(service.getHandoff().lastBackupVerifiedAt).toBe('')
    await expect(service.restoreBackup({ backupPath: path, destinationPath: join(root, 'bad.everkeep') })).rejects.toThrow(/missing/i)
    service.closeVault()
  })
})

describe('recipient packets', () => {
  it('defaults private letters off and exports only explicitly selected records', () => {
    const { service, root } = fixture()
    const person = service.createPerson({ fullName: 'Private contact fixture' })
    const account = service.createAccount({ institution: 'Private bank fixture', accountType: 'checking' })
    const letter = service.createEntry({ section: 'letters', title: 'Private letter fixture', fields: { body: 'PRIVATE BODY', privateFlag: 'yes' } })
    const publicLetter = service.createEntry({ section: 'letters', title: 'Public letter fixture', fields: { body: 'PUBLIC BODY', privateFlag: 'no' } })
    const report = join(root, 'report.html')
    service.exportReport({ destinationPath: report })
    expect(readFileSync(report, 'utf8')).not.toContain('PRIVATE BODY')
    expect(readFileSync(report, 'utf8')).toContain('PUBLIC BODY')
    const options = { selection: { people: [], accounts: [], entries: [letter.id] }, includePrivateLetters: true }
    const preview = service.previewReport(options)
    expect(preview.html).toContain('PRIVATE BODY')
    expect(preview.html).not.toContain('Private bank fixture')
    expect(preview.html).not.toContain('Private contact fixture')
    service.updateEntry({ id: letter.id, fields: { body: 'CHANGED AFTER PREVIEW', privateFlag: 'yes' } })
    service.exportReport({ ...options, destinationPath: report, previewToken: preview.token })
    expect(readFileSync(report, 'utf8')).toBe(preview.html)
    const catalog = service.getExportCatalog()
    expect(presetSelection(catalog, 'caregiver')).toEqual({ people: [], accounts: [], entries: [] })
    expect(presetSelection(catalog, 'spouse').entries).toEqual([publicLetter.id])
    expect(presetSelection(catalog, 'spouse').people).toEqual([person.id])
    expect(presetSelection(catalog, 'spouse').accounts).toEqual([account.id])
    service.closeVault()
    expect(() => service.exportReport({ destinationPath: report, previewToken: preview.token })).toThrow()
  })

  it('retains multiple beneficiaries and ownership through form editing and includes them in reports', () => {
    const { service } = fixture()
    const first = service.createPerson({ fullName: 'First beneficiary' }), second = service.createPerson({ fullName: 'Second beneficiary' }), alternate = service.createPerson({ fullName: 'Alternate beneficiary' })
    const account = service.createAccount({ institution: 'Example', accountType: 'ira', ownerPersonIds: [first.id], beneficiaries: [{ personId: first.id, designationType: 'primary', percentage: 60, perStirpes: true, notes: 'Existing election' }, { personId: second.id, designationType: 'primary', percentage: 40 }, { personId: alternate.id, designationType: 'contingent', percentage: 100 }] })
    const form = accountToForm(account)
    const edited = service.updateAccount({ id: account.id, ...form, institution: 'Example renamed' })
    expect(edited.beneficiaries).toHaveLength(3)
    expect(edited.beneficiaries.find((b) => b.personId === first.id)?.perStirpes).toBe(true)
    expect(edited.beneficiaries.find((b) => b.personId === first.id)?.notes).toBe('Existing election')
    expect(edited.ownerPersonIds).toEqual([first.id])
    const { html } = service.previewReport({ selection: { people: [], accounts: [account.id], entries: [] } })
    for (const label of ['Owners', 'First beneficiary', 'Second beneficiary', 'Contingent beneficiary', 'Alternate beneficiary', '60%', '40%', '100%']) expect(html).toContain(label)
    service.closeVault()
  })

  it('keeps access instructions out of the emergency summary unless requested and escapes text', () => {
    const { service } = fixture()
    service.updateHandoff({ ...EMPTY_HANDOFF, careInstructions: '<script>alert(1)</script>', incapacityInstructions: 'Unavailable instructions', deathInstructions: 'Death instructions', passwordInstructions: 'SEPARATE ACCESS INSTRUCTIONS' })
    const options = { selection: { people: [], accounts: [], entries: [] }, includeStartHere: true, scenario: 'incapacity' as const }
    const { html } = service.previewReport(options)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('Unavailable instructions')
    expect(html).not.toContain('Death instructions')
    expect(html).not.toContain('SEPARATE ACCESS INSTRUCTIONS')
    expect(service.previewReport({ ...options, includeAccessPlan: true }).html).toContain('SEPARATE ACCESS INSTRUCTIONS')
    service.closeVault()
  })
})

describe('save failure and migration safety', () => {
  it('rolls back a record mutation when encrypted persistence fails', () => {
    const { service, filePath } = fixture('password')
    const before = readFileSync(filePath)
    // Simulate an external writer; our save must not overwrite that change.
    writeFileSync(filePath, 'external change')
    expect(() => service.createPerson({ fullName: 'Must not commit' })).toThrow(/changed outside/i)
    expect(service.listPeople()).toHaveLength(0)
    expect(readFileSync(filePath, 'utf8')).toBe('external change')
    writeFileSync(filePath, before)
    service.closeVault()
  })

  it('migrates older field-encrypted files and preserves archived sensitive entries during password rotation', () => {
    const { service, root, filePath } = fixture('old-password')
    const entry = service.createEntry({ section: 'identity', title: 'Archive fixture', sensitiveFields: { number: 'ARCHIVED SECRET' } })
    service.archiveEntry(entry.id)
    const legacyBytes = service.getDatabaseForTests()!.serialize()
    service.closeVault()
    writeFileSync(filePath, legacyBytes)
    service.openVault({ filePath, password: 'old-password' })
    expect(readFileSync(filePath, 'utf8')).toContain('everkeep-encrypted')
    service.rotatePassword('old-password', 'new-password')
    const row = service.getDatabaseForTests()!.prepare('SELECT sensitive_json_encrypted FROM vault_entries WHERE id = ?').get(entry.id) as { sensitive_json_encrypted: string }
    expect(new EncryptionService().decrypt(row.sensitive_json_encrypted, service.getEncryptionKeyForTests()!)).toContain('ARCHIVED SECRET')
    expect(existsSync(join(root, 'Everkeep Migration Backups'))).toBe(false)
    service.closeVault()
  })
})

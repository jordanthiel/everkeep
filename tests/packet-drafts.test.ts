import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { VaultService } from '../src/main/services/VaultService'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
import { createPacketDraft, packetOptions, reconcilePacket } from '../src/shared/packet'
import { PacketDraftSchema } from '../src/shared/schemas/packet'
import { EMPTY_HANDOFF } from '../src/shared/types/handoff'
import { setDatabasePersistence, openMemoryDatabase, closeDatabase } from '../src/main/database/connection'
import { migrations } from '../src/main/database/migrations'
import { PacketDraftRepository } from '../src/main/repositories/PacketDraftRepository'

const cleanups: Array<() => void> = []
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup() })
function fixture(password?: string) {
  const root = mkdtempSync(join(tmpdir(), 'everkeep-packet-'))
  cleanups.push(() => rmSync(root, { recursive: true, force: true }))
  const service = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), argon2Params: TEST_ARGON2_PARAMS, attachmentsRootFactory: id => join(root, id) })
  cleanups.push(() => service.closeVault())
  const filePath = join(root, 'test.everkeep')
  service.createVault({ name: 'Packet fixture', filePath, password })
  return { root, service, filePath }
}

describe('packet drafts', () => {
  it('survives protected lock, reopening, backup and restore without leaking into other vaults', async () => {
    const { service, root, filePath } = fixture('test-password')
    const draft = createPacketDraft(EMPTY_HANDOFF, service.getExportCatalog())
    draft.recipientMode = 'named'; draft.recipientName = 'PRIVATE RECIPIENT 489'
    draft.introduction.careInstructions = 'PRIVATE DRAFT 158'
    draft.step = 2
    service.savePacketDraft(draft)
    expect(readFileSync(filePath).includes(Buffer.from('PRIVATE DRAFT 158'))).toBe(false)
    service.lockVault(); expect(() => service.getPacketDraft()).toThrow()
    service.unlockVault('test-password'); expect(service.getPacketDraft()).toEqual(draft)
    service.closeVault(); service.openVault({ filePath, password: 'test-password' })
    expect(service.getPacketDraft()).toEqual(draft)
    const { backupPath } = await service.backup({ destinationPath: join(root, 'copy.everkeep-backup') })
    await service.restoreBackup({ backupPath, destinationPath: join(root, 'restored.everkeep'), password: 'test-password' })
    expect(service.getPacketDraft()).toEqual(draft)
    service.closeVault(); service.createVault({ name: 'Other vault', filePath: join(root, 'other.everkeep') })
    expect(service.getPacketDraft()).toBeNull()
    service.closeVault(); service.openVault({ filePath, password: 'test-password' })
    expect(service.getPacketDraft()).toEqual(draft)
    service.clearPacketDraft(); expect(service.getPacketDraft()).toBeNull()
  })

  it('rolls back a draft when protected persistence fails and validates stored input', () => {
    const db = openMemoryDatabase(); cleanups.push(() => closeDatabase(db))
    for (const migration of migrations) migration.up(db)
    const repo = new PacketDraftRepository(db)
    const draft = createPacketDraft(EMPTY_HANDOFF, { people: [], accounts: [], entries: [] })
    repo.save(draft)
    setDatabasePersistence(db, () => { throw new Error('Disk full') })
    expect(() => repo.save({ ...draft, recipientName: 'Not persisted' })).toThrow('Disk full')
    expect(repo.get()).toEqual(draft)
    expect(() => PacketDraftSchema.parse({ ...draft, step: 8 })).toThrow()
  })

  it('uses packet-specific notes, excludes the recipient from helpers, and renders both situations', () => {
    const { service } = fixture()
    const alex = service.createPerson({ fullName: 'Alex', phone: '111-1111' })
    const sam = service.createPerson({ fullName: 'Sam', phone: '222-2222', email: 'sam@example.test' })
    service.updateHandoff({ ...EMPTY_HANDOFF, primaryContactId: alex.id, alternateContactId: sam.id, careInstructions: 'Default priorities', incapacityInstructions: 'Default incapacity', deathInstructions: 'Default death', passwordInstructions: 'ACCESS SECRET' })
    const original = service.getHandoff()
    const draft = createPacketDraft(original, service.getExportCatalog())
    draft.recipientContactId = alex.id
    draft.introduction.careInstructions = 'Only for this packet <script>alert(1)</script>'
    draft.introduction.helpers[1].help = 'Can help find documents'
    const options = packetOptions(draft, service.listPeople(), true)
    const { html } = service.previewReport(options)
    expect(html).toContain('If I cannot help')
    expect(html).toContain('After my death')
    expect(html).toContain('Default incapacity'); expect(html).toContain('Default death')
    expect(html).not.toContain('111-1111'); expect(html).toContain('222-2222'); expect(html).toContain('sam@example.test')
    expect(html).toContain('Can help find documents'); expect(html).not.toContain('Call first')
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>')
    expect(html).not.toContain('ACCESS SECRET'); expect(service.getHandoff()).toEqual(original)
    expect(service.previewReport({ ...options, includeAccessPlan: true }).html).toContain('ACCESS SECRET')
    expect(service.previewReport({ ...options, scenario: 'death' }).html).not.toContain('Default incapacity')
    expect(service.previewReport({ ...options, scenario: 'incapacity' }).html).not.toContain('Default death')
    // Typed names are never matched to contact identities.
    draft.recipientMode = 'named'; draft.recipientName = 'Alex'
    expect(service.previewReport(packetOptions(draft, service.listPeople(), true)).html).toContain('111-1111')
  })

  it('handles empty content, missing contacts and unavailable selections without silently substituting content', () => {
    const { service } = fixture()
    const person = service.createPerson({ fullName: 'Recipient' })
    const entry = service.createEntry({ section: 'documents', title: 'Selected record' })
    const draft = createPacketDraft(EMPTY_HANDOFF, service.getExportCatalog())
    draft.recipientMode = 'general'
    expect(() => service.previewReport(packetOptions(draft, service.listPeople(), true))).toThrow('Add some information')
    draft.selection.entries = [entry.id]
    const html = service.previewReport(packetOptions(draft, service.listPeople(), true)).html
    expect(html).not.toContain('<h2>Start here')
    draft.recipientMode = 'contact'; draft.recipientContactId = person.id
    service.archivePerson(person.id)
    expect(() => service.previewReport(packetOptions(draft, service.listPeople(), true))).toThrow('recipient is no longer available')
    service.archiveEntry(entry.id)
    const result = reconcilePacket(draft, service.getExportCatalog())
    expect(result.removed).toBe(1); expect(result.draft.selection.entries).toEqual([])
    expect(result.draft.recipientContactId).toBe(person.id)
  })

  it('keeps delivery distinct from access practice and exports the exact reviewed snapshot', () => {
    const { service, root } = fixture()
    const draft = createPacketDraft(EMPTY_HANDOFF, service.getExportCatalog())
    draft.recipientMode = 'general'; draft.introduction.deathInstructions = 'Version one'
    const options = packetOptions(draft, service.listPeople(), true)
    const preview = service.previewReport(options)
    draft.introduction.deathInstructions = 'Version two'
    const path = join(root, 'packet.html')
    service.exportReport({ ...options, destinationPath: path, previewToken: preview.token })
    expect(readFileSync(path, 'utf8')).toBe(preview.html)
    draft.latestExport = { path, recipient: 'General copy', signature: JSON.stringify(options), savedAt: new Date().toISOString(), deliveredAt: new Date().toISOString() }
    service.savePacketDraft(draft)
    expect(service.getHandoff().handoffTestedAt).toBe('')
  })
})

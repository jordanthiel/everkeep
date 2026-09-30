import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'
import { authFixture } from './fixtures/sharing-auth'
import { createSharingHandler, type SharingEnv } from '../supabase/functions/_shared/sharing/handler'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
import { VaultService } from '../src/main/services/VaultService'
import { SharingService } from '../src/main/services/SharingService'
import { CreateVaultSchema } from '../src/shared/schemas/vault'

const electron = vi.hoisted(() => ({ directory: '', send: vi.fn() }))
vi.mock('electron', () => ({
  app: { getPath: () => electron.directory },
  safeStorage: { isEncryptionAvailable: () => false },
  BrowserWindow: { getAllWindows: () => [{ webContents: { send: electron.send } }] }
}))

let vault: VaultService, sharing: SharingService, db: Database.Database, root: string
let handler: ReturnType<typeof createSharingHandler>
let mails: { to: string; text: string }[]
let offline = false
class Statement {
  constructor(readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.sql, values) }
  async first<T>() { return (db.prepare(this.sql).get(...this.values) as T) ?? null }
  async all<T>() { return { results: db.prepare(this.sql).all(...this.values) as T[] } }
  async run() { return { meta: { changes: db.prepare(this.sql).run(...this.values).changes } } }
}
const input = () => ({ name: 'Private household', ownerFirstName: 'Jordan', ownerEmail: 'owner@example.com', filePath: join(root, 'owner.everkeep') })
async function signIn(email = 'owner@example.com') {
  const { challengeId } = await sharing.requestCode(email)
  const code = mails.filter(mail => mail.to === email).at(-1)!.text.match(/\b\d{6}\b/)![0]
  return sharing.verifyCode(challengeId, email, code)
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'everkeep-owner-')); electron.directory = root; electron.send.mockClear()
  mails = []; offline = false
  db = new Database(':memory:'); db.exec(readFileSync('tests/fixtures/sharing-sqlite.sql', 'utf8'))
  const env: SharingEnv = {
    AUTH: authFixture((to, text) => mails.push({ to, text })),
    DB: { prepare: sql => new Statement(sql), batch: async statements => db.transaction(() => statements.map(statement => { const query = statement as Statement; return db.prepare(query.sql).run(...query.values) }))() },
    FILES: { put: async () => {}, get: async () => null, delete: async () => {} },
    PUBLIC_URL: 'https://share.example.com', AUTH_SECRET: 'test-secret-'.repeat(5), DATA_KEY: Buffer.alloc(32, 7).toString('base64'), FROM_EMAIL: '', RESEND_API_KEY: ''
  }
  handler = createSharingHandler(env, { mail: async (to, _subject, text) => { mails.push({ to, text }) } })
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (offline) throw new Error('Network unavailable')
    return handler(new Request(url, init))
  })
  vault = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), argon2Params: TEST_ARGON2_PARAMS, attachmentsRootFactory: id => join(root, 'attachments', id) })
  sharing = new SharingService(vault, 'https://share.example.com')
})
afterEach(() => { vault.closeVault(); sharing.stop(); db.close(); vi.unstubAllGlobals(); rmSync(root, { recursive: true, force: true }) })

describe('email protected original vaults', () => {
  it('requires a verified matching owner and validates creation email', async () => {
    expect(CreateVaultSchema.safeParse({ ...input(), ownerEmail: undefined }).success).toBe(false)
    expect(CreateVaultSchema.safeParse({ ...input(), ownerEmail: 'invalid' }).success).toBe(false)
    expect(CreateVaultSchema.parse({ ...input(), ownerEmail: ' Owner@Example.com ' }).ownerEmail).toBe('owner@example.com')
    await expect(sharing.createOwnerVault(input())).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' })
    await signIn('other@example.com')
    await expect(sharing.createOwnerVault(input())).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' })
    expect(readdirSync(root)).not.toContain('owner.everkeep')
  })

  it('encrypts records, locks on sign-out, and requires the owner online on every unlock', async () => {
    await signIn()
    const created = await sharing.createOwnerVault(input())
    expect(created.metadata.ownerEmail).toBe('owner@example.com')
    expect(vault.listPeople()[0].email).toBe('owner@example.com')
    vault.createEntry({ section: 'documents', title: 'Private owner record' })
    const bytes = readFileSync(created.filePath)
    expect(bytes.toString()).not.toContain('Private owner record')
    expect(JSON.parse(bytes.toString()).format).toBe('everkeep-owner-encrypted')
    expect(() => vault.rotatePassword('', 'new-password')).toThrow(/verified email/i)
    await sharing.logout()
    expect(vault.getStatus().session?.isLocked).toBe(true)
    expect(electron.send).toHaveBeenCalledWith('vault:locked', expect.objectContaining({ isLocked: true }))
    expect(() => vault.listEntries('documents')).toThrow(/locked/i)
    await expect(vault.unlockVerifiedVault('')).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' })
    await signIn('other@example.com')
    await expect(vault.unlockVerifiedVault('')).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' })
    await signIn()
    offline = true
    await expect(vault.unlockVerifiedVault('')).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' })
    expect(vault.getStatus().session?.isLocked).toBe(true)
    offline = false
    await vault.unlockVerifiedVault('')
    expect(vault.listEntries('documents')[0].title).toBe('Private owner record')
    // Switching accounts without an explicit logout must also remove the decrypted session.
    await signIn('other@example.com')
    expect(vault.getStatus().session?.isLocked).toBe(true)
  })

  it('keeps owner protection on copies, backups, attachments and restore; rejects header tampering', async () => {
    await signIn()
    const created = await sharing.createOwnerVault(input())
    const entry = vault.createEntry({ section: 'documents', title: 'Private document' })
    const attachment = join(root, 'private.txt'); writeFileSync(attachment, 'Private attachment contents')
    vault.attachFile(entry.id, attachment)
    const copy = await vault.savePortableCopy(join(root, 'copy.everkeep'))
    const backup = await vault.backup({ destinationPath: join(root, 'backup.everkeep-backup') })
    expect((await vault.verifyBackup({ backupPath: backup.backupPath })).attachmentCount).toBe(1)
    const envelope = JSON.parse(readFileSync(copy.path, 'utf8'))
    expect(envelope.format).toBe('everkeep-owner-encrypted')
    vault.closeVault()
    expect(() => vault.openVault({ filePath: copy.path, password: 'anything' })).toThrow(/email/i)
    await vault.openVerifiedVault({ filePath: copy.path })
    expect(vault.listEntries('documents')[0].title).toBe('Private document')
    offline = true
    await expect(vault.restoreBackup({ backupPath: backup.backupPath, destinationPath: join(root, 'offline.everkeep') })).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' })
    expect(readdirSync(root)).not.toContain('offline.everkeep')
    offline = false
    const restored = await vault.restoreBackup({ backupPath: backup.backupPath, destinationPath: join(root, 'restored.everkeep') })
    expect(restored.metadata.ownerEmail).toBe('owner@example.com')
    expect(JSON.parse(readFileSync(restored.filePath, 'utf8')).format).toBe('everkeep-owner-encrypted')
    expect(vault.getSharingAttachment(vault.listAttachments(entry.id)[0].id).toString()).toBe('Private attachment contents')
    vault.closeVault()
    const changed = { ...envelope, owner: { ...envelope.owner, ownerId: randomUUID() } }
    writeFileSync(created.filePath, JSON.stringify(changed))
    await expect(vault.openVerifiedVault({ filePath: created.filePath })).rejects.toMatchObject({ code: 'EMAIL_REQUIRED' })
    // Renaming the format cannot turn the protected original into a password vault.
    writeFileSync(created.filePath, JSON.stringify({ ...envelope, format: 'everkeep-encrypted' }))
    const secret = (await sharing.request<{ secret: string }>(`/vaults/${envelope.owner.vaultId}/owner-key`)).secret
    expect(() => vault.openVault({ filePath: created.filePath, password: secret })).toThrow(/ownership/i)
  })

  it('never releases the original secret to an invited all-record collaborator', async () => {
    await signIn()
    const created = await sharing.createOwnerVault(input()), id = vault.getSharingLink()!.remoteId
    const ownerKey = await sharing.request<{ secret: string }>(`/vaults/${id}/owner-key`)
    const retried = await sharing.request<{ secret: string }>(`/vaults/${id}/owner-key`, 'POST', {})
    expect(retried.secret).toBe(ownerKey.secret)
    expect(JSON.stringify(db.prepare('SELECT * FROM owner_vault_keys').all())).not.toContain(ownerKey.secret)
    expect(readFileSync(created.filePath, 'utf8')).not.toContain(ownerKey.secret)
    await sharing.request(`/vaults/${id}/invite`, 'POST', { requestId: randomUUID(), email: 'collaborator@example.com', scope: { type: 'all' }, canEdit: true })
    await signIn('collaborator@example.com')
    await sharing.request(`/vaults/${id}/accept`, 'POST', {})
    await expect(sharing.request(`/vaults/${id}/owner-key`)).rejects.toMatchObject({ status: 403 })
    await expect(sharing.request(`/vaults/${id}/owner-key`, 'POST', {})).rejects.toMatchObject({ status: 403 })
    expect((await handler(new Request(`https://share.example.com/api/vaults/${id}/owner-key`))).status).toBe(401)
  })
})

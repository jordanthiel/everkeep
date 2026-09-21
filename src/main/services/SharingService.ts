import { SharingTransport } from '../../shared/sharingTransport'
import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type { VaultService } from './VaultService'
import type { SharingLink } from '../repositories/SharingLinkRepository'
import { mergeSnapshots, recordContent, type SharedSnapshot, type SharedVaultView, type SharingAccount, type SharingStatus } from '../../shared/sharing'

export interface SyncConflicts { revision: number; fingerprint: string; items: Array<{ id: string; local: string; shared: string }> }
const fingerprint = (value: SharedSnapshot) => createHash('sha256').update(JSON.stringify({ name: value.name, records: value.records.map(recordContent) })).digest('hex')
export class SharingService {
  private transport: SharingTransport
  private get account(): SharingAccount | null { return this.transport.session?.account ?? null }
  private error: string | null = null
  private state: NonNullable<SharingStatus['local']>['state'] = 'local'
  private pending: Promise<void> | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private editing = false
  private conflict: SyncConflicts | null = null
  private generation = 0
  private activeFile: string | null = null
  private readonly authFile: string
  private portalUrl = ''
  readonly url: string
  constructor(private readonly vault: VaultService, url = process.env.EVERKEEP_SHARING_URL || process.env.EVERKEEP_SHARING_BUILD_URL || '') {
    this.url = url.replace(/\/$/, '')
    if (this.url) { const parsed = new URL(this.url); if (parsed.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.protocol === 'http:')) throw new Error('Sharing requires HTTPS.') }
    this.authFile = join(app.getPath('userData'), 'sharing-session.bin')
    let saved: unknown
    if (existsSync(this.authFile) && safeStorage.isEncryptionAvailable()) {
      try { const stored = JSON.parse(safeStorage.decryptString(readFileSync(this.authFile))); if (stored.url === this.url) saved = stored } catch { /* Ask for a fresh sign-in when the OS keychain changes. */ }
    }
    this.transport = new SharingTransport(this.url, session => {
      if (!session || session.account.id !== this.account?.id) this.generation++
      if (session && safeStorage.isEncryptionAvailable()) writeFileSync(this.authFile, safeStorage.encryptString(JSON.stringify({ url: this.url, ...session })), { mode: 0o600 })
      else rmSync(this.authFile, { force: true })
    }, saved)
  }
  start() { if (this.timer) return; this.timer = setInterval(() => { if (this.account && !this.editing && this.vault.getStatus().session && !this.vault.getStatus().session?.isLocked && this.vault.getSharingLink()) void this.sync().catch(() => {}) }, 15000); this.timer.unref() }
  stop() { if (this.timer) clearInterval(this.timer); this.generation++; this.transport.session = null; this.conflict = null }
  setEditing(value: boolean) { this.editing = value }
  getConflicts() { return this.conflict }
  async loadConfiguration() {
    if (!this.url || this.portalUrl) return
    const config = await this.request<{ portalUrl: string }>('/config')
    const parsed = new URL(config.portalUrl)
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('The sharing portal requires HTTPS.')
    this.portalUrl = config.portalUrl.replace(/\/$/, '')
  }
  status(): SharingStatus {
    const session = this.vault.getStatus().session
    const activeFile = session && !session.isLocked ? session.filePath : null
    if (this.activeFile !== activeFile) { this.activeFile = activeFile; this.conflict = null; this.error = null; this.state = 'local'; this.generation++ }
    const link = session && !session.isLocked ? this.vault.getSharingLink() : null
    return { configured: Boolean(this.url), url: this.portalUrl, account: this.account, local: session && !session.isLocked ? { filePath: session.filePath, sharedId: link?.remoteId ?? null, ownsShared: Boolean(link && link.ownerId === this.account?.id), lastSyncedAt: link?.lastSyncedAt || null, state: link ? this.state === 'local' ? 'synced' : this.state : 'local', error: this.error } : null }
  }
  request<T>(path: string, method = 'GET', input?: unknown): Promise<T> { return this.transport.request<T>(path, method, input) }
  requestCode(email: string) { return this.request<{ challengeId: string }>('/auth/request', 'POST', { email }) }
  verifyCode(challengeId: string, email: string, code: string) { this.generation++; return this.transport.verify(challengeId, email, code) }
  async logout() { this.generation++; this.conflict = null; await this.transport.logout() }
  async publish() {
    await this.loadConfiguration()
    this.status()
    if (!this.account) throw new Error('Sign in before sharing.')
    if (this.vault.getSharingLink()) { await this.sync(); return this.vault.getSharingLink()!.remoteId }
    const session = this.vault.getStatus().session!
    const source = this.vault.getSharingSnapshot(), generation = this.generation, accountId = this.account.id
    const created = await this.request<{ id: string; revision: number; existing: boolean }>('/vaults', 'POST', { sourceId: session.metadata.id, snapshot: source })
    if (this.vault.getStatus().session?.filePath !== session.filePath || this.vault.getStatus().session?.isLocked || this.generation !== generation) throw new Error('The active vault changed. Reopen it to finish sharing.')
    const remote = await this.request<SharedVaultView>(`/vaults/${created.id}`)
    if (this.vault.getStatus().session?.filePath !== session.filePath || this.vault.getStatus().session?.isLocked || this.generation !== generation) throw new Error('The active vault changed.')
    const link: SharingLink = { serviceUrl: this.url, remoteId: created.id, ownerId: accountId, revision: remote.revision, base: created.existing ? { name: source.name, records: [] } : source, lastSyncedAt: '' }
    this.vault.saveSharingLink(link)
    await this.sync()
    return created.id
  }
  async sync(resolution?: { revision: number; fingerprint: string; choices: Record<string, 'local' | 'shared'> }): Promise<void> {
    this.status()
    if (this.pending) return this.pending
    if (this.editing) throw new Error('Finish editing your record before synchronizing.')
    const run = async () => {
      const session = this.vault.getStatus().session, account = this.account, generation = this.generation
      if (!session || session.isLocked || !account) return
      const link = this.vault.getSharingLink(); if (!link) return
      if (link.serviceUrl !== this.url || link.ownerId !== account.id) throw new Error('This file belongs to another sharing account. Use Shared with me to access it.')
      const stillCurrent = () => {
        if (generation !== this.generation || this.vault.getStatus().session?.filePath !== session.filePath || this.vault.getStatus().session?.isLocked || this.editing) throw new Error('The active vault or editor changed. Sync will resume later.')
      }
      this.state = 'syncing'; this.error = null
      try {
        const local = this.vault.getSharingSnapshot(), originalFingerprint = fingerprint(local)
        const remote = await this.request<SharedVaultView>(`/vaults/${link.remoteId}`)
        stillCurrent()
        if (fingerprint(this.vault.getSharingSnapshot()) !== originalFingerprint) throw new Error('Local records changed during synchronization. Sync will retry.')
        const merged = mergeSnapshots(link.base, local, remote)
        if (merged.conflicts.length) {
          this.conflict = { revision: remote.revision, fingerprint: originalFingerprint, items: merged.conflicts.map(id => ({ id, local: id === 'name' ? local.name : JSON.stringify(local.records.find(record => record.id === id) ?? null), shared: id === 'name' ? remote.name : JSON.stringify(remote.records.find(record => record.id === id) ?? null) })) }
          if (!resolution || resolution.revision !== remote.revision || resolution.fingerprint !== originalFingerprint || merged.conflicts.some(id => !resolution.choices[id])) { this.state = 'conflict'; throw new Error('Some records changed in both places. Review the conflicting versions.') }
          for (const id of merged.conflicts) {
            const selected = resolution.choices[id] === 'shared' ? remote : local
            if (id === 'name') merged.snapshot.name = selected.name
            else { merged.snapshot.records = merged.snapshot.records.filter(record => record.id !== id); const record = selected.records.find(record => record.id === id); if (record) merged.snapshot.records.push(record) }
          }
        }
        // Applying remote changes uses the original validated repositories and a single transaction.
        this.vault.applySharingSnapshot(merged.snapshot)
        stillCurrent()
        // Read-only derived fields (e.g. contact names) are recomputed from the local records.
        const outgoing = this.vault.getSharingSnapshot()
        let revision = remote.revision
        if (fingerprint(outgoing) !== fingerprint(remote)) {
          const result = await this.request<{ revision: number; updatedAt: string }>(`/vaults/${link.remoteId}/snapshot`, 'PUT', { baseRevision: remote.revision, snapshot: outgoing })
          revision = result.revision
        }
        stillCurrent()
        const uploaded = new Set(link.uploaded ?? [])
        for (const record of outgoing.records) for (const attachment of record.attachments) {
          const key = `${attachment.id}:${attachment.checksum}`
          if (uploaded.has(key)) continue
          stillCurrent()
          const bytes = this.vault.getSharingAttachment(attachment.id)
          const response = await this.transport.fetch(`/vaults/${link.remoteId}/records/${record.id}/attachments/${attachment.id}`, { method: 'PUT', body: new Uint8Array(bytes), signal: AbortSignal.timeout(120000) })
          if (!response.ok) throw new Error(`Unable to sync attachment ${attachment.name}. Try again.`)
          uploaded.add(key)
        }
        stillCurrent()
        this.vault.saveSharingLink({ ...link, revision, base: outgoing, lastSyncedAt: new Date().toISOString(), uploaded: [...uploaded] })
        this.conflict = null; this.state = 'synced'; this.error = null
      } catch (error) { if (this.state !== 'conflict') this.state = 'offline'; this.error = error instanceof Error ? error.message : 'Sync failed.'; throw error }
    }
    this.pending = run()
    try { await this.pending } finally { this.pending = null }
  }
  async download(id: string, recordId: string, attachmentId: string): Promise<{ bytes: Buffer; name: string }> {
    const view = await this.request<SharedVaultView>(`/vaults/${id}`)
    const file = view.records.find(record => record.id === recordId)?.attachments.find(item => item.id === attachmentId)
    if (!file) throw new Error('Attachment unavailable.')
    const response = await this.transport.fetch(`/vaults/${id}/records/${recordId}/attachments/${attachmentId}`, { signal: AbortSignal.timeout(120000) })
    if (!response.ok) throw new Error('Unable to download this attachment. Your access may have changed.')
    return { bytes: Buffer.from(await response.arrayBuffer()), name: file.name }
  }
}

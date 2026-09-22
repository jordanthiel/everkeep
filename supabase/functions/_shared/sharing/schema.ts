import { z } from 'zod'

export const SharedFieldSchema = z.object({ label: z.string().max(300), value: z.string().max(20000), editable: z.boolean(), required: z.boolean().optional(), sensitive: z.boolean().optional(), maxLength: z.number().int().min(1).max(20000).optional(), options: z.array(z.object({ value: z.string(), label: z.string() })).optional() })
export const SharedAttachmentSchema = z.object({ id: z.string().uuid(), name: z.string().max(500), size: z.number().int().min(0).max(50 * 1024 * 1024 - 28), checksum: z.string().regex(/^[a-f0-9]{64}$/) })
export const SharedRecordSchema = z.object({ id: z.string().uuid(), kind: z.enum(['people', 'accounts', 'entries', 'handoff']), section: z.string().max(80), title: z.string().max(300), fields: z.record(SharedFieldSchema), attachments: z.array(SharedAttachmentSchema).default([]), version: z.number().int().min(1), updatedBy: z.string().max(200).optional(), updatedAt: z.string().optional() })
export const SharedSnapshotSchema = z.object({ name: z.string().min(1).max(200), records: z.array(SharedRecordSchema).max(10000) }).superRefine((snapshot, context) => {
  const keys = snapshot.records.map(record => record.id)
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', message: 'Duplicate record IDs' })
})
export const ShareScopeSchema = z.union([z.object({ type: z.literal('all') }), z.object({ type: z.literal('selected'), recordIds: z.array(z.string().uuid()).min(1).max(10000) })])
export const GrantSchema = z.object({ email: z.string().trim().email().max(200).transform(value => value.toLowerCase()), scope: ShareScopeSchema, canEdit: z.boolean() })
export const InvitationSchema = GrantSchema.extend({ requestId: z.string().uuid(), instructions: z.string().max(4000).default(''), password: z.string().max(1000).optional() })
export type SharedField = z.infer<typeof SharedFieldSchema>
export type SharedRecord = z.infer<typeof SharedRecordSchema>
export type SharedSnapshot = z.infer<typeof SharedSnapshotSchema>
export type ShareScope = z.infer<typeof ShareScopeSchema>
export type ShareGrant = z.infer<typeof GrantSchema>
export type ShareInvitation = z.infer<typeof InvitationSchema>
export interface SharingAccount { id: string; email: string }
export interface SharedMembership extends ShareGrant { status: 'pending' | 'active' | 'revoked'; emailStatus: 'pending' | 'sent' | 'failed'; updatedAt: string }
export interface SharedVaultSummary { id: string; name: string; role: 'owner' | 'viewer' | 'collaborator'; status: 'active' | 'pending'; updatedAt: string; storage?: 'file' | 'hosted' }
export interface SharedVaultView extends SharedSnapshot { storage?: 'file' | 'hosted'; id: string; revision: number; role: 'owner' | 'viewer' | 'collaborator'; scope: ShareScope; updatedAt: string }
export interface RecordEdit { baseVersion: number; values: Record<string, string> }
export interface SharingStatus { configured: boolean; url: string; account: SharingAccount | null; local: { filePath: string; sharedId: string | null; ownsShared?: boolean; storage?: 'file' | 'hosted'; ownerEmail?: string; lastSyncedAt: string | null; state: 'local' | 'synced' | 'syncing' | 'offline' | 'conflict'; error: string | null } | null }
export interface SharingClient {
  fileAccess?(id: string, packageId: string): Promise<FileAccess>
  status(): Promise<SharingStatus>
  requestCode(email: string): Promise<{ challengeId: string }>
  verifyCode(challengeId: string, email: string, code: string): Promise<SharingAccount>
  logout(): Promise<void>
  list(): Promise<SharedVaultSummary[]>
  get(id: string): Promise<SharedVaultView>
  accept(id: string): Promise<void>
  edit(id: string, recordId: string, input: RecordEdit): Promise<SharedRecord>
  members(id: string): Promise<SharedMembership[]>
  invite(id: string, input: ShareInvitation): Promise<{ sent: boolean }>
  grant(id: string, input: ShareGrant): Promise<void>
  revoke(id: string, email: string): Promise<void>
  attachment(id: string, recordId: string, attachmentId: string): Promise<void>
}
export function visibleRecords(snapshot: SharedSnapshot, scope: ShareScope): SharedRecord[] {
  return scope.type === 'all' ? snapshot.records : snapshot.records.filter(record => scope.recordIds.includes(record.id))
}
export function recordContent(record: SharedRecord | undefined): string {
  if (!record) return ''
  return JSON.stringify({ id: record.id, kind: record.kind, section: record.section, title: record.title, fields: record.fields, attachments: record.attachments })
}
export function mergeSnapshots(base: SharedSnapshot, local: SharedSnapshot, remote: SharedSnapshot) {
  const conflicts: string[] = []
  const records: SharedRecord[] = []
  for (const id of new Set([...base.records, ...local.records, ...remote.records].map(record => record.id))) {
    const b = base.records.find(record => record.id === id), l = local.records.find(record => record.id === id), r = remote.records.find(record => record.id === id)
    const lc = recordContent(l), rc = recordContent(r), bc = recordContent(b)
    if (lc !== bc && rc !== bc && lc !== rc) conflicts.push(id)
    const chosen = lc === bc ? r : l
    if (chosen) records.push(chosen)
  }
  if (local.name !== base.name && remote.name !== base.name && local.name !== remote.name) conflicts.push('name')
  return { snapshot: { name: local.name === base.name ? remote.name : local.name, records }, conflicts }
}
export function invitationText(vaultName: string, owner: string, url: string, input: ShareInvitation, storage: 'file' | 'hosted' = 'hosted'): string {
  if (storage === 'file') return `${owner} invited you to ${vaultName}.\n\nAccess: ${input.scope.type === 'all' ? 'Entire vault' : `${input.scope.recordIds.length} selected record(s)`}. ${input.canEdit ? 'You may edit your own file copy. Changes do not synchronize automatically.' : 'View only.'}\n\nDownload the access-controlled .everkeep file from the location supplied by the owner. Open ${url}, verify this email address, accept the invitation, and choose Open an Everkeep file. You can also open the file from Shared with me in the desktop app.\n\nEverkeep stores permissions and protected encryption keys, not this file’s contents. An internet connection is required to verify access. Revocation cannot erase information already opened or copied.\n${input.instructions ? `\n${input.instructions}\n` : ''}`

  return `${owner} invited you to ${vaultName}.\n\nAccess: ${input.scope.type === 'all' ? 'Entire vault' : `${input.scope.recordIds.length} selected record(s)`}. ${input.canEdit ? 'You may edit the information shared with you. You cannot manage access.' : 'View only. Editing is not enabled.'}\n\nOpen ${url}\nVerify this email address to access the vault in your browser. You can also choose “Open in Everkeep” on that page after installing the app.\n\nThis link shows the latest synchronized information. The owner can change or revoke your access.\n${input.instructions ? `\n${input.instructions}\n` : ''}${input.password ? `\nPassword for the owner's local vault file: ${input.password}\nThis is not required for the online link.\n` : ''}`
}

export interface SyncConflicts { revision: number; fingerprint: string; items: Array<{ id: string; local: string; shared: string }> }
export interface DesktopSharingApi extends SharingClient {
  takeOpenFile(): Promise<string | null>
  registerFile(): Promise<string>
  saveSharedFile(): Promise<string | null>
  fileAccess(id: string, packageId: string): Promise<FileAccess>
  publish(): Promise<string>
  snapshot(): Promise<SharedSnapshot>
  sync(resolution?: { revision: number; fingerprint: string; choices: Record<string, 'local' | 'shared'> }): Promise<void>
  conflicts(): Promise<SyncConflicts | null>
  setEditing(value: boolean): Promise<void>
  reveal(): Promise<void>
  saveCopy(): Promise<string | null>
  getOpenRequest(): Promise<string | null>
  onOpenRequest(listener: () => void): () => void
}

export interface FileAccess { actor?: SharingAccount; owner: SharingAccount; role: 'owner' | 'viewer' | 'collaborator'; scope: ShareScope; keys: Record<string, string> }

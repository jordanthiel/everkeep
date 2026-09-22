import { createAccessFile, openRecord } from '../src/shared/accessFile'
import type { FileAccess } from '../src/shared/sharing'
import { authFixture } from './fixtures/sharing-auth'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { randomUUID, createHash } from 'crypto'
import { createSharingHandler, type SharingEnv } from '../supabase/functions/_shared/sharing/handler'
import { mergeSnapshots, type SharedSnapshot } from '../src/shared/sharing'

let db: Database.Database
let handler: ReturnType<typeof createSharingHandler>
let mails: { to: string; text: string; key: string }[]
let objects: Map<string, Uint8Array>
let failMail = false
class Statement {
  constructor(readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.sql, values) }
  async first<T>() { return (db.prepare(this.sql).get(...this.values) as T) ?? null }
  async all<T>() { return { results: db.prepare(this.sql).all(...this.values) as T[] } }
  async run() { return { meta: { changes: db.prepare(this.sql).run(...this.values).changes } } }
}
beforeEach(() => {
  db = new Database(':memory:'); db.exec(readFileSync('tests/fixtures/sharing-sqlite.sql', 'utf8')); mails = []; objects = new Map(); failMail = false
  const env: SharingEnv = {
    AUTH: authFixture((to, text) => mails.push({ to, text, key: 'supabase-auth' })),
    DB: { prepare: sql => new Statement(sql), batch: async statements => db.transaction(() => statements.map(statement => { const s = statement as Statement; return db.prepare(s.sql).run(...s.values) }))() },
    FILES: { put: async (key, value) => { objects.set(key, typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)) }, get: async key => objects.has(key) ? { arrayBuffer: async () => new Uint8Array(objects.get(key)!).buffer } : null, delete: async key => { objects.delete(key) } },
    PUBLIC_URL: 'https://share.example.com', FROM_EMAIL: 'sharing@example.com', RESEND_API_KEY: '', AUTH_SECRET: 'test-secret-'.repeat(5), DATA_KEY: Buffer.alloc(32, 7).toString('base64')
  }
  handler = createSharingHandler(env, { mail: async (to, _subject, text, key) => { if (failMail) throw new Error('Mail failed'); mails.push({ to, text, key }) } })
})
afterEach(() => db.close())
async function call(path: string, token = '', method = 'GET', input?: unknown) {
  return handler(new Request(`https://share.example.com/api${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Everkeep-Client': 'desktop', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: input === undefined ? undefined : JSON.stringify(input) }))
}
async function signIn(email: string) {
  const response = await call('/auth/request', '', 'POST', { email }); expect(response.status).toBe(200)
  const { challengeId } = await response.json() as { challengeId: string }
  const code = mails.at(-1)!.text.match(/\b\d{6}\b/)![0]
  const verified = await call('/auth/verify', '', 'POST', { challengeId, email, code }); expect(verified.status).toBe(200)
  return (await verified.json() as { token: string }).token
}
const snapshot = (): SharedSnapshot => ({ name: 'Family vault', records: ['Care notes', 'Private letter'].map(title => ({ id: randomUUID(), kind: 'entries', section: 'Notes', title, version: 1, attachments: [], fields: { _title: { value: title, label: 'Name', editable: true, required: true, maxLength: 300 }, notes: { value: `Secret ${title}`, label: 'Notes', editable: true }, relationship: { value: 'Spouse', label: 'Relationship', editable: false } } })) })
async function publish(token: string, data = snapshot(), sourceId = randomUUID()) {
  const response = await call('/vaults', token, 'POST', { sourceId, snapshot: data }); expect(response.status).toBe(201)
  return { id: (await response.json() as { id: string }).id, data, sourceId }
}
describe('verified shared vault access', () => {
  it('makes codes single-use and limits incorrect attempts', async () => {
    const email = 'owner@example.com'; const { challengeId } = await (await call('/auth/request', '', 'POST', { email })).json() as { challengeId: string }
    const code = mails[0].text.match(/\b\d{6}\b/)![0]
    expect((await call('/auth/verify', '', 'POST', { challengeId, email: 'other@example.com', code })).status).toBe(401)
    expect((await call('/auth/verify', '', 'POST', { challengeId, email, code })).status).toBe(200)
    expect((await call('/auth/verify', '', 'POST', { challengeId, email, code })).status).toBe(401)
    const next = await (await call('/auth/request', '', 'POST', { email })).json() as { challengeId: string }
    for (let i = 0; i < 5; i++) await call('/auth/verify', '', 'POST', { ...next, email, code: 'abcdef' }) // malformed input does not consume a valid attempt
    const actual = mails.at(-1)!.text.match(/\b\d{6}\b/)![0]
    for (let i = 0; i < 5; i++) expect((await call('/auth/verify', '', 'POST', { ...next, email, code: actual === '000000' ? '111111' : '000000' })).status).toBe(401)
    expect((await call('/auth/verify', '', 'POST', { ...next, email, code: actual })).status).toBe(401)
  })
  it('filters records, denies viewer writes, permits scoped collaboration, and enforces revocation', async () => {
    const owner = await signIn('owner@example.com'), child = await signIn('child@example.com'), stranger = await signIn('stranger@example.com')
    const { id, data, sourceId } = await publish(owner), recordId = data.records[0].id
    const grant = { email: 'child@example.com', scope: { type: 'selected', recordIds: [recordId] }, canEdit: false }
    expect((await call(`/vaults/${id}/invite`, owner, 'POST', { ...grant, requestId: randomUUID() })).status).toBe(200)
    expect((await call(`/vaults/${id}`, child)).status).toBe(403)
    expect((await call(`/vaults/${id}/accept`, stranger, 'POST', {})).status).toBe(403)
    expect((await call(`/vaults/${id}/accept`, child, 'POST', {})).status).toBe(200)
    const view = await (await call(`/vaults/${id}`, child)).json() as SharedSnapshot
    expect(view.records.map(record => record.id)).toEqual([recordId]); expect(JSON.stringify(view)).not.toContain('Private letter')
    const edit = { baseVersion: 1, values: { notes: 'Updated care instructions' } }
    expect((await call(`/vaults/${id}/records/${recordId}`, child, 'PATCH', edit)).status).toBe(403)
    expect((await call(`/vaults/${id}/grant`, child, 'PATCH', { ...grant, canEdit: true })).status).toBe(403)
    expect((await call('/vaults', child, 'POST', { sourceId, snapshot: data })).status).toBe(403)
    expect((await call(`/vaults/${id}/grant`, owner, 'PATCH', { ...grant, canEdit: true })).status).toBe(200)
    expect((await call(`/vaults/${id}/records/${data.records[1].id}`, child, 'PATCH', edit)).status).toBe(403)
    const saved = await call(`/vaults/${id}/records/${recordId}`, child, 'PATCH', edit); expect(saved.status).toBe(200); expect(await saved.json()).toMatchObject({ version: 2, updatedBy: 'child@example.com' })
    expect((await call(`/vaults/${id}/records/${recordId}`, child, 'PATCH', edit)).status).toBe(409)
    expect((await call(`/vaults/${id}/records/${recordId}`, child, 'PATCH', { baseVersion: 2, values: { relationship: 'Owner' } })).status).toBe(403)
    expect((await call(`/vaults/${id}/records/${recordId}`, child, 'PATCH', { baseVersion: 2, values: { _title: '' } })).status).toBe(400)
    expect((await call(`/vaults/${id}/members`, child)).status).toBe(403)
    expect((await call(`/vaults/${id}/revoke`, owner, 'POST', { email: grant.email })).status).toBe(200)
    expect((await call(`/vaults/${id}`, child)).status).toBe(403)
    expect((await call(`/vaults/${id}/records/${recordId}`, child, 'PATCH', { ...edit, baseVersion: 2 })).status).toBe(403)
  })
  it('encrypts payloads and attachments and never stores invitation passwords', async () => {
    const owner = await signIn('owner@example.com'), viewer = await signIn('viewer@example.com'), data = snapshot()
    const bytes = Buffer.from('Highly private attachment'), fileId = randomUUID(); data.records[1].attachments = [{ id: fileId, name: 'private.txt', size: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex') }]
    const { id } = await publish(owner, data)
    const filePath = `/vaults/${id}/records/${data.records[1].id}/attachments/${fileId}`
    expect((await handler(new Request(`https://share.example.com/api${filePath}`, { method: 'PUT', headers: { Authorization: `Bearer ${owner}` }, body: bytes }))).status).toBe(200)
    const invite = { email: 'viewer@example.com', scope: { type: 'selected', recordIds: [data.records[0].id] }, canEdit: false, requestId: randomUUID(), password: 'NotStoredPassword123' }
    expect((await call(`/vaults/${id}/invite`, owner, 'POST', invite)).status).toBe(200)
    expect(mails.at(-1)!.text).toContain(invite.password)
    const count = mails.length; await call(`/vaults/${id}/invite`, owner, 'POST', invite); expect(mails).toHaveLength(count)
    await call(`/vaults/${id}/accept`, viewer, 'POST', {})
    expect((await call(filePath, viewer)).status).toBe(403)
    expect(await (await call(filePath, owner)).text()).toBe(bytes.toString())
    for (const value of objects.values()) { expect(Buffer.from(value).toString()).not.toContain('Secret'); expect(Buffer.from(value).toString()).not.toContain('Highly private'); expect(Buffer.from(value).toString()).not.toContain(invite.password) }
    expect(db.serialize().includes(Buffer.from(invite.password))).toBe(false)
  })
  it('retains a recoverable failed invitation and uses the same idempotency key on retry', async () => {
    const owner = await signIn('owner@example.com'), { id } = await publish(owner)
    const invite = { email: 'viewer@example.com', scope: { type: 'all' }, canEdit: false, requestId: randomUUID() }
    failMail = true; expect((await call(`/vaults/${id}/invite`, owner, 'POST', invite)).status).toBe(500)
    expect(await (await call(`/vaults/${id}/members`, owner)).json()).toMatchObject([{ emailStatus: 'failed' }])
    failMail = false; expect((await call(`/vaults/${id}/invite`, owner, 'POST', invite)).status).toBe(200); expect(mails.at(-1)!.key).toBe(invite.requestId)
  })
  it('prevents stale whole-vault publishing from overwriting a collaborator edit', async () => {
    const owner = await signIn('owner@example.com'), { id, data } = await publish(owner)
    await call(`/vaults/${id}/records/${data.records[0].id}`, owner, 'PATCH', { baseVersion: 1, values: { notes: 'New' } })
    expect((await call(`/vaults/${id}/snapshot`, owner, 'PUT', { baseRevision: 1, snapshot: data })).status).toBe(409)
    expect((await (await call(`/vaults/${id}`, owner)).json() as SharedSnapshot).records[0].fields.notes.value).toBe('New')
  })
})
describe('three-way vault merge', () => {
  it('keeps independent changes and identifies a simultaneous edit', () => {
    const base = snapshot(), local = structuredClone(base), remote = structuredClone(base)
    local.records[0].fields.notes.value = 'local'; remote.records[1].fields.notes.value = 'remote'
    const result = mergeSnapshots(base, local, remote); expect(result.conflicts).toEqual([]); expect(result.snapshot.records.map(record => record.fields.notes.value)).toEqual(['local', 'remote'])
    remote.records[0].fields.notes.value = 'also remote'; expect(mergeSnapshots(base, local, remote).conflicts).toEqual([base.records[0].id])
  })
})

describe('file-based vault permissions', () => {
  it('registers ownership without contents, releases only permitted keys, and retains permissions when hosting is enabled', async () => {
    const owner = await signIn('owner@example.com'), child = await signIn('child@example.com'), stranger = await signIn('stranger@example.com')
    const sourceId = randomUUID(), data = snapshot()
    const attachmentId = randomUUID(), attachmentBytes = new TextEncoder().encode('Confidential attachment bytes')
    data.records[0].attachments = [{ id: attachmentId, name: 'private.txt', size: attachmentBytes.length, checksum: createHash('sha256').update(attachmentBytes).digest('hex') }]
    const registered = await call('/file-vaults', owner, 'POST', { sourceId, name: data.name })
    expect(registered.status).toBe(201)
    const { id, owner: identity } = await registered.json()
    expect(objects.size).toBe(0)
    expect((await call('/file-vaults', child, 'POST', { sourceId, name: data.name })).status).toBe(403)
    expect((await call('/file-vaults', owner, 'POST', { sourceId, name: data.name, snapshot: data })).status).toBe(400)
    const prepared = await call(`/vaults/${id}/file-packages`, owner, 'POST', { recordIds: data.records.map(record => record.id) })
    expect(prepared.status).toBe(200)
    const pkg = await prepared.json() as FileAccess & { packageId: string }
    const file = await createAccessFile(data, id, pkg.packageId, identity, pkg.keys, async () => attachmentBytes)
    expect(JSON.stringify(file)).not.toContain('Private letter')
    expect(JSON.stringify(file)).not.toContain('Confidential attachment bytes')
    expect(JSON.stringify(db.prepare('SELECT * FROM file_packages').all())).not.toContain(pkg.keys[data.records[0].id])
    expect(objects.size).toBe(0)
    const grant = { email: 'child@example.com', scope: { type: 'selected', recordIds: [data.records[0].id] }, canEdit: false }
    const path = `/vaults/${id}/file-packages/${pkg.packageId}`
    expect((await call(path, stranger)).status).toBe(403)
    expect((await call(`/vaults/${id}/invite`, owner, 'POST', { ...grant, requestId: randomUUID(), password: 'local-password' })).status).toBe(400)
    expect((await call(`/vaults/${id}/invite`, owner, 'POST', { ...grant, requestId: randomUUID() })).status).toBe(200)
    expect(mails.at(-1)!.text).toContain('Download the access-controlled .everkeep file')
    expect((await call(path, child)).status).toBe(403)
    await call(`/vaults/${id}/accept`, child, 'POST', {})
    const permitted = await (await call(path, child)).json() as FileAccess
    expect(Object.keys(permitted.keys)).toEqual([data.records[0].id])
    const opened = await openRecord(file, data.records[0].id, permitted)
    expect(opened.record.title).toBe('Care notes')
    expect(atob(opened.attachments[attachmentId])).toBe('Confidential attachment bytes')
    await expect(openRecord(file, data.records[1].id, permitted)).rejects.toThrow('not available')
    await expect(openRecord({ ...file, packageId: randomUUID() }, data.records[0].id, permitted)).rejects.toThrow()
    await expect(openRecord({ ...file, owner: { ...identity, id: randomUUID() } }, data.records[0].id, permitted)).rejects.toThrow('owner')
    expect((await call(`/vaults/${id}/file-packages`, child, 'POST', { recordIds: [] })).status).toBe(403)
    expect((await call(`/vaults/${id}/grant`, child, 'PATCH', grant)).status).toBe(403)
    expect((await call(`/vaults/${id}/grant`, owner, 'PATCH', { ...grant, canEdit: true })).status).toBe(200)
    expect((await (await call(path, child)).json()).role).toBe('collaborator')
    expect((await call(`/vaults/${id}/snapshot`, owner, 'PUT', { baseRevision: 1, snapshot: data })).status).toBe(200)
    expect(objects.size).toBe(1)
    const hosted = await (await call(`/vaults/${id}`, child)).json()
    expect(hosted.storage).toBe('hosted'); expect(hosted.records).toHaveLength(1)
    expect((await call(path, child)).status).toBe(200)
    await call(`/vaults/${id}/revoke`, owner, 'POST', { email: grant.email })
    expect((await call(path, child)).status).toBe(403)
  })
})

import { z } from 'zod'
import { GrantSchema, InvitationSchema, SharedSnapshotSchema, invitationText, visibleRecords, recordContent, type SharedSnapshot, type ShareScope } from './schema.ts'

import { AuthError } from './ports.ts'
import type { SharingEnv } from './ports.ts'
export type { SharingEnv } from './ports.ts'
interface User { id: string; email: string }
interface Vault { id: string; source_id: string; owner_id: string; name: string; revision: number; payload: string; updated_at: string }
interface Member { email: string; scope: string; can_edit: number; status: string; email_status: string; updated_at: string }
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message) } }
const emailSchema = z.string().trim().email().max(200).transform(value => value.toLowerCase())
const idSchema = z.string().uuid()
const now = () => Date.now()
const stamp = () => new Date().toISOString()
const encoder = new TextEncoder()
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('')
async function digest(value: string) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))) }
async function cipherKey(env: SharingEnv) {
  const bytes = Uint8Array.from(atob(env.DATA_KEY), char => char.charCodeAt(0))
  if (bytes.length !== 32) throw new Error('Invalid sharing encryption key')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function encrypt(env: SharingEnv, bytes: Uint8Array, context: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, await cipherKey(env), new Uint8Array(bytes)))
  const result = new Uint8Array(12 + encrypted.length); result.set(iv); result.set(encrypted, 12); return result
}
async function decrypt(env: SharingEnv, bytes: ArrayBuffer, context: string): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: encoder.encode(context) }, await cipherKey(env), bytes.slice(12))
}
function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } })
}
async function readBytes(request: Request, maximum: number) {
  const reader = request.body?.getReader(); if (!reader) throw new HttpError(400, 'A request body is required.')
  const chunks: Uint8Array[] = []; let size = 0
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > maximum) { await reader.cancel(); throw new HttpError(413, 'This shared vault is too large.'); } chunks.push(value) }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}
async function body(request: Request, maximum = 11 * 1024 * 1024) {
  try { return JSON.parse(new TextDecoder().decode(await readBytes(request, maximum))) as unknown } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid JSON') }
}
async function limit(env: SharingEnv, key: string, maximum: number, windowMs: number) {
  const time = now()
  const row = await env.DB.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.expires < ? THEN 1 ELSE rate_limits.count+1 END, expires = CASE WHEN rate_limits.expires < ? THEN ? ELSE rate_limits.expires END RETURNING count').bind(key, time + windowMs, time, time, time + windowMs).first<{ count: number }>()
  if (!row || row.count > maximum) throw new HttpError(429, 'Too many attempts. Please try again later.')
}
async function currentUser(env: SharingEnv, request: Request): Promise<User> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) throw new HttpError(401, 'Sign in to continue.')
  const user = await env.AUTH.user(token)
  if (!user) throw new HttpError(401, 'Your session has expired. Sign in again.')
  return user
}
async function access(env: SharingEnv, user: User, id: string, pending = false) {
  const vault = await env.DB.prepare('SELECT * FROM vaults WHERE id = ?').bind(id).first<Vault>()
  if (!vault) throw new HttpError(404, 'Vault unavailable.')
  if (vault.owner_id === user.id) return { vault, role: 'owner' as const, scope: { type: 'all' } as ShareScope }
  const member = await env.DB.prepare('SELECT * FROM memberships WHERE vault_id = ? AND email = ?').bind(id, user.email).first<Member>()
  if (!member || (member.status !== 'active' && !(pending && member.status === 'pending'))) throw new HttpError(403, 'You do not have access to this vault.')
  return { vault, role: member.can_edit ? 'collaborator' as const : 'viewer' as const, scope: JSON.parse(member.scope) as ShareScope }
}
async function snapshot(env: SharingEnv, vault: Vault): Promise<SharedSnapshot> {
  const object = await env.FILES.get(vault.payload)
  if (!object) throw new HttpError(503, 'Shared information is temporarily unavailable.')
  return SharedSnapshotSchema.parse(JSON.parse(new TextDecoder().decode(await decrypt(env, await object.arrayBuffer(), vault.id))))
}
async function storeSnapshot(env: SharingEnv, id: string, value: SharedSnapshot) {
  const key = `vaults/${id}/${crypto.randomUUID()}`
  await env.FILES.put(key, await encrypt(env, encoder.encode(JSON.stringify(value)), id)); return key
}
async function audit(env: SharingEnv, vaultId: string, actor: string, action: string, recordId: string | null = null) {
  await env.DB.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), vaultId, actor, action, recordId, stamp()).run()
}
const allowed = (scope: ShareScope, id: string) => scope.type === 'all' || scope.recordIds.includes(id)
function requireOwner(role: string) { if (role !== 'owner') throw new HttpError(403, 'Only the owner can manage sharing.') }
export function createSharingHandler(env: SharingEnv, dependencies: { mail?: (to: string, subject: string, text: string, key: string) => Promise<void> } = {}) {
  async function mail(to: string, subject: string, text: string, key: string) {
    if (dependencies.mail) return dependencies.mail(to, subject, text, key)
    if (!env.RESEND_API_KEY || !env.FROM_EMAIL) throw new HttpError(503, 'Email delivery is not configured.')
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, text }) })
    if (!response.ok) throw new HttpError(502, 'Email could not be sent. Please retry.')
  }
  const handle = async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url), path = url.pathname
      if (!path.startsWith('/api/')) {
        const response = env.ASSETS ? await env.ASSETS.fetch(request) : new Response('Everkeep sharing', { status: 200 })
        const result = new Response(response.body, response)
        result.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        result.headers.set('Referrer-Policy', 'no-referrer')
        return result
      }
      if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || !env.DATA_KEY) throw new HttpError(503, 'Sharing service is not configured.')
      const origin = request.headers.get('Origin')
      if (origin && origin !== new URL(env.PUBLIC_URL).origin) throw new HttpError(403, 'Origin not allowed.')
      if (path === '/api/config' && request.method === 'GET') return json({ portalUrl: env.PUBLIC_URL })
      if (path === '/api/auth/request' && request.method === 'POST') {
        const { email } = z.object({ email: emailSchema }).parse(await body(request, 2000))
        await limit(env, `email:${await digest(email)}`, 5, 15 * 60000)
        await env.AUTH.requestCode(email)
        return json({ challengeId: crypto.randomUUID() })
      }
      if (path === '/api/auth/verify' && request.method === 'POST') {
        const input = z.object({ challengeId: idSchema, email: emailSchema, code: z.string().regex(/^\d{6}$/) }).parse(await body(request, 2000))
        await limit(env, `verify:${await digest(input.email)}`, 15, 15 * 60000)
        const session = await env.AUTH.verifyCode(input.email, input.code)
        // Account identities come from Supabase Auth, never from contact/subject records.
        await env.DB.prepare('INSERT INTO users(id,email) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').bind(session.account.id, session.account.email).run()
        return json(session)
      }
      if (path === '/api/auth/refresh' && request.method === 'POST') {
        const { refreshToken } = z.object({ refreshToken: z.string().min(1).max(4096) }).parse(await body(request, 6000))
        return json(await env.AUTH.refresh(refreshToken))
      }
      const user = await currentUser(env, request)
      if (path === '/api/account' && request.method === 'GET') return json(user)
      if (path === '/api/auth/logout' && request.method === 'POST') {
        await env.AUTH.logout(request.headers.get('Authorization')!.slice(7))
        return json({})
      }
      if (path === '/api/vaults' && request.method === 'GET') {
        const rows = await env.DB.prepare("SELECT v.id,v.name,v.owner_id,v.updated_at,m.can_edit,m.status FROM vaults v LEFT JOIN memberships m ON m.vault_id = v.id AND m.email = ? WHERE v.owner_id = ? OR m.status IN ('active','pending')").bind(user.email, user.id).all<Vault & { can_edit: number; status: string }>()
        return json(rows.results.map(row => ({ id: row.id, name: row.name, role: row.owner_id === user.id ? 'owner' : row.can_edit ? 'collaborator' : 'viewer', status: row.owner_id === user.id ? 'active' : row.status, updatedAt: row.updated_at })))
      }
      if (path === '/api/vaults' && request.method === 'POST') {
        const input = z.object({ sourceId: idSchema, snapshot: SharedSnapshotSchema }).parse(await body(request))
        await limit(env, `create:${user.id}`, 20, 86400000)
        const existing = await env.DB.prepare('SELECT * FROM vaults WHERE source_id = ?').bind(input.sourceId).first<Vault>()
        if (existing) { if (existing.owner_id !== user.id) throw new HttpError(403, 'This vault already has an owner. Ask them to invite you.'); return json({ id: existing.id, revision: existing.revision, existing: true }) }
        const id = crypto.randomUUID(), payload = await storeSnapshot(env, id, input.snapshot)
        try { await env.DB.prepare('INSERT INTO vaults VALUES(?,?,?,?,?,?,?)').bind(id, input.sourceId, user.id, input.snapshot.name, 1, payload, stamp()).run() }
        catch { await env.FILES.delete(payload); throw new HttpError(409, 'This vault was already registered. Try again.') }
        await audit(env, id, user.email, 'created')
        return json({ id, revision: 1, existing: false }, 201)
      }
      const match = path.match(/^\/api\/vaults\/([a-f0-9-]{36})(?:\/(.*))?$/)
      if (!match) throw new HttpError(404, 'Not found')
      const id = idSchema.parse(match[1]), tail = match[2] || ''
      const { vault, role, scope } = await access(env, user, id, tail === 'accept')
      if (tail === 'accept' && request.method === 'POST') {
        await env.DB.prepare("UPDATE memberships SET status='active',updated_at=? WHERE vault_id=? AND email=? AND status='pending'").bind(stamp(), id, user.email).run()
        return json({})
      }
      if (!tail && request.method === 'GET') {
        const data = await snapshot(env, vault)
        return json({ id, revision: vault.revision, name: data.name, role, scope, updatedAt: vault.updated_at, records: visibleRecords(data, scope) })
      }
      if (tail === 'snapshot' && request.method === 'PUT') {
        requireOwner(role)
        const input = z.object({ baseRevision: z.number().int().positive(), snapshot: SharedSnapshotSchema }).parse(await body(request))
        if (input.baseRevision !== vault.revision) throw new HttpError(409, 'The shared vault changed. Sync again before publishing.')
        const previous = await snapshot(env, vault)
        for (const record of input.snapshot.records) {
          const old = previous.records.find(item => item.id === record.id)
          record.version = old ? recordContent(old) === recordContent(record) ? old.version : old.version + 1 : 1
          record.updatedBy = old && recordContent(old) === recordContent(record) ? old.updatedBy : user.email
          record.updatedAt = old && recordContent(old) === recordContent(record) ? old.updatedAt : stamp()
        }
        const payload = await storeSnapshot(env, id, input.snapshot), updatedAt = stamp()
        const changed = await env.DB.prepare('UPDATE vaults SET payload=?,name=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?').bind(payload, input.snapshot.name, updatedAt, id, user.id, input.baseRevision).run()
        if (!changed.meta.changes) { await env.FILES.delete(payload); throw new HttpError(409, 'Another edit arrived. Sync again.') }
        await env.FILES.delete(vault.payload)
        await audit(env, id, user.email, 'synchronized')
        return json({ revision: vault.revision + 1, updatedAt })
      }
      if (tail === 'members' && request.method === 'GET') {
        requireOwner(role)
        const members = await env.DB.prepare('SELECT * FROM memberships WHERE vault_id=?').bind(id).all<Member>()
        return json(members.results.map(member => ({ email: member.email, scope: JSON.parse(member.scope), canEdit: Boolean(member.can_edit), status: member.status, emailStatus: member.email_status, updatedAt: member.updated_at })))
      }
      if (tail === 'invite' && request.method === 'POST') {
        requireOwner(role)
        const input = InvitationSchema.parse(await body(request, 200000))
        if (input.email === user.email) throw new HttpError(400, 'You already own this vault.')
        const data = await snapshot(env, vault)
        if (input.scope.type === 'selected' && input.scope.recordIds.some(recordId => !data.records.some(record => record.id === recordId))) throw new HttpError(400, 'One of the selected records is no longer available.')
        const fingerprint = await digest(`${env.AUTH_SECRET}:${JSON.stringify(input)}`)
        const prior = await env.DB.prepare('SELECT * FROM invitations WHERE request_id=?').bind(input.requestId).first<{ vault_id: string; digest: string; status: string }>()
        if (prior && (prior.vault_id !== id || prior.digest !== fingerprint)) throw new HttpError(409, 'Use a new invitation request after changing its contents.')
        if (prior?.status === 'sent') return json({ sent: true })
        await limit(env, `invite:${user.id}`, 30, 3600000)
        await env.DB.batch([
          env.DB.prepare("INSERT INTO invitations VALUES(?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING").bind(input.requestId, id, input.email, fingerprint, 'pending', stamp()),
          env.DB.prepare("INSERT INTO memberships VALUES(?,?,?,?,?,?,?) ON CONFLICT(vault_id,email) DO UPDATE SET scope=excluded.scope,can_edit=excluded.can_edit,status=CASE WHEN memberships.status='active' THEN 'active' ELSE 'pending' END,email_status='pending',updated_at=excluded.updated_at").bind(id, input.email, JSON.stringify(input.scope), input.canEdit ? 1 : 0, 'pending', 'pending', stamp())
        ])
        try {
          const owner = user.email
          await mail(input.email, `${owner} shared ${vault.name} with you`, invitationText(vault.name, owner, `${env.PUBLIC_URL.replace(/\/$/, '')}/#vault/${id}`, input), input.requestId)
          await env.DB.batch([env.DB.prepare("UPDATE invitations SET status='sent' WHERE request_id=?").bind(input.requestId), env.DB.prepare("UPDATE memberships SET email_status='sent' WHERE vault_id=? AND email=?").bind(id, input.email)])
        } catch (error) { await env.DB.prepare("UPDATE memberships SET email_status='failed' WHERE vault_id=? AND email=?").bind(id, input.email).run(); throw error }
        await audit(env, id, user.email, `invited ${input.email}`)
        return json({ sent: true })
      }
      if (tail === 'grant' && request.method === 'PATCH') {
        requireOwner(role); const input = GrantSchema.parse(await body(request, 200000))
        const data = await snapshot(env, vault)
        if (input.scope.type === 'selected' && input.scope.recordIds.some(recordId => !data.records.some(record => record.id === recordId))) throw new HttpError(400, 'A selected record is unavailable.')
        const result = await env.DB.prepare("UPDATE memberships SET scope=?,can_edit=?,updated_at=? WHERE vault_id=? AND email=? AND status != 'revoked'").bind(JSON.stringify(input.scope), input.canEdit ? 1 : 0, stamp(), id, input.email).run()
        if (!result.meta.changes) throw new HttpError(404, 'Invite this person before changing their access.')
        await audit(env, id, user.email, `changed access for ${input.email}`); return json({})
      }
      if (tail === 'revoke' && request.method === 'POST') {
        requireOwner(role); const { email } = z.object({ email: emailSchema }).parse(await body(request, 2000))
        await env.DB.prepare("UPDATE memberships SET status='revoked',updated_at=? WHERE vault_id=? AND email=?").bind(stamp(), id, email).run()
        await audit(env, id, user.email, `revoked ${email}`); return json({})
      }
      if (tail === 'audit' && request.method === 'GET') { requireOwner(role); return json((await env.DB.prepare('SELECT actor,action,record_id,created_at FROM audit WHERE vault_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all()).results) }
      const editMatch = tail.match(/^records\/([a-f0-9-]{36})$/)
      if (editMatch && request.method === 'PATCH') {
        if (role === 'viewer' || !allowed(scope, editMatch[1])) throw new HttpError(403, 'You cannot edit this record.')
        const input = z.object({ baseVersion: z.number().int().positive(), values: z.record(z.string().max(20000)) }).parse(await body(request, 200000))
        for (let attempt = 0; attempt < 3; attempt++) {
          const latest = await access(env, user, id)
          if (latest.role === 'viewer' || !allowed(latest.scope, editMatch[1])) throw new HttpError(403, 'Your editing access has changed.')
          const data = await snapshot(env, latest.vault), record = data.records.find(item => item.id === editMatch[1])
          if (!record) throw new HttpError(404, 'Record unavailable.')
          if (record.version !== input.baseVersion) return json({ error: 'Someone changed this record. Review the latest version before saving.', current: record }, 409)
          for (const [key, value] of Object.entries(input.values)) {
            const field = record.fields[key]
            if (!field?.editable) throw new HttpError(403, 'This field is not editable.')
            if ((field.required && !value.trim()) || value.length > (field.maxLength ?? 20000) || (field.options && !field.options.some(option => option.value === value))) throw new HttpError(400, `Check ${field.label}.`)
            field.value = value
          }
          record.title = record.fields.fullName?.value || record.fields.accountName?.value || record.fields.institution?.value || record.fields._title?.value || record.title
          record.version++; record.updatedAt = stamp(); record.updatedBy = user.email
          const payload = await storeSnapshot(env, id, data)
          // Membership is checked again in the same statement that commits the edit.
          const changed = await env.DB.prepare("UPDATE vaults SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND (owner_id=? OR EXISTS (SELECT 1 FROM memberships WHERE vault_id=? AND email=? AND status='active' AND can_edit=1 AND scope=?))").bind(payload, stamp(), id, latest.vault.revision, user.id, id, user.email, JSON.stringify(latest.scope)).run()
          if (changed.meta.changes) { await env.FILES.delete(latest.vault.payload); await audit(env, id, user.email, 'edited', record.id); return json(record) }
          await env.FILES.delete(payload)
        }
        throw new HttpError(409, 'The vault is changing. Try saving again.')
      }
      const fileMatch = tail.match(/^records\/([a-f0-9-]{36})\/attachments\/([a-f0-9-]{36})$/)
      if (fileMatch && (request.method === 'GET' || request.method === 'PUT')) {
        const data = await snapshot(env, vault), record = data.records.find(item => item.id === fileMatch[1])
        if (!record || !allowed(scope, record.id)) throw new HttpError(403, 'Attachment unavailable.')
        const file = record.attachments.find(item => item.id === fileMatch[2])
        if (!file) throw new HttpError(404, 'Attachment unavailable.')
        const key = `attachments/${id}/${file.id}/${file.checksum}`, context = `${id}:${file.id}:${file.checksum}`
        if (request.method === 'PUT') {
          requireOwner(role)
          const bytes = (await readBytes(request, Math.min(file.size, 50 * 1024 * 1024))).buffer
          if (bytes.byteLength !== file.size || bytes.byteLength > 50 * 1024 * 1024 || hex(await crypto.subtle.digest('SHA-256', bytes)) !== file.checksum) throw new HttpError(400, 'Attachment does not match its record.')
          await env.FILES.put(key, await encrypt(env, new Uint8Array(bytes), context)); return json({})
        }
        const fileObject = await env.FILES.get(key)
        if (!fileObject) throw new HttpError(409, 'This attachment has not finished syncing. Please try later.')
        const bytes = await decrypt(env, await fileObject.arrayBuffer(), context)
        return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
      }
      throw new HttpError(404, 'Not found')
    } catch (error) {
      if (error instanceof HttpError || error instanceof AuthError) return json({ error: error.message }, error.status)
      if (error instanceof z.ZodError) return json({ error: error.issues.map(issue => issue.message).join('; ') }, 400)
      return json({ error: 'The sharing service could not complete this request.' }, 500)
    }
  }
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin')
    const allowedOrigin = new URL(env.PUBLIC_URL).origin
    if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed.' }, 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'authorization,content-type,x-everkeep-client', 'Access-Control-Max-Age': '600', Vary: 'Origin' } })
    const response = await handle(request)
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    response.headers.set('Access-Control-Expose-Headers', 'Content-Disposition')
    response.headers.set('Vary', 'Origin')
    return response
  }

}


import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { createPostgresDatabase, type TransactionalSql } from '../supabase/functions/_shared/sharing/postgres'
import { createSharingHandler } from '../supabase/functions/_shared/sharing/handler'
import { authFixture } from '../tests/fixtures/sharing-auth'
const name = `everkeep-sharing-test-${randomUUID().slice(0, 8)}`
let sql: ReturnType<typeof postgres> | undefined
try {
  execFileSync('docker', ['run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=local-test-only', '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { stdio: 'pipe' })
  const port = execFileSync('docker', ['port', name, '5432'], { encoding: 'utf8' }).trim().split(':').at(-1)
  for (let attempt = 0; attempt < 60; attempt++) {
    try { execFileSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'pipe' }); break } catch { await new Promise(resolve => setTimeout(resolve, 500)) }
  }
  sql = postgres(`postgres://postgres:local-test-only@127.0.0.1:${port}/postgres`, { prepare: false, max: 3 })
  // Stand-ins for roles and bucket metadata already provisioned in a Supabase project.
  await sql.unsafe('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);')
  await sql.unsafe(readFileSync('supabase/migrations/20260921000000_sharing.sql', 'utf8'))
  const database = createPostgresDatabase(sql as unknown as TransactionalSql)
  await database.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.expires < ? THEN 1 ELSE rate_limits.count+1 END, expires = CASE WHEN rate_limits.expires < ? THEN ? ELSE rate_limits.expires END RETURNING count').bind('probe', Date.now()+10000, Date.now(), Date.now(), Date.now()+10000).first()
  const objects = new Map<string, Uint8Array>()
  const handler = createSharingHandler({ DB: database, AUTH: authFixture(() => {}), FILES: { put: async (key, value) => { objects.set(key, typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)) }, get: async key => objects.has(key) ? { arrayBuffer: async () => new Uint8Array(objects.get(key)!).buffer } : null, delete: async key => { objects.delete(key) } }, PUBLIC_URL: 'https://everkeep.example/share', FROM_EMAIL: 'sharing@example.com', RESEND_API_KEY: '', AUTH_SECRET: 'test-secret'.repeat(5), DATA_KEY: Buffer.alloc(32, 9).toString('base64') }, { mail: async () => {} })
  async function call(path: string, token = '', method = 'GET', body?: unknown) {
    const response = await handler(new Request(`https://project.supabase.co/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
    return { status: response.status, data: await response.json() }
  }
  async function signIn(email: string) { const challenge = await call('/auth/request', '', 'POST', { email }); assert.equal(challenge.status, 200); const verified = await call('/auth/verify', '', 'POST', { email, code: '123456', challengeId: challenge.data.challengeId }); assert.equal(verified.status, 200); return verified.data.token as string }
  const owner = await signIn('owner@example.com'), recipient = await signIn('recipient@example.com'), recordId = randomUUID(), privateId = randomUUID()
  const record = (id: string) => ({ id, kind: 'entries', section: 'Notes', title: 'Directions', version: 1, attachments: [], fields: { notes: { label: 'Notes', value: 'Private directions', editable: true } } })
  const published = await call('/vaults', owner, 'POST', { sourceId: randomUUID(), snapshot: { name: 'Postgres vault', records: [record(recordId), record(privateId)] } }); assert.equal(published.status, 201)
  const id = published.data.id
  const grant = { email: 'recipient@example.com', scope: { type: 'selected', recordIds: [recordId] }, canEdit: true }
  assert.equal((await call(`/vaults/${id}/invite`, owner, 'POST', { ...grant, requestId: randomUUID() })).status, 200)
  assert.equal((await call(`/vaults/${id}/accept`, recipient, 'POST', {})).status, 200)
  assert.equal((await call(`/vaults/${id}`, recipient)).data.records.length, 1)
  assert.equal((await call(`/vaults/${id}/records/${recordId}`, recipient, 'PATCH', { baseVersion: 1, values: { notes: 'Edited on Supabase' } })).status, 200)
  assert.equal((await call(`/vaults/${id}/records/${recordId}`, recipient, 'PATCH', { baseVersion: 1, values: { notes: 'Stale write' } })).status, 409)
  assert.equal((await call(`/vaults/${id}/records/${privateId}`, recipient, 'PATCH', { baseVersion: 1, values: { notes: 'Disallowed' } })).status, 403)
  assert.equal((await call(`/vaults/${id}/grant`, owner, 'PATCH', { ...grant, canEdit: false })).status, 200)
  assert.equal((await call(`/vaults/${id}/records/${recordId}`, recipient, 'PATCH', { baseVersion: 2, values: { notes: 'Disallowed' } })).status, 403)
  assert.equal((await call(`/vaults/${id}/revoke`, owner, 'POST', { email: grant.email })).status, 200)
  assert.equal((await call(`/vaults/${id}`, recipient)).status, 403)
  const view = (await call(`/vaults/${id}`, owner)).data
  assert.equal((await call(`/vaults/${id}/snapshot`, owner, 'PUT', { baseRevision: view.revision, snapshot: { name: view.name, records: view.records } })).status, 200)
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(sql.begin(async transaction => { await transaction.unsafe(`SET LOCAL ROLE ${role}`); await transaction.unsafe('SELECT * FROM vaults') }), error => (error as { code: string }).code === '42501')
  }
  assert.equal((await sql.unsafe("SELECT public FROM storage.buckets WHERE id='everkeep-shared-files'"))[0].public, false)
  // Batched membership/invitation changes must roll back together.
  await assert.rejects(database.batch([database.prepare('INSERT INTO users(id,email) VALUES(?,?)').bind('rollback', 'rollback@example.com'), database.prepare('INSERT INTO users(id,email) VALUES(?,?)').bind('rollback', 'duplicate@example.com')]))
  assert.equal(await database.prepare('SELECT * FROM users WHERE id=?').bind('rollback').first(), null)
  console.log('Postgres 17: real migration, SQL adapter, atomic transactions, scoped reads/edits, revision conflicts, revocation, and direct-client RLS denial passed.')
} finally { if (sql) await sql.end(); try { execFileSync('docker', ['rm', '-f', name], { stdio: 'pipe' }) } catch { /* Container already stopped. */ } }

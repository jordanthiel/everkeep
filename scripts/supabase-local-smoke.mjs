import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import postgres from 'postgres'
const settings = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const base = settings.API_URL
if (!base || new URL(base).hostname !== '127.0.0.1') throw new Error('This test only runs against an isolated local Supabase stack.')
const sql = postgres(settings.DB_URL, { prepare: false })
const api = `${base}/functions/v1/sharing/api`
const accounts = [], vaultIds = []
async function call(path, token = '', method = 'GET', input) {
  const response = await fetch(api + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: input === undefined ? undefined : JSON.stringify(input) })
  const data = await response.json(); assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`); return data
}
async function signIn() {
  const email = `everkeep-test-${randomUUID().slice(0, 8)}@example.com`
  const challenge = await call('/auth/request', '', 'POST', { email })
  let code
  for (let attempt = 0; attempt < 30; attempt++) {
    const inbox = await (await fetch('http://127.0.0.1:56424/api/v1/messages')).json()
    const mail = inbox.messages.find(mail => mail.To.some(to => to.Address === email))
    if (mail) { const message = await (await fetch(`http://127.0.0.1:56424/api/v1/message/${mail.ID}`)).json(); code = (message.Text || message.HTML).match(/\b\d{6}\b/)?.[0]; if (code) break }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(code, 'Supabase Auth delivered a six-digit code into the local mailbox')
  const result = await call('/auth/verify', '', 'POST', { ...challenge, email, code }); accounts.push(result.account); return result
}
try {
  assert.equal((await call('/config')).portalUrl, 'http://localhost:5173/share')
  const preflight = await fetch(api + '/auth/request', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } }); assert.ok([200, 204].includes(preflight.status)); assert.ok(['*', 'http://localhost:5173'].includes(preflight.headers.get('Access-Control-Allow-Origin')))
  const owner = await signIn(), recipient = await signIn()
  const bytes = Buffer.from('Private Supabase attachment'), fileId = randomUUID(), recordId = randomUUID(), hiddenId = randomUUID()
  const published = await call('/vaults', owner.token, 'POST', { sourceId: randomUUID(), snapshot: { name: 'Local Supabase test', records: [{ id: recordId, kind: 'entries', section: 'Notes', title: 'Shared directions', version: 1, fields: { notes: { label: 'Notes', value: 'Local Auth and Storage work', editable: true } }, attachments: [{ id: fileId, name: 'directions.txt', size: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex') }] }, { id: hiddenId, kind: 'entries', section: 'Letters', title: 'Private letter', version: 1, fields: {}, attachments: [] }] } }); vaultIds.push(published.id)
  const path = `/vaults/${published.id}`, filePath = `${path}/records/${recordId}/attachments/${fileId}`
  const upload = await fetch(api + filePath, { method: 'PUT', headers: { Authorization: `Bearer ${owner.token}` }, body: bytes }); assert.equal(upload.status, 200, await upload.text())
  // Provision one membership directly in the isolated fixture, so no Resend email is sent.
  await sql`INSERT INTO memberships VALUES (${published.id},${recipient.account.email},${JSON.stringify({ type: 'selected', recordIds: [recordId] })},1,'pending','sent',${new Date().toISOString()})`
  await call(`${path}/accept`, recipient.token, 'POST', {})
  const view = await call(path, recipient.token); assert.equal(view.records.length, 1); assert.equal(view.records[0].id, recordId)
  const download = await fetch(api + filePath, { headers: { Authorization: `Bearer ${recipient.token}` } }); assert.equal(download.status, 200); assert.equal(await download.text(), bytes.toString())
  await call(`${path}/records/${recordId}`, recipient.token, 'PATCH', { baseVersion: 1, values: { notes: 'Changed using a real Supabase session' } })
  const renewed = await call('/auth/refresh', '', 'POST', { refreshToken: recipient.refreshToken }); assert.equal(renewed.account.id, recipient.account.id)
  await call(`${path}/revoke`, owner.token, 'POST', { email: recipient.account.email })
  assert.equal((await fetch(api + filePath, { headers: { Authorization: `Bearer ${renewed.token}` } })).status, 403)
  const object = (await sql`SELECT name FROM storage.objects WHERE bucket_id='everkeep-shared-files' AND name LIKE ${`attachments/${published.id}/%`}`)[0]
  assert.ok(object)
  const direct = await fetch(`${base}/storage/v1/object/everkeep-shared-files/${object.name}`, { headers: { apikey: settings.ANON_KEY, Authorization: `Bearer ${renewed.token}` } }); assert.ok(!direct.ok, 'Recipient cannot bypass API permissions through direct Storage access')
  const encrypted = await fetch(`${base}/storage/v1/object/everkeep-shared-files/${object.name}`, { headers: { apikey: settings.SERVICE_ROLE_KEY, Authorization: `Bearer ${settings.SERVICE_ROLE_KEY}` } }); assert.equal(encrypted.status, 200); assert.ok(!Buffer.from(await encrypted.arrayBuffer()).includes(bytes))
  console.log('Local Supabase: real email OTP, Edge Function runtime, Postgres, private Storage upload/download, CORS, collaboration, refresh-token renewal and revocation passed. No Resend emails sent.')
} finally {
  for (const id of vaultIds) { await sql`DELETE FROM audit WHERE vault_id=${id}`; await sql`DELETE FROM memberships WHERE vault_id=${id}`; await sql`DELETE FROM invitations WHERE vault_id=${id}`; await sql`DELETE FROM vaults WHERE id=${id}` }
  for (const account of accounts) { await sql`DELETE FROM users WHERE id=${account.id}`; await fetch(`${base}/auth/v1/admin/users/${account.id}`, { method: 'DELETE', headers: { apikey: settings.SERVICE_ROLE_KEY, Authorization: `Bearer ${settings.SERVICE_ROLE_KEY}` } }) }
  await sql.end()
}

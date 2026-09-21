import { authFixture } from '../tests/fixtures/sharing-auth'
import { app, BrowserWindow, ipcMain } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, extname } from 'node:path'
import { createServer } from 'node:http'
import Database from 'better-sqlite3'
import { createSharingHandler, type SharingEnv } from '../supabase/functions/_shared/sharing/handler'
import { VaultService } from '../src/main/services/VaultService'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { registerSharingHandlers } from '../src/main/ipc/sharingHandlers'
import { IpcChannels } from '../src/shared/types/ipc'
const root = mkdtempSync(join(tmpdir(), 'everkeep-sharing-ui-'))
app.setPath('userData', root)
app.whenReady().then(async () => {
  const db = new Database(':memory:'); db.exec(readFileSync('tests/fixtures/sharing-sqlite.sql', 'utf8'))
  class Statement {
    constructor(readonly sql: string, readonly values: unknown[] = []) {}
    bind(...values: unknown[]) { return new Statement(this.sql, values) }
    async first<T>() { return (db.prepare(this.sql).get(...this.values) as T) ?? null }
    async all<T>() { return { results: db.prepare(this.sql).all(...this.values) as T[] } }
    async run() { return { meta: { changes: db.prepare(this.sql).run(...this.values).changes } } }
  }
  const objects = new Map<string, Uint8Array>(), mails: { to: string; text: string }[] = []
  let origin = '', failSaves = false
  const env: SharingEnv = { PUBLIC_URL: '', FROM_EMAIL: 'test@example.com', RESEND_API_KEY: '', AUTH_SECRET: 'test-only-secret'.repeat(4), DATA_KEY: Buffer.alloc(32, 1).toString('base64'),
    AUTH: authFixture((to, text) => mails.push({ to, text })),
    DB: { prepare: sql => new Statement(sql), batch: async statements => db.transaction(() => statements.map(statement => { const s = statement as Statement; return db.prepare(s.sql).run(...s.values) }))() },
    FILES: { put: async (key, value) => { objects.set(key, typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)) }, get: async key => objects.has(key) ? { arrayBuffer: async () => new Uint8Array(objects.get(key)!).buffer } : null, delete: async key => { objects.delete(key) } },
    ASSETS: { fetch: async request => { const path = new URL(request.url).pathname; const file = path.startsWith('/assets/') && !path.includes('..') ? path : path.startsWith('/share') ? '/share/index.html' : '/index.html'; return new Response(readFileSync(resolve('website/dist') + file), { headers: { 'Content-Type': extname(file) === '.js' ? 'text/javascript' : extname(file) === '.css' ? 'text/css' : 'text/html' } }) } }
  }
  const handler = createSharingHandler(env, { mail: async (to, _subject, text) => { mails.push({ to, text }) } })
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of incoming) chunks.push(Buffer.from(chunk))
      const input = Buffer.concat(chunks), headers = new Headers(); for (const [key, value] of Object.entries(incoming.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value)
      const response = failSaves && incoming.method === 'PATCH' ? new Response(JSON.stringify({ error: 'Simulated connection failure' }), { status: 503, headers: { 'Content-Type': 'application/json' } }) : await handler(new Request(origin + incoming.url, { method: incoming.method, headers, ...(input.length ? { body: input } : {}) }))
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) { outgoing.writeHead(500); outgoing.end(String(error)) }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`; env.PUBLIC_URL = `${origin}/share`; process.env.EVERKEEP_SHARING_URL = origin
  const service = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), attachmentsRootFactory: id => join(root, id) })
  const stop = registerSharingHandlers(() => service)
  ipcMain.handle('sharing:openRequest', () => null)
  const wrap = (channel: string, fn: () => unknown) => ipcMain.handle(channel, () => ({ ok: true, data: fn() }))
  wrap(IpcChannels.vault.getStatus, () => service.getStatus()); wrap(IpcChannels.vault.getDashboard, () => service.getDashboard()); wrap(IpcChannels.vault.getHandoff, () => service.getHandoff()); wrap(IpcChannels.app.getUpdateStatus, () => ({ state: 'idle' })); ipcMain.handle(IpcChannels.app.getBackupOpenRequest, () => null)
  const desktop = new BrowserWindow({ width: 1280, height: 840, show: false, webPreferences: { preload: resolve('out/preload/index.js'), contextIsolation: true, sandbox: true } })
  const browser = new BrowserWindow({ width: 960, height: 640, show: false, webPreferences: { partition: 'sharing-recipient-test', contextIsolation: true, sandbox: true } })
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const execute = (window: BrowserWindow, source: string) => window.webContents.executeJavaScript(source)
  async function until(window: BrowserWindow, source: string) { for (let i = 0; i < 160; i++) { if (await execute(window, source)) return; await pause(50) } throw new Error(`Timed out ${source}\n${await execute(window, 'document.body.innerText')}`) }
  async function click(window: BrowserWindow, label: string) { await execute(window, `(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw new Error('Unavailable button ' + ${JSON.stringify(label)}); button.click() })()`); await pause(80) }
  async function fill(window: BrowserWindow, label: string, value: string) { await execute(window, `(() => { const item = [...document.querySelectorAll('label')].find(l => l.textContent.includes(${JSON.stringify(label)})); const field = item?.querySelector('input,textarea'); if (!field) throw new Error('Missing field ' + ${JSON.stringify(label)}); const type = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement; Object.getOwnPropertyDescriptor(type.prototype,'value').set.call(field,${JSON.stringify(value)}); field.dispatchEvent(new Event('input',{bubbles:true})) })()`); await pause(50) }
  async function signIn(window: BrowserWindow, email: string) { await until(window, "document.body.innerText.includes('Email me a sign-in code')"); await fill(window, 'Email address', email); await click(window, 'Email me a sign-in code'); await until(window, "document.body.innerText.includes('Six-digit code')"); const code = mails.filter(mail => mail.to === email).at(-1)!.text.match(/\b\d{6}\b/)![0]; await fill(window, 'Six-digit code', code); await click(window, 'Verify and continue'); await until(window, "document.body.innerText.includes('Signed in as')") }
  try {
    service.createVault({ name: 'Family sharing fixture', filePath: join(root, 'family.everkeep') })
    service.createPerson({ fullName: 'Child Recipient', email: 'child@example.com' })
    const record = service.createEntry({ section: 'documents', title: 'Care directions', notes: 'Original directions' })
    service.createEntry({ section: 'letters', title: 'Private letter', notes: 'Not for this recipient' })
    await desktop.loadFile(resolve('out/renderer/index.html'), { hash: '/review' }); await signIn(desktop, 'owner@example.com')
    await click(desktop, 'Enable online sharing'); await until(desktop, "document.body.innerText.includes('Who would you like to share with?')")
    const status = await execute(desktop, 'window.everkeep.sharing.status()'), id = status.local.sharedId
    assert.ok(id)
    await fill(desktop, 'Recipient email', 'child@example.com')
    await execute(desktop, "[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Only information I choose')).querySelector('input').click()")
    await execute(desktop, "[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Care directions')).querySelector('input').click()")
    await click(desktop, 'Review email and share'); await click(desktop, 'Send invitation'); await until(desktop, "document.body.innerText.includes('Invitation emailed to child@example.com')")
    assert.ok(mails.at(-1)!.text.includes(`#vault/${id}`)); assert.ok(mails.at(-1)!.text.includes('View only'))
    for (const width of [1280, 960]) { desktop.setSize(width, width === 960 ? 640 : 840); await pause(150); writeFileSync(resolve(`.everkeep-temp/sharing-owner-${width}.png`), (await desktop.webContents.capturePage()).toPNG()); assert.ok(await execute(desktop, 'document.documentElement.scrollWidth <= innerWidth')) }
    await browser.loadURL(origin)
    await until(browser, "document.querySelector('a[href=\"/share/\"]') !== null")
    await execute(browser, "document.querySelector('a[href=\"/share/\"]').click()")
    await until(browser, "document.body.innerText.includes('Email me a sign-in code')")
    await browser.loadURL(`${origin}/share/#vault/${id}`); await signIn(browser, 'child@example.com'); await until(browser, "document.body.innerText.includes('Accept invitation and open')"); await click(browser, 'Accept invitation and open'); await until(browser, "document.body.innerText.includes('Care directions')")
    assert.ok(!(await execute(browser, 'document.body.innerText')).includes('Private letter'))
    assert.equal(await execute(browser, "[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit record')"), false)
    assert.ok(await execute(browser, "document.querySelector('a[href^=\"everkeep://\"]') !== null"))
    assert.ok(!(await execute(browser, 'document.cookie')).includes('everkeep_session'))
    await execute(desktop, `window.everkeep.sharing.grant(${JSON.stringify(id)}, {email:'child@example.com',scope:{type:'selected',recordIds:[${JSON.stringify(record.id)}]},canEdit:true})`)
    await browser.reload(); await until(browser, "[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit record')")
    await click(browser, 'Edit record'); await fill(browser, 'Notes', 'Collaborator update'); failSaves = true; await click(browser, 'Save changes'); await until(browser, "document.body.innerText.includes('Simulated connection failure')"); assert.ok(await execute(browser, "[...document.querySelectorAll('textarea')].some(t=>t.value==='Collaborator update')")); failSaves = false; await click(browser, 'Save changes'); await until(browser, "document.body.innerText.includes('Changes saved to the shared vault')")
    await execute(desktop, 'window.everkeep.sharing.sync()'); assert.equal(service.listEntries('documents')[0].notes, 'Collaborator update')
    // Simultaneous local and browser edits must produce an explicit source conflict.
    service.updateEntry({ id: record.id, notes: 'Local edit' }); await click(browser, 'Edit record'); await fill(browser, 'Notes', 'Remote edit'); await click(browser, 'Save changes'); await until(browser, "document.body.innerText.includes('Remote edit')")
    await execute(desktop, 'window.everkeep.sharing.sync().catch(()=>{})'); const conflicts = await execute(desktop, 'window.everkeep.sharing.conflicts()'); assert.equal(conflicts.items.length, 1)
    await execute(desktop, `window.everkeep.sharing.sync(${JSON.stringify({ revision: conflicts.revision, fingerprint: conflicts.fingerprint, choices: { [record.id]: 'shared' } })})`); assert.equal(service.listEntries('documents')[0].notes, 'Remote edit')
    for (const width of [1280, 960]) { browser.setSize(width, width === 960 ? 640 : 840); await pause(150); writeFileSync(resolve(`.everkeep-temp/sharing-recipient-${width}.png`), (await browser.webContents.capturePage()).toPNG()); assert.ok(await execute(browser, 'document.documentElement.scrollWidth <= innerWidth')) }
    // The app uses the same recipient permissions, without requiring any local vault.
    await execute(desktop, "window.everkeep.sharing.logout()"); service.closeVault(); await desktop.loadFile(resolve('out/renderer/index.html'), { hash: `/shared?vault=${id}` }); await signIn(desktop, 'child@example.com'); await until(desktop, "document.body.innerText.includes('Remote edit')"); assert.ok(!(await execute(desktop, 'document.body.innerText')).includes('Private letter'))
    const owners = db.prepare('SELECT id FROM users WHERE email=?').get('owner@example.com') as { id: string }; assert.ok(owners.id)
    db.prepare("UPDATE memberships SET status='revoked' WHERE email='child@example.com'").run()
    await browser.reload(); await until(browser, "document.body.innerText.includes('No invitations for this email')"); assert.ok(!(await execute(browser, 'document.body.innerText')).includes('Remote edit'))
    assert.ok([...objects.values()].every(bytes => !Buffer.from(bytes).includes(Buffer.from('Original directions'))))
    console.log('Electron + browser sharing: verified identities, scoped view/edit, email preview, failed saves, source synchronization, conflict resolution, no-local-file recipient access, revocation and both window sizes passed.')
  } finally { stop(); desktop.destroy(); browser.destroy(); service.closeVault(); await new Promise<void>(resolve => server.close(() => resolve())); db.close(); rmSync(root, { recursive: true, force: true }) }
}).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1) })

import { queueAccessFile } from '../src/main/files/AccessFileRequests'
import { authFixture } from '../tests/fixtures/sharing-auth'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
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
  ipcMain.handle(IpcChannels.vault.updateHandoff, (_event, input) => ({ ok: true, data: service.updateHandoff(input) }))
  wrap(IpcChannels.vault.getStatus, () => service.getStatus()); wrap(IpcChannels.vault.getDashboard, () => service.getDashboard()); wrap(IpcChannels.vault.getHandoff, () => service.getHandoff()); wrap(IpcChannels.app.getUpdateStatus, () => ({ state: 'idle' })); ipcMain.handle(IpcChannels.app.getBackupOpenRequest, () => null)
  const desktop = new BrowserWindow({ width: 1280, height: 840, show: false, webPreferences: { preload: resolve('out/preload/index.js'), contextIsolation: true, sandbox: true } })
  const browser = new BrowserWindow({ width: 960, height: 640, show: false, webPreferences: { partition: 'sharing-recipient-test', contextIsolation: true, sandbox: true } })
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const execute = async (window: BrowserWindow, source: string) => { try { return await window.webContents.executeJavaScript(source) } catch (error) { throw new Error(`Failed browser action: ${source.slice(0, 220)}\n${await window.webContents.executeJavaScript('document.body.innerText')}`, { cause: error }) } }
  async function until(window: BrowserWindow, source: string) { for (let i = 0; i < 160; i++) { if (await execute(window, source)) return; await pause(50) } throw new Error(`Timed out ${source}\n${await execute(window, 'document.body.innerText')}`) }
  async function click(window: BrowserWindow, label: string) { await execute(window, `(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw new Error('Unavailable button ' + ${JSON.stringify(label)}); for (let node = button.parentElement; node; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true; button.click() })()`); await pause(80) }
  async function fill(window: BrowserWindow, label: string, value: string) { await execute(window, `(() => { const item = [...document.querySelectorAll('label')].find(l => l.textContent.includes(${JSON.stringify(label)})); const field = item?.querySelector('input,textarea'); if (!field) throw new Error('Missing field ' + ${JSON.stringify(label)}); const type = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement; Object.getOwnPropertyDescriptor(type.prototype,'value').set.call(field,${JSON.stringify(value)}); field.dispatchEvent(new Event('input',{bubbles:true})) })()`); await pause(50) }
  async function openRecord(window: BrowserWindow, title: string) { await until(window, "document.body.innerText.includes('All information') && document.querySelector('.ek-record-link, .ek-library-filters') !== null"); await click(window, 'All information'); await until(window, "document.querySelector('.ek-library-filters') !== null"); await execute(window, `(() => { const item = [...document.querySelectorAll('.ek-record-link strong')].find(node => node.textContent === ${JSON.stringify(title)}); if (!item) throw new Error('Missing record'); item.closest('button').click() })()`); await pause(80) }
  async function signIn(window: BrowserWindow, email: string) { await until(window, "document.body.innerText.includes('Email me a sign-in code')"); await fill(window, 'Email address', email); await click(window, 'Email me a sign-in code'); await until(window, "document.body.innerText.includes('Six-digit code')"); const code = mails.filter(mail => mail.to === email).at(-1)!.text.match(/\b\d{6}\b/)![0]; await fill(window, 'Six-digit code', code); await click(window, 'Verify and continue'); await until(window, "document.body.textContent.includes('Signed in as')") }
  try {
    service.createVault({ name: 'Family sharing fixture', filePath: join(root, 'family.everkeep') })
    const recipient = service.createPerson({ fullName: 'Child Recipient', email: 'child@example.com' })
    const record = service.createEntry({ section: 'documents', title: 'Care directions', notes: 'Original directions' })
    service.createEntry({ section: 'letters', title: 'Private letter', notes: 'Not for this recipient' })
    const personalLetter = service.createEntry({ section: 'letters', title: 'A few things I want you to know', fields: { recipient: recipient.id, date: '2026-09-22', body: 'My dear family,\n\nThere is no need to figure everything out today. I put these things together so you would have a little less to carry.\n\nRemember the summers by the lake, the long breakfasts, and the way we always found something to laugh about. ' + 'Those ordinary days meant everything to me. '.repeat(30) + '\n\nWith all my love.' } })
    const letterSource = join(root, 'a-memory.txt'); writeFileSync(letterSource, 'A memory from the lake.')
    service.attachFile(personalLetter.id, letterSource)
    service.updateHandoff({ ...service.getHandoff(), careInstructions: 'Take a breath. Call someone you trust before you begin.', primaryContactId: recipient.id, incapacityInstructions: 'Please start with the care directions.', deathInstructions: 'The original documents are in the study.' })
    const moreDocuments = Array.from({ length: 12 }, (_, index) => service.createEntry({ section: 'documents', title: `Family document ${String(index + 1).padStart(2, '0')}` }))
    const bank = service.createAccount({ institution: 'Family bank', accountType: 'checking', fullAccountNumber: '987654321234' })
    const introId = service.getSharingSnapshot().records.find(record => record.kind === 'handoff')!.id
    await desktop.loadFile(resolve('out/renderer/index.html'), { hash: '/review' }); await signIn(desktop, 'owner@example.com')
    await fill(desktop, 'Welcome message', 'I made this space for you.\n\nYou can start with my letter, or simply find what you need. There is no rush.')
    await fill(desktop, 'Signature or display name', 'With love, Mom')
    await execute(desktop, `(() => { const select = [...document.querySelectorAll('label')].find(label => label.textContent.includes('Featured letter')).querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${JSON.stringify(personalLetter.id)}); select.dispatchEvent(new Event('change', { bubbles: true })) })()`)
    await click(desktop, 'Save welcome'); await until(desktop, "document.body.innerText.includes('Welcome saved.')")
    assert.equal(service.getHandoff().featuredLetterId, personalLetter.id)
    await click(desktop, 'Register file-based sharing'); await until(desktop, "document.body.innerText.includes('Who would you like to share with?')")
    const status = await execute(desktop, 'window.everkeep.sharing.status()'), id = status.local.sharedId
    assert.ok(id)
    await fill(desktop, 'Recipient email', 'child@example.com')
    await execute(desktop, "[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Only information I choose')).querySelector('input').click()")
    await execute(desktop, "[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Care directions')).querySelector('input').click()")
    await click(desktop, 'Preview recipient experience')
    assert.ok(!(await execute(desktop, "document.querySelector('.ek-recipient-preview').innerText")).includes('With love, Mom'))
    assert.ok(!(await execute(desktop, "document.querySelector('.ek-recipient-preview').innerText")).includes('Private letter'))
    await click(desktop, 'Close recipient preview')
    await click(desktop, 'Review email and share'); await click(desktop, 'Send invitation'); await until(desktop, "document.body.innerText.includes('Invitation emailed to child@example.com')")
    assert.ok(mails.at(-1)!.text.includes(`#vault/${id}`)); assert.ok(mails.at(-1)!.text.includes('View only'))
    for (const width of [1280, 960]) { desktop.setSize(width, width === 960 ? 640 : 840); await pause(150); writeFileSync(resolve(`.everkeep-temp/sharing-owner-${width}.png`), (await desktop.webContents.capturePage()).toPNG()); assert.ok(await execute(desktop, 'document.documentElement.scrollWidth <= innerWidth')) }
    await browser.loadURL(origin)
    await until(browser, "document.querySelector('a[href=\"/share/\"]') !== null")
    await execute(browser, "document.querySelector('a[href=\"/share/\"]').click()")
    await until(browser, "document.body.innerText.includes('Email me a sign-in code')")
    assert.equal(objects.size, 0, 'File registration and invitations must not upload contents')
    const accessPath = join(root, 'recipient.everkeep')
    const originalDialog = dialog.showSaveDialog
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: accessPath })) as typeof dialog.showSaveDialog
    try { await execute(desktop, 'window.everkeep.sharing.saveSharedFile()') } finally { dialog.showSaveDialog = originalDialog }
    const accessFile = readFileSync(accessPath, 'utf8')
    assert.ok(!accessFile.includes('Not for this recipient'))
    assert.equal(objects.size, 0, 'Saving a recipient file must not upload contents')
    await browser.loadURL(`${origin}/share/#vault/${id}`); await signIn(browser, 'child@example.com'); await until(browser, "document.body.innerText.includes('Accept invitation and open')"); await click(browser, 'Accept invitation and open')
    await execute(browser, `(() => { const input = document.querySelector('input[type=file]'); const transfer = new DataTransfer(); transfer.items.add(new File([${JSON.stringify(accessFile)}], 'recipient.everkeep')); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true})) })()`)
    await openRecord(browser, 'Care directions')
    assert.ok(!(await execute(browser, 'document.body.innerText')).includes('Private letter'))
    assert.equal(await execute(browser, "[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit record')"), false)
    assert.ok(await execute(browser, "document.querySelector('a[href^=\"everkeep://\"]') !== null"))
    assert.ok(!(await execute(browser, 'document.cookie')).includes('everkeep_session'))
    await execute(desktop, `window.everkeep.sharing.grant(${JSON.stringify(id)}, {email:'child@example.com',scope:{type:'selected',recordIds:[${JSON.stringify(record.id)}]},canEdit:true})`)
    // Re-select the file to refresh its grant immediately without caching decrypted data.
    await execute(browser, `(() => { const input = document.querySelector('input[type=file]'); const transfer = new DataTransfer(); transfer.items.add(new File([${JSON.stringify(accessFile)}], 'recipient.everkeep')); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true})) })()`)
    await click(browser, 'Back to vaults'); await click(browser, 'Open vault'); await openRecord(browser, 'Care directions')
    await until(browser, "[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit record')")
    await click(browser, 'Edit record'); await fill(browser, 'Notes', 'A change to this file only'); await click(browser, 'Save changes')
    await until(browser, "document.body.innerText.includes('Save an updated Everkeep file to keep them')")
    assert.equal(objects.size, 0)
    assert.equal(service.listEntries('documents').find(item => item.id === record.id)!.notes, 'Original directions')
    const savedCopy = join(root, 'collaborator-copy.everkeep')
    const completed = new Promise<void>((resolve, reject) => browser.webContents.session.once('will-download', (_event, item) => { item.setSavePath(savedCopy); item.once('done', (_event, state) => state === 'completed' ? resolve() : reject(new Error(state))) }))
    await click(browser, 'Save updated Everkeep file'); await completed
    assert.ok(readFileSync(savedCopy, 'utf8').includes('everkeep-access'))
    await click(browser, 'Close file')
    await click(desktop, 'Enable online sharing')
    await until(desktop, "document.body.innerText.includes('Synchronized')")
    await browser.reload()
    await openRecord(browser, 'Care directions')
    await execute(desktop, `window.everkeep.sharing.grant(${JSON.stringify(id)}, {email:'child@example.com',scope:{type:'selected',recordIds:[${JSON.stringify(record.id)}]},canEdit:true})`)
    await browser.reload(); await openRecord(browser, 'Care directions'); await until(browser, "[...document.querySelectorAll('button')].some(b=>b.textContent==='Edit record')")
    await click(browser, 'Edit record'); await fill(browser, 'Notes', 'Collaborator update'); failSaves = true; await click(browser, 'Save changes'); await until(browser, "document.body.innerText.includes('Simulated connection failure')"); assert.ok(await execute(browser, "[...document.querySelectorAll('textarea')].some(t=>t.value==='Collaborator update')")); failSaves = false; await click(browser, 'Save changes'); await until(browser, "document.body.innerText.includes('Changes saved to the shared vault')")
    await execute(desktop, 'window.everkeep.sharing.sync()'); assert.equal(service.listEntries('documents').find(item => item.id === record.id)!.notes, 'Collaborator update')
    // Simultaneous local and browser edits must produce an explicit source conflict.
    service.updateEntry({ id: record.id, notes: 'Local edit' }); await click(browser, 'Edit record'); await fill(browser, 'Notes', 'Remote edit'); await click(browser, 'Save changes'); await until(browser, "document.body.innerText.includes('Remote edit')")
    await execute(desktop, 'window.everkeep.sharing.sync().catch(()=>{})'); const conflicts = await execute(desktop, 'window.everkeep.sharing.conflicts()'); assert.equal(conflicts.items.length, 1)
    await execute(desktop, `window.everkeep.sharing.sync(${JSON.stringify({ revision: conflicts.revision, fingerprint: conflicts.fingerprint, choices: { [record.id]: 'shared' } })})`); assert.equal(service.listEntries('documents').find(item => item.id === record.id)!.notes, 'Remote edit')
    for (const width of [1280, 960]) { browser.setSize(width, width === 960 ? 640 : 840); await pause(150); writeFileSync(resolve(`.everkeep-temp/sharing-recipient-${width}.png`), (await browser.webContents.capturePage()).toPNG()); assert.ok(await execute(browser, 'document.documentElement.scrollWidth <= innerWidth')) }
    // A personal home uses only the newly permitted records, in browser and file readers.
    const personalScope = { type: 'selected', recordIds: [record.id, personalLetter.id, introId, recipient.id, bank.id, ...moreDocuments.map(record => record.id)] }
    await execute(desktop, `window.everkeep.sharing.grant(${JSON.stringify(id)}, ${JSON.stringify({ email: 'child@example.com', scope: personalScope, canEdit: true })})`)
    await browser.reload(); await until(browser, "document.body.innerText.includes('With love, Mom')")
    assert.ok(!(await execute(browser, 'document.body.innerText')).includes('Private letter'))
    assert.ok(await execute(browser, "document.querySelector('.ek-featured-letter').innerText.includes('My dear family,')"))
    assert.ok(!(await execute(browser, 'document.body.innerText')).includes('Collaborator update'))
    for (const width of [1280, 390]) { browser.setSize(width, width === 390 ? 844 : 900); await pause(150); writeFileSync(resolve(`.everkeep-temp/sharing-personal-home-${width}.png`), (await browser.webContents.capturePage()).toPNG()); assert.ok(await execute(browser, 'document.documentElement.scrollWidth <= innerWidth')) }
    await click(browser, 'Read the letter')
    assert.ok(await execute(browser, "document.activeElement.tagName === 'H1'"))
    assert.ok(!(await execute(browser, 'document.body.innerText')).includes('Private?'))
    assert.ok(await execute(browser, "document.querySelector('.ek-letter-body').textContent.includes('With all my love.')"))
    writeFileSync(resolve('.everkeep-temp/sharing-personal-letter-390.png'), (await browser.webContents.capturePage()).toPNG())
    const downloadedLetter = join(root, 'downloaded-memory.txt')
    const attachedDownload = new Promise<void>((resolve, reject) => browser.webContents.session.once('will-download', (_event, item) => { item.setSavePath(downloadedLetter); item.once('done', (_event, state) => state === 'completed' ? resolve() : reject(new Error(state))) }))
    await click(browser, 'Save attachment: a-memory.txt'); await attachedDownload; assert.equal(readFileSync(downloadedLetter, 'utf8'), 'A memory from the lake.')
    // A normal background refresh must preserve the reading page.
    await pause(15500); assert.ok(await execute(browser, "document.querySelector('.ek-letter-body') !== null"))
    await click(browser, 'Edit record'); await click(browser, 'Cancel'); assert.ok(await execute(browser, "document.activeElement.tagName === 'H1'"))
    await click(browser, 'Welcome'); await click(browser, 'If I cannot help'); assert.ok(await execute(browser, "document.body.innerText.includes('Please start with the care directions.')"))
    await click(browser, 'Welcome'); await click(browser, 'View contact'); assert.ok(await execute(browser, "document.body.innerText.includes('child@example.com')"))
    await click(browser, 'All information'); await fill(browser, 'Search by title', 'Private'); assert.ok(await execute(browser, "document.body.innerText.includes('No information matches')"))
    await openRecord(browser, 'Family bank'); assert.ok(!(await execute(browser, 'document.body.innerText')).includes('987654321234'))
    await click(browser, 'Show'); assert.ok(await execute(browser, "document.body.innerText.includes('987654321234')"))
    await click(browser, 'Welcome'); await openRecord(browser, 'Family bank'); assert.ok(!(await execute(browser, 'document.body.innerText')).includes('987654321234'))
    await click(browser, 'All information'); assert.ok(await execute(browser, 'document.querySelectorAll(".ek-record-link").length >= 15'))
    writeFileSync(resolve('.everkeep-temp/sharing-personal-library-390.png'), (await browser.webContents.capturePage()).toPNG())
    // Remove the open letter during a live session; the next authorization refresh clears it.
    await click(browser, 'Welcome'); await click(browser, 'Read the letter')
    await execute(desktop, `window.everkeep.sharing.grant(${JSON.stringify(id)}, ${JSON.stringify({ email: 'child@example.com', scope: { type: 'selected', recordIds: [record.id] }, canEdit: true })})`)
    await pause(15500); assert.ok(!(await execute(browser, 'document.body.innerText')).includes('My dear family,')); assert.ok(await execute(browser, "document.querySelector('.ek-welcome') !== null"))
    await execute(desktop, `window.everkeep.sharing.grant(${JSON.stringify(id)}, ${JSON.stringify({ email: 'child@example.com', scope: personalScope, canEdit: true })})`)
    assert.equal(queueAccessFile(accessPath), id)
    // The app uses the same recipient permissions, without requiring any local vault.
    await execute(desktop, "window.everkeep.sharing.logout()"); service.closeVault(); await desktop.loadFile(resolve('out/renderer/index.html'), { hash: `/shared?vault=${id}` }); await signIn(desktop, 'child@example.com'); await openRecord(desktop, 'Care directions'); await until(desktop, "document.body.innerText.includes('Original directions')"); assert.ok(!(await execute(desktop, 'document.body.innerText')).includes('Private letter'))
    const owners = db.prepare('SELECT id FROM users WHERE email=?').get('owner@example.com') as { id: string }; assert.ok(owners.id)
    db.prepare("UPDATE memberships SET status='revoked' WHERE email='child@example.com'").run()
    await browser.reload(); await until(browser, "document.body.innerText.includes('No invitations for this email')"); assert.ok(!(await execute(browser, 'document.body.innerText')).includes('Remote edit'))
    assert.ok([...objects.values()].every(bytes => !Buffer.from(bytes).includes(Buffer.from('Original directions'))))
    console.log('Electron + browser sharing: verified identities, scoped view/edit, email preview, failed saves, source synchronization, conflict resolution, no-local-file recipient access, revocation and both window sizes passed.')
  } finally { stop(); desktop.destroy(); browser.destroy(); service.closeVault(); await new Promise<void>(resolve => server.close(() => resolve())); db.close(); rmSync(root, { recursive: true, force: true }) }
}).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1) })

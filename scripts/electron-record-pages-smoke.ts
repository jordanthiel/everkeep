import { app, BrowserWindow, ipcMain } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { VaultService } from '../src/main/services/VaultService'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { IpcChannels } from '../src/shared/types/ipc'
import type { VaultSectionId } from '../src/shared/types/entry'

const root = mkdtempSync(join(tmpdir(), 'everkeep-record-pages-'))
app.setPath('userData', root)
app.whenReady().then(async () => {
  const service = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), attachmentsRootFactory: id => join(root, id) })
  const window = new BrowserWindow({ width: 1280, height: 840, show: false, webPreferences: { preload: resolve('out/preload/index.js'), contextIsolation: true, sandbox: true } })
  let failSave = false
  let failList = false
  let delayList = false
  let delaySave = false
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  function handle<T>(channel: string, fn: (input: T) => unknown) {
    ipcMain.handle(channel, async (_event, input: T) => {
      try { return { ok: true, data: await fn(input) } }
      catch (error) { return { ok: false, error: { code: 'TEST_FAILURE', message: String(error) } } }
    })
  }
  const execute = (source: string) => window.webContents.executeJavaScript(source)
  async function until(source: string, message = source) {
    for (let i = 0; i < 120; i++) { if (await execute(source)) return; await pause(50) }
    throw new Error(`Timed out: ${message}`)
  }
  const click = async (label: string) => {
    await execute(`(() => { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw new Error('Button unavailable: ' + ${JSON.stringify(label)}); button.focus(); button.click() })()`)
    await pause(80)
  }
  const input = async (id: string, value: string) => {
    await execute(`(() => { const field = document.getElementById(${JSON.stringify(id)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await pause(50)
  }
  async function route(path: string) {
    await window.loadFile(resolve('out/renderer/index.html'), { hash: path })
    await until("Boolean(document.querySelector('[data-add-record], [data-record-form]'))")
  }
  try {
    service.createVault({ name: 'Records layout test', filePath: join(root, 'test.everkeep') })
    const person = service.createPerson({ fullName: 'Alex Example', relationship: 'friend' })
    service.createAccount({ institution: 'Example Bank', accountType: 'checking', accountName: 'Everyday account' })
    const document = service.createEntry({ section: 'documents', title: 'House deed', kind: 'deed' })
    const file = join(root, 'fixture.txt'); writeFileSync(file, 'UI test attachment')
    service.attachFile(document.id, file)
    service.createEntry({ section: 'identity', title: 'Passport', kind: 'passport', fields: { personId: person.id }, sensitiveFields: { number: '123456789' } })
    handle(IpcChannels.vault.getStatus, () => service.getStatus())
    handle(IpcChannels.vault.getDashboard, () => service.getDashboard())
    handle(IpcChannels.people.list, () => service.listPeople())
    handle(IpcChannels.people.create, async (input: Parameters<typeof service.createPerson>[0]) => {
      if (delaySave) await pause(600)
      if (failSave) throw new Error('Save failed for test')
      return service.createPerson(input)
    })
    handle(IpcChannels.people.update, (input: Parameters<typeof service.updatePerson>[0]) => service.updatePerson(input))
    handle(IpcChannels.accounts.list, async () => { if (delayList) await pause(600); if (failList) throw new Error('Load failed for test'); return service.listAccounts() })
    handle(IpcChannels.accounts.create, (input: Parameters<typeof service.createAccount>[0]) => service.createAccount(input))
    handle(IpcChannels.accounts.update, (input: Parameters<typeof service.updateAccount>[0]) => service.updateAccount(input))
    handle(IpcChannels.entries.list, ({ section }: { section: VaultSectionId }) => service.listEntries(section))
    handle(IpcChannels.entries.create, (input: Parameters<typeof service.createEntry>[0]) => service.createEntry(input))
    handle(IpcChannels.entries.update, (input: Parameters<typeof service.updateEntry>[0]) => service.updateEntry(input))
    handle(IpcChannels.attachments.list, ({ entryId }: { entryId: string }) => service.listAttachments(entryId))
    ipcMain.handle('sharing:openRequest', () => null)
    ipcMain.handle('sharing:setEditing', () => {})
    ipcMain.handle('sharing:status', () => ({ configured: false, account: null, local: null, url: '' }))
    ipcMain.handle(IpcChannels.app.getBackupOpenRequest, () => null)
    handle(IpcChannels.app.getUpdateStatus, () => ({ state: 'idle' }))
    handle(IpcChannels.license.getStatus, () => ({ activated: true, entitlement: 'lifetime' }))

    for (const [width, height] of [[1280, 840], [960, 640]]) {
      window.setSize(width, height)
      for (const path of ['/people', '/financial', '/documents', '/identity']) {
        await route(path)
        await until("Boolean(document.querySelector('[data-record-id]'))")
        assert.equal(await execute("Boolean(document.querySelector('[data-record-form]'))"), false)
        assert.ok(await execute("document.querySelector('[data-record-id]').getBoundingClientRect().top < innerHeight - 80"), `${path} first record visible at ${width}×${height}`)
        assert.ok(await execute("document.querySelector('[data-add-record]').getBoundingClientRect().bottom < innerHeight"))
        if (path === '/financial') writeFileSync(resolve(`.everkeep-temp/records-${width}.png`), (await window.webContents.capturePage()).toPNG())
      }
    }
    // Existing cards retain attachments and person grouping.
    await route('/documents'); await until("document.body.textContent.includes('fixture.txt')")
    await route('/identity'); await until("document.body.textContent.includes('Alex Example')")
    await route('/people')
    await click('Edit')
    assert.equal(await execute('document.activeElement.id'), 'personName')
    assert.equal(await execute("document.body.textContent.includes('Mark complete & continue')"), false)
    await click('Cancel')
    assert.equal(await execute("Boolean(document.querySelector('[role=alertdialog]'))"), false, 'Untouched edit closes immediately')
    assert.equal(await execute('document.activeElement.textContent.trim()'), 'Edit')
    await click('Add contact'); await input('personName', 'New contact')
    await click('Cancel'); await until("Boolean(document.querySelector('[role=alertdialog]'))")
    await click('Keep editing')
    assert.equal(await execute('document.activeElement.textContent.trim()'), 'Cancel')
    assert.equal(await execute("document.getElementById('personName').value"), 'New contact')
    failSave = true
    await click('Save contact'); await until("document.body.textContent.includes('Save failed for test')")
    assert.equal(await execute("document.getElementById('personName').value"), 'New contact')
    failSave = false; delaySave = true
    await click('Save contact')
    assert.ok(await execute("Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Cancel').disabled"))
    await until("!document.querySelector('[data-record-form]')")
    assert.ok(await execute("document.activeElement.matches('[data-record-id]') && document.activeElement.textContent.includes('New contact')"))
    assert.ok(await execute("document.activeElement.classList.contains('ring-2')"))
    await click('Add contact'); await input('personName', 'Discard me'); await click('Back to records'); await click('Discard changes')
    assert.equal(service.listPeople().length, 2)

    await route('/financial'); await click('Add account')
    assert.ok(await execute("(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Save account').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight })()"), 'Sticky save visible at top of long form')
    writeFileSync(resolve('.everkeep-temp/record-editor-960.png'), (await window.webContents.capturePage()).toPNG())
    await input('institution', 'Second Bank'); await click('Save account')
    await until("!document.querySelector('[data-record-form]')")
    assert.equal(service.listAccounts().length, 2)
    const account = service.listAccounts().find(item => item.institution === 'Second Bank')!
    await route(`/financial?edit=${account.id}`)
    await until("Boolean(document.getElementById('institution'))")
    await input('institution', 'Updated Bank'); await click('Save account')
    await until("!document.querySelector('[data-record-form]')")
    assert.equal(service.listAccounts().find(item => item.id === account.id)?.institution, 'Updated Bank')
    await route('/financial?edit=missing'); await until("document.body.textContent.includes('no longer available')")
    await route('/documents?edit=missing'); await until("document.body.textContent.includes('no longer available')")
    await route(`/identity?personId=${person.id}&kind=passport`)
    await until("Boolean(document.querySelector('[data-record-form]'))")
    assert.equal(await execute("document.getElementById('identity-kind').value"), 'passport')
    await click('Cancel')
    assert.equal(await execute("Boolean(document.querySelector('[role=alertdialog]'))"), false)
    await route(`/documents?edit=${document.id}`)
    await until("Boolean(document.getElementById('documents-title'))")
    await input('documents-title', 'Updated house deed'); await click('Save document')
    await until("!document.querySelector('[data-record-form]')")
    assert.equal(service.listEntries('documents')[0].title, 'Updated house deed')
    await route('/documents'); await click('Add document'); await input('documents-title', 'Another document'); await click('Save document')
    await until("!document.querySelector('[data-record-form]')")
    assert.equal(service.listEntries('documents').length, 2)
    await route('/taxes'); await until("document.body.textContent.includes('Add your first')")
    assert.equal(await execute("Boolean(document.querySelector('[data-record-form]'))"), false)

    // Long collections restore the edited row and previous scroll position on cancel.
    for (let i = 0; i < 16; i++) service.createPerson({ fullName: `Contact ${i}` })
    await route('/people'); await until("document.querySelectorAll('[data-record-id]').length === 18")
    await execute("(() => { const record = Array.from(document.querySelectorAll('[data-record-id]')).at(-1); record.scrollIntoView(); const button = Array.from(record.querySelectorAll('button')).find(b => b.textContent.trim() === 'Edit'); button.focus(); })()")
    const scrollTop = await execute("document.querySelector('main').scrollTop")
    await execute('document.activeElement.click()'); await until("Boolean(document.querySelector('[data-record-form]'))")
    await click('Cancel')
    assert.equal(await execute("document.querySelector('main').scrollTop"), scrollTop)
    assert.equal(await execute('document.activeElement.textContent.trim()'), 'Edit')
    await click('Add contact'); await input('personName', 'Unsaved navigation')
    await execute("document.querySelector('nav[aria-label=\"Topic location\"] a').click()")
    await until("document.body.textContent.includes('You have an unfinished record')")
    await click('Keep editing'); await click('Cancel'); await click('Discard changes')

    delayList = true; failList = true
    await route('/financial')
    await until("document.body.textContent.includes('Loading records…')")
    await until("document.body.textContent.includes('Unable to load records.')")
    assert.equal(await execute("document.body.textContent.includes('Add your first')"), false)
    failList = false; await click('Try again'); await until("Boolean(document.querySelector('[data-record-id]'))")
    console.log('Records UI: viewport visibility, collection states, focus, create/edit/save/cancel, discard protection, failed saves, retry, deep links, grouping and attachments passed.')
  } finally {
    window.destroy(); service.closeVault(); rmSync(root, { recursive: true, force: true })
  }
  app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })

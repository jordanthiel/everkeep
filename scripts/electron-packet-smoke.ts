import { app, BrowserWindow, ipcMain } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { VaultService } from '../src/main/services/VaultService'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { IpcChannels } from '../src/shared/types/ipc'
import { EMPTY_HANDOFF } from '../src/shared/types/handoff'
import type { PacketDraft } from '../src/shared/types/packet'
import type { VaultSectionId } from '../src/shared/types/entry'

const root = mkdtempSync(join(tmpdir(), 'everkeep-packet-ui-'))
app.setPath('userData', root)
app.whenReady().then(async () => {
  const service = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), attachmentsRootFactory: id => join(root, id) })
  const window = new BrowserWindow({ width: 1280, height: 840, show: false, webPreferences: { preload: resolve('out/preload/index.js'), contextIsolation: true, sandbox: true } })
  let failDraft = false
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  function handle<T>(channel: string, fn: (input: T) => unknown) {
    ipcMain.handle(channel, async (_event, input: T) => {
      try { return { ok: true, data: await fn(input) } }
      catch (error) { return { ok: false, error: { code: 'TEST_FAILURE', message: String(error) } } }
    })
  }
  const execute = (source: string) => window.webContents.executeJavaScript(source)
  async function until(source: string) {
    for (let i = 0; i < 120; i++) { if (await execute(source)) return; await pause(50) }
    throw new Error(`Timed out: ${source}\n${await execute('document.body.innerText')}`)
  }
  async function click(label: string) {
    await execute(`(() => { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw new Error('Unavailable: ' + ${JSON.stringify(label)}); button.focus(); button.click() })()`)
    await pause(60)
  }
  async function input(id: string, value: string) {
    await execute(`(() => { const field = document.getElementById(${JSON.stringify(id)}); const type = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement : field.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement; Object.getOwnPropertyDescriptor(type.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event(type === HTMLSelectElement ? 'change' : 'input', { bubbles: true })) })()`)
    await pause(50)
  }
  async function route(path: string) {
    await window.loadURL('about:blank')
    await window.loadFile(resolve('out/renderer/index.html'), { hash: path })
    await until("Boolean(document.querySelector('main h1'))")
  }
  const saved = () => until("document.body.textContent.includes('Draft saved in this vault')")
  try {
    const session = service.createVault({ name: 'Packet UI fixture', filePath: join(root, 'test.everkeep') })
    const alex = service.createPerson({ fullName: 'Alex Example', phone: '111-1111' })
    const helper = service.createPerson({ fullName: 'Sam Helper', phone: '222-2222' })
    const entry = service.createEntry({ section: 'documents', title: 'Document fixture' })
    service.updateHandoff({ ...EMPTY_HANDOFF, primaryContactId: alex.id, alternateContactId: helper.id, careInstructions: 'Care priorities', incapacityInstructions: 'Unavailable instructions', deathInstructions: 'Death instructions', passwordInstructions: 'Access secret' })
    handle(IpcChannels.vault.getStatus, () => service.getStatus())
    handle(IpcChannels.vault.getDashboard, () => service.getDashboard())
    handle(IpcChannels.vault.getHandoff, () => service.getHandoff())
    handle(IpcChannels.vault.updateHandoff, (input: Parameters<typeof service.updateHandoff>[0]) => service.updateHandoff(input))
    handle(IpcChannels.vault.getExportCatalog, () => service.getExportCatalog())
    handle(IpcChannels.vault.getPacketDraft, () => service.getPacketDraft())
    handle(IpcChannels.vault.savePacketDraft, ({ draft, vaultId }: { draft: PacketDraft; vaultId: string }) => {
      if (vaultId !== service.getStatus().session?.metadata.id) throw new Error('Vault changed')
      if (failDraft) throw new Error('Draft disk failure')
      return service.savePacketDraft(draft)
    })
    handle(IpcChannels.vault.clearPacketDraft, () => service.clearPacketDraft())
    handle(IpcChannels.vault.previewReport, (input: Parameters<typeof service.previewReport>[0]) => service.previewReport(input))
    handle(IpcChannels.vault.pickExportPath, () => join(root, 'packet.html'))
    handle(IpcChannels.vault.exportReport, (input: Parameters<typeof service.exportReport>[0]) => service.exportReport(input))
    handle(IpcChannels.people.list, () => service.listPeople())
    handle(IpcChannels.accounts.list, () => service.listAccounts())
    handle(IpcChannels.entries.list, ({ section }: { section: VaultSectionId }) => service.listEntries(section))
    handle(IpcChannels.review.list, () => service.listReviewItems())
    ipcMain.handle('sharing:openRequest', () => null)
    ipcMain.handle('sharing:setEditing', () => {})
    ipcMain.handle('sharing:snapshot', () => service.getSharingSnapshot())
    ipcMain.handle('sharing:conflicts', () => null)
    ipcMain.handle('sharing:status', () => ({ configured: false, account: null, local: null, url: '' }))
    ipcMain.handle(IpcChannels.app.getBackupOpenRequest, () => null)
    handle(IpcChannels.app.getUpdateStatus, () => ({ state: 'idle' }))
    handle(IpcChannels.license.getStatus, () => ({ activated: true, entitlement: 'lifetime' }))

    for (const width of [1280, 960]) {
      window.setSize(width, width === 960 ? 640 : 840)
      await route('/finish'); await until("Boolean(document.querySelector('a[href=\"#/export\"]'))")
      assert.ok(await execute("document.body.innerText.includes('Export an unencrypted readable copy')"))
      writeFileSync(resolve(`.everkeep-temp/share-home-${width}.png`), (await window.webContents.capturePage()).toPNG())
      await route('/export'); await until("Boolean(document.getElementById('packet-recipient'))")
      assert.equal(await execute("document.getElementById('packet-scenario').value"), 'both')
      assert.ok(await execute("document.querySelector('ol[aria-label=\"Packet progress\"]').getBoundingClientRect().bottom < innerHeight"))
      await saved()
      writeFileSync(resolve(`.everkeep-temp/packet-recipient-${width}.png`), (await window.webContents.capturePage()).toPNG())
    }
    await input('packet-recipient', alex.id)
    await click('Continue to contents')
    assert.equal(await execute('document.activeElement.textContent'), 'Contents')
    // Editing selections then switching presets requires confirmation.
    await execute("Array.from(document.querySelectorAll('label')).find(label => label.textContent.includes('Document fixture')).querySelector('input').click()")
    await click('Care information'); await until("Boolean(document.querySelector('dialog[open]'))")
    await click('Keep current draft')
    assert.ok(await execute("Array.from(document.querySelectorAll('label')).find(label => label.textContent.includes('Document fixture')).querySelector('input').checked"))
    await click('Continue to introduction')
    assert.ok(await execute("document.body.textContent.includes('Sam Helper')"))
    assert.equal(await execute("Array.from(document.querySelectorAll('select option')).some(option => option.value === " + JSON.stringify(alex.id) + ")"), false)
    writeFileSync(resolve('.everkeep-temp/packet-introduction-960.png'), (await window.webContents.capturePage()).toPNG())
    await input('packet-careInstructions', 'Packet-specific priorities')
    await click('Continue to preview and save')
    await saved()
    await click('Preview packet'); await until("Boolean(document.querySelector('iframe'))")
    const html = await execute("document.querySelector('iframe').srcdoc")
    assert.ok(html.includes('Unavailable instructions') && html.includes('Death instructions'))
    assert.ok(html.includes('222-2222') && !html.includes('111-1111'))
    assert.ok(!html.includes('Access secret'))
    assert.equal(service.getHandoff().careInstructions, 'Care priorities')
    await click('Save this preview'); await until("document.body.textContent.includes('Packet saved—it has not been sent')")
    await saved()
    assert.equal(readFileSync(join(root, 'packet.html'), 'utf8'), html)
    await click('I gave this packet to Alex Example'); await saved()
    assert.ok(service.getPacketDraft()?.latestExport?.deliveredAt)
    assert.equal(service.getHandoff().handoffTestedAt, '')
    await route('/export?preset=spouse&scenario=death'); await until("document.body.textContent.includes('Preview and save')"); await saved()
    assert.equal(service.getPacketDraft()?.scenario, 'both')
    assert.equal(await execute("Boolean(document.querySelector('iframe'))"), false)
    assert.ok(await execute("Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Save this preview').disabled"))
    await click('Back'); await until("Boolean(document.getElementById('packet-careInstructions'))")
    await saved()
    failDraft = true
    await input('packet-careInstructions', 'Keep after save failure')
    await execute("document.querySelector('a[href=\"#/finish\"]').click()")
    await until("document.body.textContent.includes('Draft disk failure')")
    assert.ok(await execute("location.hash.startsWith('#/export')"))
    await click('Keep editing')
    assert.equal(await execute("document.getElementById('packet-careInstructions').value"), 'Keep after save failure')
    failDraft = false
    await click('Retry saving draft'); await saved()
    // Leaving before the debounce flushes the most recent text.
    await input('packet-careInstructions', 'Flushed on navigation')
    await execute("document.querySelector('a[href=\"#/finish\"]').click()")
    await until("location.hash === '#/finish'")
    assert.equal(service.getPacketDraft()?.introduction.careInstructions, 'Flushed on navigation')
    await route('/export'); await until("Boolean(document.getElementById('packet-careInstructions'))")
    assert.equal(await execute("document.getElementById('packet-careInstructions').value"), 'Flushed on navigation')
    await saved()
    // Refreshing selections removes unavailable records and flags helpers for correction.
    service.archiveEntry(entry.id); service.archivePerson(helper.id)
    await route('/export'); await until("document.body.textContent.includes('unavailable or private record')")
    assert.ok(await execute("document.body.textContent.includes('Contact no longer available')"))
    await click('Remove helper'); await saved()
    assert.equal(service.getPacketDraft()?.selection.entries.length, 0)
    await click('Start another packet'); await until("Boolean(document.querySelector('dialog[open]'))")
    await click('Keep current draft'); assert.equal(service.getPacketDraft()?.introduction.careInstructions, 'Flushed on navigation')
    await click('Start another packet'); await click('Replace'); await saved()
    assert.equal(service.getPacketDraft()?.step, 0)
    await execute("document.querySelector('input[name=\"recipient-mode\"][type=radio]').parentElement.parentElement.querySelectorAll('input')[1].click()")
    await input('packet-recipient-name', 'Outside recipient'); await saved()
    assert.equal(service.listPeople().length, 1)
    assert.equal(service.getPacketDraft()?.recipientName, 'Outside recipient')
    // Switching vaults reloads a different draft and clears any preview.
    service.closeVault(); service.createVault({ name: 'Other vault', filePath: join(root, 'other.everkeep') })
    await route('/export'); await until("Boolean(document.getElementById('packet-recipient'))"); await saved()
    assert.equal(service.getPacketDraft()?.recipientName, '')
    service.closeVault(); service.openVault({ filePath: session.filePath })
    await route('/export'); await until("Boolean(document.getElementById('packet-recipient-name'))")
    assert.equal(await execute("document.getElementById('packet-recipient-name').value"), 'Outside recipient')
    await saved()
    await execute("Array.from(document.querySelectorAll('input[name=\"recipient-mode\"]'))[2].click()")
    await saved()
    assert.equal(service.getPacketDraft()?.recipientMode, 'general')
    await click('Continue to contents'); await saved()
    await route('/start-here'); await until("document.body.textContent.includes('Default packet instructions')")
    assert.equal(await execute("Boolean(document.querySelector('#passwordInstructions'))"), false)
    await route('/backup'); await until("document.body.textContent.includes('Arrange full-vault access')")
    assert.ok(await execute("document.body.textContent.includes('Who has received these access instructions?')"))
    console.log('Packet UI: both viewports, recipient identity, presets, draft autosave/retry/navigation/resume, export/delivery, unavailable records, named recipients, vault isolation and separate access flow passed.')
  } finally { window.destroy(); service.closeVault(); rmSync(root, { recursive: true, force: true }) }
  app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })

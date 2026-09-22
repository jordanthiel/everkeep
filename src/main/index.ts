import { queueAccessFile } from './files/AccessFileRequests'
import { resolve } from 'path'
import { BackupOpenRequests } from './files/BackupOpenRequests'
import { IpcChannels } from '../shared/types/ipc'
import { app, BrowserWindow, ipcMain } from 'electron'
import { registerIpcHandlers, shutdownVaultService } from './ipc/handlers'
import { createMainWindow } from './window'
import { getUpdateService } from './services/UpdateService'

// Disable Chromium features that aren't needed
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

// Match electron-builder NSIS AppUserModelID so Start Menu / taskbar shortcuts resolve.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.everkeep.app')
}

function bootstrap(): void {
  if (app.isPackaged) app.setAsDefaultProtocolClient('everkeep')
  registerIpcHandlers()
  createMainWindow()
  getUpdateService().start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

let sharingRequest: string | null = null
function receiveSharingLink(value: string) {
  const match = value.match(/^everkeep:\/\/shared\/([a-f0-9-]{36})\/?$/)
  if (!match) return
  sharingRequest = match[1]
  if (app.isReady()) { const window = BrowserWindow.getAllWindows()[0] ?? createMainWindow(); window.show(); window.focus(); window.webContents.send('sharing:open') }
}
app.on('open-url', (event, url) => { event.preventDefault(); receiveSharingLink(url) })
ipcMain.handle('sharing:openRequest', () => { const id = sharingRequest; sharingRequest = null; return id })
const requests = new BackupOpenRequests()
function notifyBackupRequest() {
  if (!app.isReady()) return
  const window = BrowserWindow.getAllWindows()[0] ?? createMainWindow()
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  window.webContents.send(IpcChannels.app.backupOpenRequested)
}
function receiveAccessFile(path: string, cwd = process.cwd()) {
  try { const id = queueAccessFile(resolve(cwd, path)); if (id) { receiveSharingLink(`everkeep://shared/${id}`); return true } } catch { /* Leave malformed or missing files for explicit Open to report. */ }
  return false
}
app.on('open-file', (event, path) => {
  event.preventDefault()
  if (receiveAccessFile(path)) return
  if (requests.add(path)) notifyBackupRequest()
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  process.argv.forEach(receiveSharingLink)
  process.argv.slice(app.isPackaged ? 1 : 2).forEach(path => receiveAccessFile(path))
  requests.addArguments(process.argv.slice(app.isPackaged ? 1 : 2), process.cwd())
  app.on('second-instance', (_event, argv, cwd) => {
    argv.forEach(receiveSharingLink)
    argv.slice(app.isPackaged ? 1 : 2).forEach(path => receiveAccessFile(path, cwd))
    requests.addArguments(argv.slice(app.isPackaged ? 1 : 2), cwd)
    notifyBackupRequest()
  })
  ipcMain.handle(IpcChannels.app.getBackupOpenRequest, () => requests.get())
  ipcMain.handle(IpcChannels.app.dismissBackupOpenRequest, (_event, path) => { if (typeof path === 'string') requests.dismiss(path) })
  app.whenReady().then(bootstrap)
}

app.on('window-all-closed', () => {
  shutdownVaultService()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  shutdownVaultService()
})

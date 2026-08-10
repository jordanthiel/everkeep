import { app, BrowserWindow } from 'electron'
import { registerIpcHandlers, shutdownVaultService } from './ipc/handlers'
import { createMainWindow } from './window'

// Disable Chromium features that aren't needed
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

// Match electron-builder NSIS AppUserModelID so Start Menu / taskbar shortcuts resolve.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.everkeep.app')
}

function bootstrap(): void {
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

app.whenReady().then(() => {
  bootstrap()
})

app.on('window-all-closed', () => {
  shutdownVaultService()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  shutdownVaultService()
})

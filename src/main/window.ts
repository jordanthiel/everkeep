import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'

export function resolveAppIcon(): string {
  const fileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  return join(app.getAppPath(), 'build', fileName)
}

export function createMainWindow(): BrowserWindow {
  const icon = resolveAppIcon()

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Everkeep',
    backgroundColor: '#F8F5F0',
    icon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

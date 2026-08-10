import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/types/ipc'
import { ok } from './result'

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.app.ping, async () => ok({ message: 'pong' }))

  ipcMain.handle(IpcChannels.app.getVersion, async () => {
    const { app } = await import('electron')
    return ok({ version: app.getVersion() })
  })
}

export function shutdownVaultService(): void {
  // Vault lifecycle is registered in the persistence milestone.
}

import { contextBridge, ipcRenderer } from 'electron'
import type { EverkeepApi } from '../shared/types/ipc'
import { IpcChannels } from '../shared/types/ipc'
import type { CreateVaultInput, OpenVaultInput, SaveAsVaultInput, BackupVaultInput } from '../shared/types/vault'
import type { CreatePersonInput, UpdatePersonInput } from '../shared/types/person'

const api: EverkeepApi = {
  ping: () => ipcRenderer.invoke(IpcChannels.app.ping),
  getVersion: () => ipcRenderer.invoke(IpcChannels.app.getVersion),
  vault: {
    create: (input: CreateVaultInput) => ipcRenderer.invoke(IpcChannels.vault.create, input),
    open: (input: OpenVaultInput) => ipcRenderer.invoke(IpcChannels.vault.open, input),
    close: () => ipcRenderer.invoke(IpcChannels.vault.close),
    getStatus: () => ipcRenderer.invoke(IpcChannels.vault.getStatus),
    getRecent: () => ipcRenderer.invoke(IpcChannels.vault.getRecent),
    saveAs: (input: SaveAsVaultInput) => ipcRenderer.invoke(IpcChannels.vault.saveAs, input),
    backup: (input: BackupVaultInput) => ipcRenderer.invoke(IpcChannels.vault.backup, input),
    pickSavePath: (suggestedName: string) =>
      ipcRenderer.invoke(IpcChannels.vault.pickSavePath, { suggestedName }),
    pickOpenPath: () => ipcRenderer.invoke(IpcChannels.vault.pickOpenPath),
    pickBackupPath: (suggestedName: string) =>
      ipcRenderer.invoke(IpcChannels.vault.pickBackupPath, { suggestedName }),
    getDefaultVaultDir: () => ipcRenderer.invoke(IpcChannels.vault.getDefaultVaultDir)
  },
  people: {
    list: () => ipcRenderer.invoke(IpcChannels.people.list),
    get: (id: string) => ipcRenderer.invoke(IpcChannels.people.get, { id }),
    create: (input: CreatePersonInput) => ipcRenderer.invoke(IpcChannels.people.create, input),
    update: (input: UpdatePersonInput) => ipcRenderer.invoke(IpcChannels.people.update, input),
    archive: (id: string) => ipcRenderer.invoke(IpcChannels.people.archive, { id }),
    markReviewed: (id: string) => ipcRenderer.invoke(IpcChannels.people.markReviewed, { id })
  }
}

contextBridge.exposeInMainWorld('everkeep', api)

import { contextBridge, ipcRenderer } from 'electron'
import type { EverkeepApi } from '../shared/types/ipc'
import { IpcChannels } from '../shared/types/ipc'
import type {
  CreateVaultInput,
  OpenVaultInput,
  SaveAsVaultInput,
  BackupVaultInput
} from '../shared/types/vault'
import type { CreatePersonInput, UpdatePersonInput } from '../shared/types/person'
import type { CreateContactInput, UpdateContactInput } from '../shared/types/contact'
import type { CreateAccountInput, UpdateAccountInput } from '../shared/types/account'
import type { CreateDigitalAccountInput } from '../shared/types/digital'
import type {
  CreateVaultEntryInput,
  ExportReportInput,
  UpdateVaultEntryInput,
  VaultSectionId
} from '../shared/types/entry'
import type { AppUpdateStatus } from '../shared/types/appUpdate'

const api: EverkeepApi = {
  ping: () => ipcRenderer.invoke(IpcChannels.app.ping),
  getVersion: () => ipcRenderer.invoke(IpcChannels.app.getVersion),
  updates: {
    getStatus: () => ipcRenderer.invoke(IpcChannels.app.getUpdateStatus),
    check: () => ipcRenderer.invoke(IpcChannels.app.checkForUpdate),
    download: () => ipcRenderer.invoke(IpcChannels.app.downloadUpdate),
    install: () => ipcRenderer.invoke(IpcChannels.app.installUpdate),
    openReleasePage: () => ipcRenderer.invoke(IpcChannels.app.openReleasePage),
    onStatus: (listener: (status: AppUpdateStatus) => void) => {
      const wrapped = (_event: unknown, status: AppUpdateStatus) => listener(status)
      ipcRenderer.on(IpcChannels.app.updateStatus, wrapped)
      return () => {
        ipcRenderer.removeListener(IpcChannels.app.updateStatus, wrapped)
      }
    }
  },
  vault: {
    create: (input: CreateVaultInput) => ipcRenderer.invoke(IpcChannels.vault.create, input),
    open: (input: OpenVaultInput) => ipcRenderer.invoke(IpcChannels.vault.open, input),
    close: () => ipcRenderer.invoke(IpcChannels.vault.close),
    lock: () => ipcRenderer.invoke(IpcChannels.vault.lock),
    unlock: (password: string) => ipcRenderer.invoke(IpcChannels.vault.unlock, { password }),
    getStatus: () => ipcRenderer.invoke(IpcChannels.vault.getStatus),
    getRecent: () => ipcRenderer.invoke(IpcChannels.vault.getRecent),
    saveAs: (input: SaveAsVaultInput) => ipcRenderer.invoke(IpcChannels.vault.saveAs, input),
    backup: (input: BackupVaultInput) => ipcRenderer.invoke(IpcChannels.vault.backup, input),
    pickSavePath: (suggestedName: string) =>
      ipcRenderer.invoke(IpcChannels.vault.pickSavePath, { suggestedName }),
    pickOpenPath: () => ipcRenderer.invoke(IpcChannels.vault.pickOpenPath),
    pickBackupPath: (suggestedName: string) =>
      ipcRenderer.invoke(IpcChannels.vault.pickBackupPath, { suggestedName }),
    pickExportPath: (suggestedName: string) =>
      ipcRenderer.invoke(IpcChannels.vault.pickExportPath, { suggestedName }),
    getDefaultVaultDir: () => ipcRenderer.invoke(IpcChannels.vault.getDefaultVaultDir),
    getDashboard: () => ipcRenderer.invoke(IpcChannels.vault.getDashboard),
    exportReport: (input: ExportReportInput) =>
      ipcRenderer.invoke(IpcChannels.vault.exportReport, input),
    enablePassword: (password: string) =>
      ipcRenderer.invoke(IpcChannels.vault.enablePassword, { password })
  },
  people: {
    list: () => ipcRenderer.invoke(IpcChannels.people.list),
    get: (id: string) => ipcRenderer.invoke(IpcChannels.people.get, { id }),
    create: (input: CreatePersonInput) => ipcRenderer.invoke(IpcChannels.people.create, input),
    update: (input: UpdatePersonInput) => ipcRenderer.invoke(IpcChannels.people.update, input),
    archive: (id: string) => ipcRenderer.invoke(IpcChannels.people.archive, { id }),
    markReviewed: (id: string) => ipcRenderer.invoke(IpcChannels.people.markReviewed, { id })
  },
  contacts: {
    list: () => ipcRenderer.invoke(IpcChannels.contacts.list),
    create: (input: CreateContactInput) => ipcRenderer.invoke(IpcChannels.contacts.create, input),
    update: (input: UpdateContactInput) => ipcRenderer.invoke(IpcChannels.contacts.update, input),
    archive: (id: string) => ipcRenderer.invoke(IpcChannels.contacts.archive, { id }),
    markReviewed: (id: string) => ipcRenderer.invoke(IpcChannels.contacts.markReviewed, { id })
  },
  accounts: {
    list: () => ipcRenderer.invoke(IpcChannels.accounts.list),
    create: (input: CreateAccountInput) => ipcRenderer.invoke(IpcChannels.accounts.create, input),
    update: (input: UpdateAccountInput) => ipcRenderer.invoke(IpcChannels.accounts.update, input),
    archive: (id: string) => ipcRenderer.invoke(IpcChannels.accounts.archive, { id }),
    markReviewed: (id: string) => ipcRenderer.invoke(IpcChannels.accounts.markReviewed, { id })
  },
  digital: {
    list: () => ipcRenderer.invoke(IpcChannels.digital.list),
    create: (input: CreateDigitalAccountInput) =>
      ipcRenderer.invoke(IpcChannels.digital.create, input),
    archive: (id: string) => ipcRenderer.invoke(IpcChannels.digital.archive, { id })
  },
  entries: {
    list: (section: VaultSectionId) => ipcRenderer.invoke(IpcChannels.entries.list, { section }),
    create: (input: CreateVaultEntryInput) => ipcRenderer.invoke(IpcChannels.entries.create, input),
    update: (input: UpdateVaultEntryInput) => ipcRenderer.invoke(IpcChannels.entries.update, input),
    archive: (id: string) => ipcRenderer.invoke(IpcChannels.entries.archive, { id }),
    markReviewed: (id: string) => ipcRenderer.invoke(IpcChannels.entries.markReviewed, { id })
  },
  review: {
    list: () => ipcRenderer.invoke(IpcChannels.review.list)
  },
  attachments: {
    list: (entryId: string) => ipcRenderer.invoke(IpcChannels.attachments.list, { entryId }),
    pickFile: () => ipcRenderer.invoke(IpcChannels.attachments.pickFile),
    attach: (entryId: string, sourcePath: string) =>
      ipcRenderer.invoke(IpcChannels.attachments.attach, { entryId, sourcePath }),
    pickAndAttach: (entryId: string) =>
      ipcRenderer.invoke(IpcChannels.attachments.pickAndAttach, { entryId }),
    open: (id: string) => ipcRenderer.invoke(IpcChannels.attachments.open, { id }),
    reveal: (id: string) => ipcRenderer.invoke(IpcChannels.attachments.reveal, { id }),
    remove: (id: string) => ipcRenderer.invoke(IpcChannels.attachments.remove, { id })
  },
  license: {
    getStatus: () => ipcRenderer.invoke(IpcChannels.license.getStatus),
    activate: (key: string) => ipcRenderer.invoke(IpcChannels.license.activate, { key }),
    deactivate: () => ipcRenderer.invoke(IpcChannels.license.deactivate),
    openPurchasePage: () => ipcRenderer.invoke(IpcChannels.license.openPurchasePage)
  }
}

contextBridge.exposeInMainWorld('everkeep', api)

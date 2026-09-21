import { registerSharingHandlers } from './sharingHandlers'
import { SavePacketDraftSchema } from '../../shared/schemas/packet'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { IpcChannels } from '../../shared/types/ipc'
import {
  ActivateLicenseKeySchema,
  HandoffSchema,
  BackupCheckSchema,
  RestoreBackupSchema,
  ExportOptionsSchema,
  AccountIdSchema,
  AttachFileSchema,
  AttachmentIdSchema,
  BackupVaultSchema,
  ContactIdSchema,
  CreateAccountSchema,
  CreateContactSchema,
  CreateDigitalAccountSchema,
  CreatePersonSchema,
  CreateVaultEntrySchema,
  CreateVaultSchema,
  DigitalAccountIdSchema,
  EntryIdForAttachmentsSchema,
  ExportReportSchema,
  ListVaultEntriesSchema,
  OpenVaultSchema,
  PersonIdSchema,
  PickBackupPathSchema,
  PickSavePathSchema,
  SaveAsVaultSchema,
  UnlockVaultSchema,
  UpdateAccountSchema,
  UpdateContactSchema,
  UpdatePersonSchema,
  UpdateVaultEntrySchema,
  VaultEntryIdSchema
} from '../../shared/schemas'
import { VAULT_EXTENSION, VAULT_FILE_FILTER } from '../../shared/constants'
import {
  getDefaultVaultDirectory,
  getRecentVaultsPath,
  getRecoveryBackupDirectory
} from '../files/paths'
import { RecentVaultsStore } from '../repositories/RecentVaultsStore'
import { LicenseService } from '../services/LicenseService'
import { VaultService } from '../services/VaultService'
import { getUpdateService } from '../services/UpdateService'
import { fromError, ok } from './result'

let stopSharing: (() => void) | null = null
let vaultService: VaultService | null = null
let licenseService: LicenseService | null = null

function getLicenseService(): LicenseService {
  if (!licenseService) {
    licenseService = new LicenseService()
  }
  return licenseService
}

function getVaultService(): VaultService {
  if (!vaultService) {
    vaultService = new VaultService({
      recentStore: new RecentVaultsStore(getRecentVaultsPath()),
      recoveryDirectory: getRecoveryBackupDirectory(),
      licenseService: getLicenseService()
    })
  }
  return vaultService
}

function getParentWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused) return focused
  const all = BrowserWindow.getAllWindows()
  return all[0] ?? null
}

async function pickAttachmentFile(): Promise<{ path: string; filename: string } | null> {
  const parent = getParentWindow()
  const options = {
    title: 'Choose a file to attach',
    properties: ['openFile' as const],
    filters: [
      {
        name: 'Documents & images',
        extensions: [
          'pdf',
          'png',
          'jpg',
          'jpeg',
          'gif',
          'webp',
          'txt',
          'md',
          'doc',
          'docx',
          'xls',
          'xlsx',
          'csv',
          'zip'
        ]
      },
      { name: 'All files', extensions: ['*'] }
    ]
  }
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths[0]) {
    return null
  }
  const filePath = result.filePaths[0]
  return {
    path: filePath,
    filename: filePath.split(/[/\\]/).pop() ?? 'file'
  }
}

export function registerIpcHandlers(): void {
  stopSharing = registerSharingHandlers(getVaultService)
  const service = getVaultService()
  ipcMain.handle(IpcChannels.vault.getPacketDraft, async () => { try { return ok(service.getPacketDraft()) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.savePacketDraft, async (_event, raw) => { try { const input = SavePacketDraftSchema.parse(raw); if (service.getStatus().session?.metadata.id !== input.vaultId) throw new Error('The active vault has changed.'); return ok(service.savePacketDraft(input.draft)) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.clearPacketDraft, async () => { try { return ok(service.clearPacketDraft()) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.getHandoff, async () => { try { return ok(service.getHandoff()) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.updateHandoff, async (_event, raw) => { try { return ok(service.updateHandoff(HandoffSchema.parse(raw))) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.getExportCatalog, async () => { try { return ok(service.getExportCatalog()) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.previewReport, async (_event, raw) => { try { return ok(service.previewReport(ExportOptionsSchema.parse(raw))) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.verifyBackup, async (_event, raw) => { try { return ok(await service.verifyBackup(BackupCheckSchema.parse(raw))) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.restoreBackup, async (_event, raw) => { try { return ok(await service.restoreBackup(RestoreBackupSchema.parse(raw))) } catch (error) { return fromError(error) } })
  ipcMain.handle(IpcChannels.vault.pickRestorePath, async () => {
    try {
      const parent = getParentWindow()
      const options = { title: 'Choose an Everkeep backup', filters: [{ name: 'Everkeep Backup', extensions: ['everkeep-backup'] }], properties: ['openFile' as const] }
      const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
      return ok(result.canceled ? null : result.filePaths[0] ?? null)
    } catch (error) { return fromError(error) }
  })

  ipcMain.handle(IpcChannels.app.ping, async () => ok({ message: 'pong' }))

  ipcMain.handle(IpcChannels.app.getVersion, async () => {
    const { app } = await import('electron')
    return ok({ version: app.getVersion() })
  })

  ipcMain.handle(IpcChannels.app.getUpdateStatus, async () => {
    return ok(getUpdateService().getStatus())
  })

  ipcMain.handle(IpcChannels.app.checkForUpdate, async () => {
    try {
      return ok(await getUpdateService().check({ userInitiated: true }))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.app.downloadUpdate, async () => {
    try {
      return ok(await getUpdateService().download())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.app.installUpdate, async () => {
    try {
      shutdownVaultService()
      getUpdateService().install()
      return ok({ quitting: true })
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.app.openReleasePage, async () => {
    try {
      return ok(await getUpdateService().openReleasePage())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.getDefaultVaultDir, async () => {
    try {
      return ok(getDefaultVaultDirectory())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.pickSavePath, async (_event, raw) => {
    try {
      const { suggestedName } = PickSavePathSchema.parse(raw)
      const defaultDir = getDefaultVaultDirectory()
      const parent = getParentWindow()
      const options = {
        title: 'Create Everkeep Vault',
        defaultPath: join(defaultDir, `${suggestedName}${VAULT_EXTENSION}`),
        filters: [VAULT_FILE_FILTER]
      }
      const result = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options)
      return ok(result.canceled ? null : result.filePath ?? null)
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.pickOpenPath, async () => {
    try {
      const parent = getParentWindow()
      const options = {
        title: 'Open an Everkeep vault or backup',
        defaultPath: getDefaultVaultDirectory(),
        filters: [{ name: 'Everkeep vaults and backups', extensions: ['everkeep', 'everkeep-backup'] }, VAULT_FILE_FILTER, { name: 'Everkeep backups', extensions: ['everkeep-backup'] }],
        properties: ['openFile' as const]
      }
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      return ok(result.canceled ? null : (result.filePaths[0] ?? null))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.pickBackupPath, async (_event, raw) => {
    try {
      const { suggestedName } = PickBackupPathSchema.parse(raw)
      const parent = getParentWindow()
      const options = {
        title: 'Create Everkeep Backup',
        defaultPath: join(getRecoveryBackupDirectory(), `${suggestedName}.everkeep-backup`),
        filters: [{ name: 'Everkeep Backup', extensions: ['everkeep-backup'] }]
      }
      const result = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options)
      return ok(result.canceled ? null : result.filePath ?? null)
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.create, async (_event, raw) => {
    try {
      const input = CreateVaultSchema.parse(raw)
      return ok(service.createVault(input))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.open, async (_event, raw) => {
    try {
      const input = OpenVaultSchema.parse(raw)
      return ok(service.openVault(input))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.close, async () => {
    try {
      return ok(service.closeVault())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.lock, async () => {
    try {
      return ok(service.lockVault())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.unlock, async (_event, raw) => {
    try {
      const { password } = UnlockVaultSchema.parse(raw)
      return ok(service.unlockVault(password))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.getStatus, async () => {
    try {
      return ok(service.getStatus())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.getRecent, async () => {
    try {
      return ok(service.getRecent())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.saveAs, async (_event, raw) => {
    try {
      const input = SaveAsVaultSchema.parse(raw)
      return ok(service.saveAs(input))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.backup, async (_event, raw) => {
    try {
      const input = BackupVaultSchema.parse(raw)
      return ok(await service.backup(input))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.getDashboard, async () => {
    try {
      return ok(service.getDashboard())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.people.list, async () => {
    try {
      return ok(service.listPeople())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.people.get, async (_event, raw) => {
    try {
      const { id } = PersonIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.getPerson(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.people.create, async (_event, raw) => {
    try {
      const input = CreatePersonSchema.parse(raw)
      return ok(service.createPerson(input))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.people.update, async (_event, raw) => {
    try {
      const input = UpdatePersonSchema.parse(raw)
      return ok(service.updatePerson(input))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.people.archive, async (_event, raw) => {
    try {
      const { id } = PersonIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.archivePerson(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.people.markReviewed, async (_event, raw) => {
    try {
      const { id } = PersonIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.markPersonReviewed(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.contacts.list, async () => {
    try {
      return ok(service.listContacts())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.contacts.create, async (_event, raw) => {
    try {
      return ok(service.createContact(CreateContactSchema.parse(raw)))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.contacts.update, async (_event, raw) => {
    try {
      return ok(service.updateContact(UpdateContactSchema.parse(raw)))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.contacts.archive, async (_event, raw) => {
    try {
      const { id } = ContactIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.archiveContact(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.contacts.markReviewed, async (_event, raw) => {
    try {
      const { id } = ContactIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.markContactReviewed(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.accounts.list, async () => {
    try {
      return ok(service.listAccounts())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.accounts.create, async (_event, raw) => {
    try {
      return ok(service.createAccount(CreateAccountSchema.parse(raw)))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.accounts.update, async (_event, raw) => {
    try {
      return ok(service.updateAccount(UpdateAccountSchema.parse(raw)))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.accounts.archive, async (_event, raw) => {
    try {
      const { id } = AccountIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.archiveAccount(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.accounts.markReviewed, async (_event, raw) => {
    try {
      const { id } = AccountIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.markAccountReviewed(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.digital.list, async () => {
    try {
      return ok(service.listDigitalAccounts())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.digital.create, async (_event, raw) => {
    try {
      return ok(service.createDigitalAccount(CreateDigitalAccountSchema.parse(raw)))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.digital.archive, async (_event, raw) => {
    try {
      const { id } = DigitalAccountIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.archiveDigitalAccount(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.entries.list, async (_event, raw) => {
    try {
      const { section } = ListVaultEntriesSchema.parse(raw)
      return ok(service.listEntries(section))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.entries.create, async (_event, raw) => {
    try {
      return ok(service.createEntry(CreateVaultEntrySchema.parse(raw)))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.entries.update, async (_event, raw) => {
    try {
      return ok(service.updateEntry(UpdateVaultEntrySchema.parse(raw)))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.entries.archive, async (_event, raw) => {
    try {
      const { id } = VaultEntryIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.archiveEntry(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.entries.markReviewed, async (_event, raw) => {
    try {
      const { id } = VaultEntryIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.markEntryReviewed(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.review.list, async () => {
    try {
      return ok(service.listReviewItems())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.exportReport, async (_event, raw) => {
    try {
      return ok(service.exportReport(ExportReportSchema.parse(raw)))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.pickExportPath, async (_event, raw) => {
    try {
      const { suggestedName } = PickBackupPathSchema.parse(raw)
      const parent = getParentWindow()
      const options = {
        title: 'Export Everkeep Report',
        defaultPath: join(getDefaultVaultDirectory(), `${suggestedName}.html`),
        filters: [{ name: 'HTML Report', extensions: ['html'] }]
      }
      const result = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options)
      return ok(result.canceled ? null : result.filePath ?? null)
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.vault.enablePassword, async (_event, raw) => {
    try {
      const { password } = UnlockVaultSchema.parse(raw)
      return ok(service.enablePassword(password))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.attachments.list, async (_event, raw) => {
    try {
      const { entryId } = EntryIdForAttachmentsSchema.parse(raw)
      return ok(service.listAttachments(entryId))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.attachments.pickFile, async () => {
    try {
      const picked = await pickAttachmentFile()
      if (!picked) return ok(null)
      return ok(picked)
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.attachments.attach, async (_event, raw) => {
    try {
      const { entryId, sourcePath } = AttachFileSchema.parse(raw)
      return ok(service.attachFile(entryId, sourcePath))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.attachments.pickAndAttach, async (_event, raw) => {
    try {
      const { entryId } = EntryIdForAttachmentsSchema.parse(raw)
      const picked = await pickAttachmentFile()
      if (!picked) return ok(null)
      return ok(service.attachFile(entryId, picked.path))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.attachments.open, async (_event, raw) => {
    try {
      const { id } = AttachmentIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(await service.openAttachment(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.attachments.reveal, async (_event, raw) => {
    try {
      const { id } = AttachmentIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.revealAttachment(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.attachments.remove, async (_event, raw) => {
    try {
      const { id } = AttachmentIdSchema.parse(typeof raw === 'string' ? { id: raw } : raw)
      return ok(service.removeAttachment(id))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.license.getStatus, async () => {
    try {
      return ok(getLicenseService().getStatus())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.license.activateKey, async (_event, raw) => {
    try {
      const { key } = ActivateLicenseKeySchema.parse(raw)
      return ok(getLicenseService().activateKey(key))
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.license.activateFile, async () => {
    try {
      return ok(await getLicenseService().pickAndActivateFile())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.license.deactivate, async () => {
    try {
      return ok(getLicenseService().deactivate())
    } catch (error) {
      return fromError(error)
    }
  })

  ipcMain.handle(IpcChannels.license.openCheckout, async () => {
    try {
      return ok(await getLicenseService().openCheckout())
    } catch (error) {
      return fromError(error)
    }
  })
}

export function shutdownVaultService(): void {
  stopSharing?.()
  if (vaultService) {
    vaultService.closeVault()
    vaultService = null
  }
}

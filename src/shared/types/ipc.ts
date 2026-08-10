import type {
  BackupVaultInput,
  CreateVaultInput,
  OpenVaultInput,
  RecentVault,
  SaveAsVaultInput,
  VaultSession,
  VaultStatus
} from './vault'
import type { CreatePersonInput, Person, UpdatePersonInput } from './person'
import type { Contact, CreateContactInput, UpdateContactInput } from './contact'
import type { Account, CreateAccountInput, UpdateAccountInput } from './account'
import type { DashboardSummary } from './dashboard'
import type { CreateDigitalAccountInput, DigitalAccount } from './digital'
import type {
  CreateVaultEntryInput,
  ExportReportInput,
  ReviewItem,
  UpdateVaultEntryInput,
  VaultEntry,
  VaultSectionId
} from './entry'
import type { Attachment } from './attachment'

export const IpcChannels = {
  vault: {
    create: 'vault:create',
    open: 'vault:open',
    close: 'vault:close',
    lock: 'vault:lock',
    unlock: 'vault:unlock',
    getStatus: 'vault:getStatus',
    getRecent: 'vault:getRecent',
    saveAs: 'vault:saveAs',
    backup: 'vault:backup',
    pickSavePath: 'vault:pickSavePath',
    pickOpenPath: 'vault:pickOpenPath',
    pickBackupPath: 'vault:pickBackupPath',
    getDefaultVaultDir: 'vault:getDefaultVaultDir',
    getDashboard: 'vault:getDashboard',
    exportReport: 'vault:exportReport',
    pickExportPath: 'vault:pickExportPath',
    enablePassword: 'vault:enablePassword'
  },
  people: {
    list: 'people:list',
    get: 'people:get',
    create: 'people:create',
    update: 'people:update',
    archive: 'people:archive',
    markReviewed: 'people:markReviewed'
  },
  contacts: {
    list: 'contacts:list',
    create: 'contacts:create',
    update: 'contacts:update',
    archive: 'contacts:archive',
    markReviewed: 'contacts:markReviewed'
  },
  accounts: {
    list: 'accounts:list',
    create: 'accounts:create',
    update: 'accounts:update',
    archive: 'accounts:archive',
    markReviewed: 'accounts:markReviewed'
  },
  digital: {
    list: 'digital:list',
    create: 'digital:create',
    archive: 'digital:archive'
  },
  entries: {
    list: 'entries:list',
    create: 'entries:create',
    update: 'entries:update',
    archive: 'entries:archive',
    markReviewed: 'entries:markReviewed'
  },
  review: {
    list: 'review:list'
  },
  attachments: {
    list: 'attachments:list',
    pickFile: 'attachments:pickFile',
    attach: 'attachments:attach',
    pickAndAttach: 'attachments:pickAndAttach',
    open: 'attachments:open',
    reveal: 'attachments:reveal',
    remove: 'attachments:remove'
  },
  app: {
    ping: 'app:ping',
    getVersion: 'app:getVersion'
  }
} as const

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export interface EverkeepApi {
  ping: () => Promise<IpcResult<{ message: string }>>
  getVersion: () => Promise<IpcResult<{ version: string }>>
  vault: {
    create: (input: CreateVaultInput) => Promise<IpcResult<VaultSession>>
    open: (input: OpenVaultInput) => Promise<IpcResult<VaultSession>>
    close: () => Promise<IpcResult<{ closed: boolean }>>
    lock: () => Promise<IpcResult<VaultSession>>
    unlock: (password: string) => Promise<IpcResult<VaultSession>>
    getStatus: () => Promise<IpcResult<VaultStatus>>
    getRecent: () => Promise<IpcResult<RecentVault[]>>
    saveAs: (input: SaveAsVaultInput) => Promise<IpcResult<VaultSession>>
    backup: (input: BackupVaultInput) => Promise<IpcResult<{ backupPath: string }>>
    pickSavePath: (suggestedName: string) => Promise<IpcResult<string | null>>
    pickOpenPath: () => Promise<IpcResult<string | null>>
    pickBackupPath: (suggestedName: string) => Promise<IpcResult<string | null>>
    pickExportPath: (suggestedName: string) => Promise<IpcResult<string | null>>
    getDefaultVaultDir: () => Promise<IpcResult<string>>
    getDashboard: () => Promise<IpcResult<DashboardSummary>>
    exportReport: (input: ExportReportInput) => Promise<IpcResult<{ path: string }>>
    enablePassword: (password: string) => Promise<IpcResult<VaultSession>>
  }
  people: {
    list: () => Promise<IpcResult<Person[]>>
    get: (id: string) => Promise<IpcResult<Person | null>>
    create: (input: CreatePersonInput) => Promise<IpcResult<Person>>
    update: (input: UpdatePersonInput) => Promise<IpcResult<Person>>
    archive: (id: string) => Promise<IpcResult<{ archived: boolean }>>
    markReviewed: (id: string) => Promise<IpcResult<Person>>
  }
  contacts: {
    list: () => Promise<IpcResult<Contact[]>>
    create: (input: CreateContactInput) => Promise<IpcResult<Contact>>
    update: (input: UpdateContactInput) => Promise<IpcResult<Contact>>
    archive: (id: string) => Promise<IpcResult<{ archived: boolean }>>
    markReviewed: (id: string) => Promise<IpcResult<Contact>>
  }
  accounts: {
    list: () => Promise<IpcResult<Account[]>>
    create: (input: CreateAccountInput) => Promise<IpcResult<Account>>
    update: (input: UpdateAccountInput) => Promise<IpcResult<Account>>
    archive: (id: string) => Promise<IpcResult<{ archived: boolean }>>
    markReviewed: (id: string) => Promise<IpcResult<Account>>
  }
  digital: {
    list: () => Promise<IpcResult<DigitalAccount[]>>
    create: (input: CreateDigitalAccountInput) => Promise<IpcResult<DigitalAccount>>
    archive: (id: string) => Promise<IpcResult<{ archived: boolean }>>
  }
  entries: {
    list: (section: VaultSectionId) => Promise<IpcResult<VaultEntry[]>>
    create: (input: CreateVaultEntryInput) => Promise<IpcResult<VaultEntry>>
    update: (input: UpdateVaultEntryInput) => Promise<IpcResult<VaultEntry>>
    archive: (id: string) => Promise<IpcResult<{ archived: boolean }>>
    markReviewed: (id: string) => Promise<IpcResult<VaultEntry>>
  }
  review: {
    list: () => Promise<IpcResult<ReviewItem[]>>
  }
  attachments: {
    list: (entryId: string) => Promise<IpcResult<Attachment[]>>
    pickFile: () => Promise<IpcResult<{ path: string; filename: string } | null>>
    attach: (entryId: string, sourcePath: string) => Promise<IpcResult<Attachment>>
    pickAndAttach: (entryId: string) => Promise<IpcResult<Attachment | null>>
    open: (id: string) => Promise<IpcResult<{ opened: boolean }>>
    reveal: (id: string) => Promise<IpcResult<{ revealed: boolean }>>
    remove: (id: string) => Promise<IpcResult<{ removed: boolean }>>
  }
}

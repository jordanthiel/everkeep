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

export const IpcChannels = {
  vault: {
    create: 'vault:create',
    open: 'vault:open',
    close: 'vault:close',
    getStatus: 'vault:getStatus',
    getRecent: 'vault:getRecent',
    saveAs: 'vault:saveAs',
    backup: 'vault:backup',
    pickSavePath: 'vault:pickSavePath',
    pickOpenPath: 'vault:pickOpenPath',
    pickBackupPath: 'vault:pickBackupPath',
    getDefaultVaultDir: 'vault:getDefaultVaultDir'
  },
  people: {
    list: 'people:list',
    get: 'people:get',
    create: 'people:create',
    update: 'people:update',
    archive: 'people:archive',
    markReviewed: 'people:markReviewed'
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
    getStatus: () => Promise<IpcResult<VaultStatus>>
    getRecent: () => Promise<IpcResult<RecentVault[]>>
    saveAs: (input: SaveAsVaultInput) => Promise<IpcResult<VaultSession>>
    backup: (input: BackupVaultInput) => Promise<IpcResult<{ backupPath: string }>>
    pickSavePath: (suggestedName: string) => Promise<IpcResult<string | null>>
    pickOpenPath: () => Promise<IpcResult<string | null>>
    pickBackupPath: (suggestedName: string) => Promise<IpcResult<string | null>>
    getDefaultVaultDir: () => Promise<IpcResult<string>>
  }
  people: {
    list: () => Promise<IpcResult<Person[]>>
    get: (id: string) => Promise<IpcResult<Person | null>>
    create: (input: CreatePersonInput) => Promise<IpcResult<Person>>
    update: (input: UpdatePersonInput) => Promise<IpcResult<Person>>
    archive: (id: string) => Promise<IpcResult<{ archived: boolean }>>
    markReviewed: (id: string) => Promise<IpcResult<Person>>
  }
}

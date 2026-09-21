import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { DEFAULT_VAULT_DIR_NAME, LICENSE_FILENAME } from '../../shared/constants'

export function getDefaultVaultDirectory(): string {
  const documents = app.getPath('documents')
  const dir = join(documents, DEFAULT_VAULT_DIR_NAME)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getAppDataDirectory(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getRecentVaultsPath(): string {
  return join(getAppDataDirectory(), 'recent-vaults.json')
}

export function getLicensePath(): string {
  return join(getAppDataDirectory(), LICENSE_FILENAME)
}

export function getAttachmentsDirectory(vaultId: string): string {
  const dir = join(getAppDataDirectory(), 'attachments', vaultId)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getRecoveryBackupDirectory(): string {
  const dir = join(homedir(), 'Everkeep Backups')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function ensureParentDirectory(filePath: string): void {
  const parent = dirname(filePath)
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true })
  }
}

export function ensureVaultExtension(filePath: string): string {
  return filePath.endsWith('.everkeep') ? filePath : `${filePath}.everkeep`
}

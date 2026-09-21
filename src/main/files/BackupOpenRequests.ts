import { resolve } from 'path'
import { isBackupPath } from '../../shared/backupFiles'

/** Retain startup requests until the renderer subscribes, including macOS open-file before ready. */
export class BackupOpenRequests {
  private pending: string | null = null
  add(path: string, cwd = process.cwd()): boolean {
    if (path.startsWith('-') || !isBackupPath(path)) return false
    this.pending = resolve(cwd, path)
    return true
  }
  addArguments(args: string[], cwd: string): void {
    for (const path of args) this.add(path, cwd)
  }
  get(): string | null { return this.pending }
  dismiss(path: string): void {
    if (this.pending === path) this.pending = null
  }
}

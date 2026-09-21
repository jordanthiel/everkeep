export function isBackupPath(path: string): boolean {
  return path.toLowerCase().endsWith('.everkeep-backup')
}
export function backupRestorePath(path: string): string {
  return `/restore?backup=${encodeURIComponent(path)}`
}

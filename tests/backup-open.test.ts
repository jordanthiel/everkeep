import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { BackupOpenRequests } from '../src/main/files/BackupOpenRequests'
import { backupRestorePath, isBackupPath } from '../src/shared/backupFiles'
import packageJson from '../package.json'

describe('opening backup files', () => {
  it('registers the backup extension with the installer', () => {
    expect(packageJson.build.fileAssociations).toContainEqual(expect.objectContaining({ ext: 'everkeep-backup', role: 'Viewer' }))
  })
  it('retains a cold-start request across renderer subscriptions until acknowledged', () => {
    const requests = new BackupOpenRequests()
    requests.add('Family backup.EVERKEEP-BACKUP', '/tmp')
    expect(requests.get()).toBe(resolve('/tmp', 'Family backup.EVERKEEP-BACKUP'))
    expect(requests.get()).not.toBeNull()
    requests.dismiss(requests.get()!)
    expect(requests.get()).toBeNull()
  })
  it('handles second-instance arguments and does not dismiss a newer request', () => {
    const requests = new BackupOpenRequests()
    requests.addArguments(['--flag', 'old.everkeep-backup'], '/tmp')
    const old = requests.get()!
    requests.addArguments(['--inspect', 'new backup.everkeep-backup'], '/tmp')
    requests.dismiss(old)
    expect(requests.get()).toBe(resolve('/tmp', 'new backup.everkeep-backup'))
  })
  it('ignores other file types and safely encodes special characters in restore routes', () => {
    const requests = new BackupOpenRequests()
    expect(requests.add('vault.everkeep')).toBe(false)
    expect(requests.add('--fake.everkeep-backup')).toBe(false)
    expect(isBackupPath('backup.zip')).toBe(false)
    const path = '/tmp/Family #1 & 2.everkeep-backup'
    expect(new URLSearchParams(backupRestorePath(path).split('?')[1]).get('backup')).toBe(path)
  })
})

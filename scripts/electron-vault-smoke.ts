import { app } from 'electron'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { VaultService } from '../src/main/services/VaultService'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'

app.whenReady().then(async () => {
  assert.ok(process.versions.electron, 'Must run in Electron')
  const root = mkdtempSync(join(tmpdir(), 'everkeep-electron-test-'))
  const service = new VaultService({ recentStore: new RecentVaultsStore(join(root, 'recent.json')), argon2Params: TEST_ARGON2_PARAMS, attachmentsRootFactory: id => join(root, id) })
  try {
    // This exact operation fatally aborts Electron with better-sqlite3 11.10.0.
    const db = new Database(':memory:')
    db.exec('CREATE TABLE sample (data BLOB)')
    db.prepare('INSERT INTO sample VALUES (?)').run(Buffer.from('sandbox round trip'))
    const restored = new Database(db.serialize())
    assert.equal((restored.prepare('SELECT data FROM sample').get() as {data: Buffer}).data.toString(), 'sandbox round trip')
    restored.close(); db.close()

    const filePath = join(root, 'protected.everkeep')
    service.createVault({ name: 'Electron test', filePath, password: 'test-password' })
    const policy = service.createEntry({ section: 'insurance', title: 'Allstate policy', login: { provider: 'Allstate', username: 'test@example.test', password: 'Login fixture secret', website: '', instructions: '' } })
    const entry = service.createEntry({ section: 'documents', title: 'Private Electron fixture' })
    const attachment = join(root, 'attachment.txt')
    writeFileSync(attachment, 'Private attachment fixture')
    service.attachFile(entry.id, attachment)
    assert.ok(!readFileSync(filePath).includes(Buffer.from('Private Electron fixture')))
    service.lockVault()
    assert.throws(() => service.unlockVault('wrong-password'), /incorrect/i)
    service.unlockVault('test-password')
    assert.equal(service.listEntries('documents').find(item => item.id === entry.id)?.title, 'Private Electron fixture')
    const backup = await service.backup({ destinationPath: join(root, 'backup.everkeep-backup') })
    assert.equal((await service.verifyBackup({ backupPath: backup.backupPath, password: 'test-password' })).attachmentCount, 1)
    service.rotatePassword('test-password', 'changed-password')
    service.closeVault()
    service.openVault({ filePath, password: 'changed-password' })
    assert.equal(service.listEntries('documents').find(item => item.id === entry.id)?.title, 'Private Electron fixture')
    await service.restoreBackup({ backupPath: backup.backupPath, password: 'test-password', destinationPath: join(root, 'restored.everkeep') })
    assert.equal(service.listEntries('documents').find(item => item.id === entry.id)?.title, 'Private Electron fixture')
    assert.equal(service.listEntries('insurance')[0].login?.password, 'Login fixture secret')
    assert.equal(service.listEntries('digital')[0].linkedRecords?.[0].id, policy.id)
    console.log(`Electron ${process.versions.electron}: serialization, protected save, linked logins, attachments, lock/unlock, password rotation, backup verification and restore passed.`)
  } finally {
    service.closeVault()
    rmSync(root, { recursive: true, force: true })
  }
  app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })

import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import { TEST_ARGON2_PARAMS } from '../src/main/security/EncryptionService'
import { VaultService } from '../src/main/services/VaultService'

describe('document attachments', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('attaches a file to a document entry and packages it in backup', async () => {
    const root = mkdtempSync(join(tmpdir(), 'everkeep-attach-'))
    dirs.push(root)
    const attachmentsRoot = join(root, 'attachments-store')
    const sourceFile = join(root, 'will-scan.pdf')
    writeFileSync(sourceFile, 'fake-pdf-bytes-for-test')

    const service = new VaultService({
      recentStore: new RecentVaultsStore(join(root, 'recent.json')),
      argon2Params: TEST_ARGON2_PARAMS,
      attachmentsRootFactory: (vaultId) => join(attachmentsRoot, vaultId)
    })

    service.createVault({
      name: 'Docs',
      filePath: join(root, 'Docs.everkeep'),
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan'
    })

    const doc = service.createEntry({
      section: 'documents',
      kind: 'will',
      title: 'Will scan',
      locationText: 'Home safe'
    })

    const attached = service.attachFile(doc.id, sourceFile)
    expect(attached.filename).toBe('will-scan.pdf')
    expect(attached.entryId).toBe(doc.id)
    expect(service.listAttachments(doc.id)).toHaveLength(1)

    const stored = service.listAttachments(doc.id)[0]
    expect(stored).toBeTruthy()

    const backupPath = join(root, 'Docs.everkeep-backup')
    const backup = await service.backup({ destinationPath: backupPath })
    expect(backup.backupPath).toBe(backupPath)
    expect(existsSync(backupPath)).toBe(true)

    const zip = await JSZip.loadAsync(readFileSync(backupPath))
    expect(zip.file('vault.everkeep')).toBeTruthy()
    expect(zip.file(`attachments/${attached.id}/will-scan.pdf`)).toBeTruthy()

    service.removeAttachment(attached.id)
    expect(service.listAttachments(doc.id)).toHaveLength(0)

    const restorePath = join(root, 'Restored.everkeep')
    await service.restoreBackup({
      backupPath,
      destinationPath: restorePath
    })
    const restoredDocs = service.listEntries('documents')
    expect(restoredDocs.some((item) => item.title === 'Will scan')).toBe(true)
    const restoredAttachments = service.listAttachments(doc.id)
    expect(restoredAttachments).toHaveLength(1)
    expect(existsSync(
      join(attachmentsRoot, service.getStatus().session!.metadata.id, attached.id, 'will-scan.pdf')
    ) || restoredAttachments[0]).toBeTruthy()

    service.closeVault()
  })
})

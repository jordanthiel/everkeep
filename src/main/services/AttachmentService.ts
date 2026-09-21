import {
  copyFileSync,
  mkdtempSync,
  rmSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { withTransaction } from '../database/connection'
import { basename, dirname, extname, join } from 'path'
import { createHash } from 'crypto'
import { pipeline } from 'stream/promises'
import JSZip from 'jszip'
import { shell } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { Attachment } from '../../shared/types/attachment'

const openedCopies = new Set<string>()
export function clearOpenedAttachments(): void {
  for (const dir of openedCopies) {
    try { rmSync(dir, { recursive: true, force: true }); openedCopies.delete(dir) } catch { /* External viewer may hold the file open. Retry on next lock. */ }
  }
}

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

export class AttachmentServiceError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = 'AttachmentServiceError'
  }
}

export class AttachmentService {
  constructor(
    private readonly db: VaultDatabase,
    private readonly vaultId: string,
    private readonly attachmentsRoot: string,
    private readonly protectedStorage = false
  ) {}

  listForEntry(entryId: string): Attachment[] {
    return new AttachmentRepository(this.db).listForEntry(entryId)
  }

  attachFromPath(entryId: string, sourcePath: string): Attachment {
    if (!existsSync(sourcePath)) {
      throw new AttachmentServiceError('Selected file was not found.', 'FILE_NOT_FOUND')
    }

    const stats = statSync(sourcePath)
    if (!stats.isFile()) {
      throw new AttachmentServiceError('Selected path is not a file.', 'NOT_A_FILE')
    }
    if (stats.size > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentServiceError(
        'Attachments are limited to 50 MB in this version.',
        'FILE_TOO_LARGE'
      )
    }

    const entry = this.db
      .prepare('SELECT id FROM vault_entries WHERE id = ? AND archived_at IS NULL')
      .get(entryId) as { id: string } | undefined
    if (!entry) {
      throw new AttachmentServiceError('Document record not found.', 'ENTRY_NOT_FOUND')
    }

    const attachmentId = uuidv4()
    const originalName = basename(sourcePath)
    const safeName = originalName.replace(/[^\w.\- ()[\]]+/g, '_')
    const dir = join(this.attachmentsRoot, attachmentId)
    const storagePath = this.protectedStorage ? `vault:${attachmentId}` : join(dir, safeName)
    const content = readFileSync(sourcePath)
    if (!this.protectedStorage) { mkdirSync(dir, { recursive: true }); copyFileSync(sourcePath, storagePath) }
    const checksum = createHash('sha256').update(content).digest('hex')
    const mimeType = guessMime(extname(safeName))

    return withTransaction(this.db, () => {
    const attachment = new AttachmentRepository(this.db).create({
      id: attachmentId,
      entryId,
      filename: originalName,
      mimeType,
      sizeBytes: stats.size,
      storagePath,
      checksum
    })
    if (this.protectedStorage) this.db.prepare('INSERT INTO attachment_contents (attachment_id, content) VALUES (?, ?)').run(attachmentId, content)
    return attachment
    })
  }

  async open(id: string): Promise<{ opened: boolean }> {
    const attachment = new AttachmentRepository(this.db).getById(id)
    if (!attachment) {
      throw new AttachmentServiceError('Attachment not found.', 'NOT_FOUND')
    }
    const result = await shell.openPath(this.materialize(attachment))
    if (result) {
      throw new AttachmentServiceError(result, 'OPEN_FAILED')
    }
    return { opened: true }
  }

  revealInFolder(id: string): { revealed: boolean } {
    const attachment = new AttachmentRepository(this.db).getById(id)
    if (!attachment) {
      throw new AttachmentServiceError('Attachment not found.', 'NOT_FOUND')
    }
    shell.showItemInFolder(this.materialize(attachment))
    return { revealed: true }
  }

  remove(id: string): { removed: boolean } {
    const repo = new AttachmentRepository(this.db)
    const attachment = repo.getById(id)
    if (!attachment) return { removed: false }

    withTransaction(this.db, () => {
      repo.archive(id)
      this.db.prepare('DELETE FROM attachment_contents WHERE attachment_id = ?').run(id)
    })
    try {
      if (existsSync(attachment.storagePath)) {
        unlinkSync(attachment.storagePath)
      }
    } catch {
      // Best-effort file cleanup; DB row is archived either way.
    }
    return { removed: true }
  }

  private materialize(attachment: Attachment & { storagePath: string }): string {
    const stored = this.db.prepare('SELECT content FROM attachment_contents WHERE attachment_id = ?').get(attachment.id) as { content: Buffer } | undefined
    if (!stored) {
      if (!existsSync(attachment.storagePath)) throw new AttachmentServiceError('The attachment is missing. Restore it from a backup.', 'FILE_MISSING')
      return attachment.storagePath
    }
    const dir = mkdtempSync(join(tmpdir(), 'everkeep-view-'))
    openedCopies.add(dir)
    const path = join(dir, basename(attachment.filename))
    writeFileSync(path, stored.content, { mode: 0o600 })
    return path
  }

  /** Stage existing attachment bytes inside the database before replacing the vault. */
  importLocalAttachments(): string[] {
    const oldPaths: string[] = []
    for (const attachment of new AttachmentRepository(this.db).listAllActive()) {
      if (this.db.prepare('SELECT 1 FROM attachment_contents WHERE attachment_id = ?').get(attachment.id)) continue
      if (!existsSync(attachment.storagePath)) throw new AttachmentServiceError(`Missing attachment: ${attachment.filename}. Restore it before enabling full protection.`, 'FILE_MISSING')
      const content = readFileSync(attachment.storagePath)
      this.db.prepare('INSERT INTO attachment_contents (attachment_id, content) VALUES (?, ?)').run(attachment.id, content)
      this.db.prepare('UPDATE attachments SET storage_path = ? WHERE id = ?').run(`vault:${attachment.id}`, attachment.id)
      oldPaths.push(attachment.storagePath)
    }
    return oldPaths
  }

  async writeBackupArchive(vaultFilePath: string, destinationPath: string): Promise<string> {
    const zip = new JSZip()
    zip.file('vault.everkeep', readFileSync(vaultFilePath))
    if (this.protectedStorage) {
      const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
      const { atomicWrite } = await import('../security/ProtectedVaultFile')
      atomicWrite(destinationPath, content)
      return destinationPath
    }

    const attachments = new AttachmentRepository(this.db).listAllActive()
    const attachmentManifest = attachments.map((attachment) => ({
      id: attachment.id,
      entryId: attachment.entryId,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      relativePath: `attachments/${attachment.id}/${attachment.filename}`
    }))

    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          format: 'everkeep-backup',
          version: 1,
          createdAt: new Date().toISOString(),
          vaultId: this.vaultId,
          attachments: attachmentManifest
        },
        null,
        2
      )
    )

    for (const attachment of attachments) {
      const stored = this.db.prepare('SELECT content FROM attachment_contents WHERE attachment_id = ?').get(attachment.id) as { content: Buffer } | undefined
      if (!stored && !existsSync(attachment.storagePath)) throw new AttachmentServiceError(`Missing attachment: ${attachment.filename}. Restore it before backing up.`, 'FILE_MISSING')
      const data = stored?.content ?? readFileSync(attachment.storagePath)
      zip.file(`attachments/${attachment.id}/${attachment.filename}`, data)
    }

    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    writeFileSync(destinationPath, content)
    return destinationPath
  }

  static async extractVaultFromBackup(
    backupArchivePath: string,
    destinationVaultPath: string
  ): Promise<void> {
    const zip = await JSZip.loadAsync(readFileSync(backupArchivePath))
    const vaultFile = zip.file('vault.everkeep')
    if (!vaultFile) {
      throw new AttachmentServiceError(
        'This backup does not contain a vault file.',
        'INVALID_BACKUP'
      )
    }
    mkdirSync(dirname(destinationVaultPath), { recursive: true })
    writeFileSync(destinationVaultPath, await vaultFile.async('nodebuffer'))
  }

  async restoreAttachmentFilesFromBackup(backupArchivePath: string): Promise<number> {
    const zip = await JSZip.loadAsync(readFileSync(backupArchivePath))
    const attachments = new AttachmentRepository(this.db).listAllActive()
    let restored = 0
    for (const attachment of attachments) {
      const entry = zip.file(`attachments/${attachment.id}/${attachment.filename}`)
      if (!entry) continue
      if (this.protectedStorage) {
        const content = await entry.async('nodebuffer')
        withTransaction(this.db, () => {
          this.db.prepare('INSERT OR REPLACE INTO attachment_contents (attachment_id, content) VALUES (?, ?)').run(attachment.id, content)
          this.db.prepare('UPDATE attachments SET storage_path = ? WHERE id = ?').run(`vault:${attachment.id}`, attachment.id)
        })
        restored += 1
        continue
      }
      const dir = join(this.attachmentsRoot, attachment.id)
      mkdirSync(dir, { recursive: true })
      const target = join(dir, basename(attachment.storagePath))
      writeFileSync(target, await entry.async('nodebuffer'))
      // Ensure DB path points at restored location
      this.db
        .prepare('UPDATE attachments SET storage_path = ?, updated_at = ? WHERE id = ?')
        .run(target, new Date().toISOString(), attachment.id)
      restored += 1
    }
    return restored
  }
}

function guessMime(extension: string): string | null {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.zip': 'application/zip'
  }
  return map[extension.toLowerCase()] ?? null
}

/** Available for future streaming copy of large files. */
export async function copyFileStream(source: string, destination: string): Promise<void> {
  await pipeline(createReadStream(source), createWriteStream(destination))
}

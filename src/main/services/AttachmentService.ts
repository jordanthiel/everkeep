import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, join } from 'path'
import { createHash } from 'crypto'
import { pipeline } from 'stream/promises'
import JSZip from 'jszip'
import { shell } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { Attachment } from '../../shared/types/attachment'

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
    private readonly attachmentsRoot: string
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
    mkdirSync(dir, { recursive: true })
    const storagePath = join(dir, safeName)
    copyFileSync(sourcePath, storagePath)

    const checksum = createHash('sha256').update(readFileSync(storagePath)).digest('hex')
    const mimeType = guessMime(extname(safeName))

    return new AttachmentRepository(this.db).create({
      id: attachmentId,
      entryId,
      filename: originalName,
      mimeType,
      sizeBytes: stats.size,
      storagePath,
      checksum
    })
  }

  async open(id: string): Promise<{ opened: boolean }> {
    const attachment = new AttachmentRepository(this.db).getById(id)
    if (!attachment) {
      throw new AttachmentServiceError('Attachment not found.', 'NOT_FOUND')
    }
    if (!existsSync(attachment.storagePath)) {
      throw new AttachmentServiceError(
        'The file is missing from local storage. Restore from a backup if you have one.',
        'FILE_MISSING'
      )
    }
    const result = await shell.openPath(attachment.storagePath)
    if (result) {
      throw new AttachmentServiceError(result, 'OPEN_FAILED')
    }
    return { opened: true }
  }

  revealInFolder(id: string): { revealed: boolean } {
    const attachment = new AttachmentRepository(this.db).getById(id)
    if (!attachment || !existsSync(attachment.storagePath)) {
      throw new AttachmentServiceError('Attachment not found.', 'NOT_FOUND')
    }
    shell.showItemInFolder(attachment.storagePath)
    return { revealed: true }
  }

  remove(id: string): { removed: boolean } {
    const repo = new AttachmentRepository(this.db)
    const attachment = repo.getById(id)
    if (!attachment) return { removed: false }

    repo.archive(id)
    try {
      if (existsSync(attachment.storagePath)) {
        unlinkSync(attachment.storagePath)
      }
    } catch {
      // Best-effort file cleanup; DB row is archived either way.
    }
    return { removed: true }
  }

  async writeBackupArchive(vaultFilePath: string, destinationPath: string): Promise<string> {
    const zip = new JSZip()
    zip.file('vault.everkeep', readFileSync(vaultFilePath))

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
      if (!existsSync(attachment.storagePath)) continue
      const data = readFileSync(attachment.storagePath)
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

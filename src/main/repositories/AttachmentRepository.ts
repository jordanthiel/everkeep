import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import type { Attachment } from '../../shared/types/attachment'

interface AttachmentRow {
  id: string
  entry_id: string | null
  filename: string
  mime_type: string | null
  size_bytes: number | null
  storage_path: string
  checksum: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export class AttachmentRepository {
  constructor(private readonly db: VaultDatabase) {}

  listForEntry(entryId: string): Attachment[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM attachments
         WHERE entry_id = ? AND archived_at IS NULL
         ORDER BY created_at DESC`
      )
      .all(entryId) as AttachmentRow[]
    return rows.map((row) => this.map(row))
  }

  getById(id: string): (Attachment & { storagePath: string }) | null {
    const row = this.db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
      | AttachmentRow
      | undefined
    if (!row || row.archived_at) return null
    return { ...this.map(row), storagePath: row.storage_path }
  }

  create(input: {
    id?: string
    entryId: string
    filename: string
    mimeType: string | null
    sizeBytes: number
    storagePath: string
    checksum: string | null
  }): Attachment {
    const id = input.id ?? uuidv4()
    const now = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO attachments (
          id, entry_id, filename, mime_type, size_bytes, storage_path, checksum,
          created_at, updated_at, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(
        id,
        input.entryId,
        input.filename,
        input.mimeType,
        input.sizeBytes,
        input.storagePath,
        input.checksum,
        now,
        now
      )

    const created = this.getById(id)
    if (!created) throw new Error('Failed to create attachment')
    return created
  }

  archive(id: string): boolean {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `UPDATE attachments SET archived_at = ?, updated_at = ?
         WHERE id = ? AND archived_at IS NULL`
      )
      .run(now, now, id)
    return result.changes > 0
  }

  listAllActive(): Array<Attachment & { storagePath: string }> {
    const rows = this.db
      .prepare(
        `SELECT * FROM attachments WHERE archived_at IS NULL ORDER BY created_at ASC`
      )
      .all() as AttachmentRow[]
    return rows.map((row) => ({ ...this.map(row), storagePath: row.storage_path }))
  }

  private map(row: AttachmentRow): Attachment {
    return {
      id: row.id,
      entryId: row.entry_id,
      filename: row.filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

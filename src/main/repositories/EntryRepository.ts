import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import { withTransaction } from '../database/connection'
import type { EncryptionService } from '../security/EncryptionService'
import type {
  CreateVaultEntryInput,
  UpdateVaultEntryInput,
  VaultEntry,
  VaultSectionId
} from '../../shared/types/entry'

interface EntryRow {
  id: string
  section: string
  kind: string | null
  title: string
  fields_json: string
  sensitive_json_encrypted: string | null
  notes: string | null
  location_text: string | null
  created_at: string
  updated_at: string
  last_reviewed_at: string | null
  archived_at: string | null
}

export class EntryRepository {
  constructor(
    private readonly db: VaultDatabase,
    private readonly encryption: EncryptionService | null,
    private readonly key: Buffer | null
  ) {}

  list(section: VaultSectionId): VaultEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM vault_entries
         WHERE section = ? AND archived_at IS NULL
         ORDER BY updated_at DESC`
      )
      .all(section) as EntryRow[]
    return rows.map((row) => this.map(row))
  }

  listAll(): VaultEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM vault_entries
         WHERE archived_at IS NULL
         ORDER BY section ASC, updated_at DESC`
      )
      .all() as EntryRow[]
    return rows.map((row) => this.map(row))
  }

  countActive(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS count FROM vault_entries WHERE archived_at IS NULL')
      .get() as { count: number }
    return row.count
  }

  getById(id: string): VaultEntry | null {
    const row = this.db.prepare('SELECT * FROM vault_entries WHERE id = ?').get(id) as
      | EntryRow
      | undefined
    return row ? this.map(row) : null
  }

  create(input: CreateVaultEntryInput): VaultEntry {
    const id = uuidv4()
    const now = new Date().toISOString()
    withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO vault_entries (
            id, section, kind, title, fields_json, sensitive_json_encrypted, notes, location_text,
            created_at, updated_at, last_reviewed_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .run(
          id,
          input.section,
          input.kind ?? null,
          input.title,
          JSON.stringify(input.fields ?? {}),
          this.encryptSensitive(input.sensitiveFields ?? {}),
          input.notes ?? null,
          input.locationText ?? null,
          now,
          now
        )
      this.audit(id, 'created', now)
    })
    const created = this.getById(id)
    if (!created) throw new Error('Failed to create entry')
    return created
  }

  update(input: UpdateVaultEntryInput): VaultEntry {
    const existing = this.getById(input.id)
    if (!existing || existing.archivedAt) throw new Error('Entry not found')
    const now = new Date().toISOString()

    withTransaction(this.db, () => {
      let sensitivePayload: string | null
      if (input.sensitiveFields !== undefined) {
        sensitivePayload = this.encryptSensitive(input.sensitiveFields)
      } else {
        const current = this.db
          .prepare('SELECT sensitive_json_encrypted FROM vault_entries WHERE id = ?')
          .get(input.id) as { sensitive_json_encrypted: string | null }
        sensitivePayload = current.sensitive_json_encrypted
      }

      this.db
        .prepare(
          `UPDATE vault_entries SET
            kind = ?, title = ?, fields_json = ?, sensitive_json_encrypted = ?,
            notes = ?, location_text = ?, last_reviewed_at = ?, updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.kind !== undefined ? input.kind : existing.kind,
          input.title ?? existing.title,
          JSON.stringify(input.fields ?? existing.fields),
          sensitivePayload,
          input.notes !== undefined ? input.notes : existing.notes,
          input.locationText !== undefined ? input.locationText : existing.locationText,
          input.lastReviewedAt !== undefined ? input.lastReviewedAt : existing.lastReviewedAt,
          now,
          input.id
        )
      this.audit(input.id, 'updated', now)
    })

    const updated = this.getById(input.id)
    if (!updated) throw new Error('Failed to update entry')
    return updated
  }

  archive(id: string): boolean {
    const existing = this.getById(id)
    if (!existing || existing.archivedAt) return false
    const now = new Date().toISOString()
    withTransaction(this.db, () => {
      this.db
        .prepare('UPDATE vault_entries SET archived_at = ?, updated_at = ? WHERE id = ?')
        .run(now, now, id)
      this.audit(id, 'archived', now)
    })
    return true
  }

  markReviewed(id: string): VaultEntry {
    return this.update({ id, lastReviewedAt: new Date().toISOString() })
  }

  private encryptSensitive(fields: Record<string, string>): string | null {
    const keys = Object.keys(fields).filter((key) => fields[key]?.trim())
    if (keys.length === 0) return null
    const json = JSON.stringify(fields)
    if (!this.encryption || !this.key) {
      return JSON.stringify({ v: 0, plain: json })
    }
    return this.encryption.encrypt(json, this.key)
  }

  private decryptSensitive(payload: string | null): Record<string, string> {
    if (!payload) return {}
    try {
      const parsed = JSON.parse(payload) as { v?: number; plain?: string }
      if (parsed.v === 0 && typeof parsed.plain === 'string') {
        return JSON.parse(parsed.plain) as Record<string, string>
      }
    } catch {
      // encrypted path
    }
    if (!this.encryption || !this.key) return {}
    try {
      return JSON.parse(this.encryption.decrypt(payload, this.key)) as Record<string, string>
    } catch {
      return {}
    }
  }

  private audit(entityId: string, event: string, timestamp: string): void {
    this.db
      .prepare(
        'INSERT INTO audit_log (id, entity, entity_id, event, timestamp) VALUES (?, ?, ?, ?, ?)'
      )
      .run(uuidv4(), 'vault_entries', entityId, event, timestamp)
  }

  private map(row: EntryRow): VaultEntry {
    let fields: Record<string, string> = {}
    try {
      fields = JSON.parse(row.fields_json) as Record<string, string>
    } catch {
      fields = {}
    }
    return {
      id: row.id,
      section: row.section as VaultSectionId,
      kind: row.kind,
      title: row.title,
      fields,
      sensitiveFields: this.decryptSensitive(row.sensitive_json_encrypted),
      notes: row.notes,
      locationText: row.location_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastReviewedAt: row.last_reviewed_at,
      archivedAt: row.archived_at
    }
  }
}

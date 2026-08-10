import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import { withTransaction } from '../database/connection'
import type {
  Contact,
  ContactRole,
  CreateContactInput,
  UpdateContactInput
} from '../../shared/types/contact'

interface ContactRow {
  id: string
  name: string
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
  last_reviewed_at: string | null
  archived_at: string | null
}

export class ContactRepository {
  constructor(private readonly db: VaultDatabase) {}

  list(): Contact[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM contacts WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE ASC'
      )
      .all() as ContactRow[]
    return rows.map((row) => this.map(row))
  }

  getById(id: string): Contact | null {
    const row = this.db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as
      | ContactRow
      | undefined
    return row ? this.map(row) : null
  }

  create(input: CreateContactInput): Contact {
    const id = uuidv4()
    const now = new Date().toISOString()

    withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO contacts (
            id, name, company, role, phone, email, address, website, notes,
            created_at, updated_at, last_reviewed_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        )
        .run(
          id,
          input.name,
          input.company ?? null,
          input.role ?? null,
          input.phone ?? null,
          input.email ?? null,
          input.address ?? null,
          input.website ?? null,
          input.notes ?? null,
          now,
          now,
          now
        )
      this.audit(id, 'created', now)
    })

    const contact = this.getById(id)
    if (!contact) throw new Error('Failed to create contact')
    return contact
  }

  update(input: UpdateContactInput): Contact {
    const existing = this.getById(input.id)
    if (!existing || existing.archivedAt) throw new Error('Contact not found')

    const now = new Date().toISOString()
    withTransaction(this.db, () => {
      this.db
        .prepare(
          `UPDATE contacts SET
            name = ?, company = ?, role = ?, phone = ?, email = ?, address = ?,
            website = ?, notes = ?, last_reviewed_at = ?, updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.name ?? existing.name,
          input.company !== undefined ? input.company : existing.company,
          input.role !== undefined ? input.role : existing.role,
          input.phone !== undefined ? input.phone : existing.phone,
          input.email !== undefined ? input.email : existing.email,
          input.address !== undefined ? input.address : existing.address,
          input.website !== undefined ? input.website : existing.website,
          input.notes !== undefined ? input.notes : existing.notes,
          input.lastReviewedAt !== undefined ? input.lastReviewedAt : existing.lastReviewedAt,
          now,
          input.id
        )
      this.audit(input.id, 'updated', now)
    })

    const contact = this.getById(input.id)
    if (!contact) throw new Error('Failed to update contact')
    return contact
  }

  archive(id: string): boolean {
    const existing = this.getById(id)
    if (!existing || existing.archivedAt) return false
    const now = new Date().toISOString()
    withTransaction(this.db, () => {
      this.db
        .prepare('UPDATE contacts SET archived_at = ?, updated_at = ? WHERE id = ?')
        .run(now, now, id)
      this.audit(id, 'archived', now)
    })
    return true
  }

  markReviewed(id: string): Contact {
    return this.update({ id, lastReviewedAt: new Date().toISOString() })
  }

  private audit(entityId: string, event: string, timestamp: string): void {
    this.db
      .prepare(
        'INSERT INTO audit_log (id, entity, entity_id, event, timestamp) VALUES (?, ?, ?, ?, ?)'
      )
      .run(uuidv4(), 'contacts', entityId, event, timestamp)
  }

  private map(row: ContactRow): Contact {
    return {
      id: row.id,
      name: row.name,
      company: row.company,
      role: row.role as ContactRole | null,
      phone: row.phone,
      email: row.email,
      address: row.address,
      website: row.website,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastReviewedAt: row.last_reviewed_at,
      archivedAt: row.archived_at
    }
  }
}

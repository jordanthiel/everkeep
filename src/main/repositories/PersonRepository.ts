import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import { withTransaction } from '../database/connection'
import type {
  CreatePersonInput,
  Person,
  PersonRelationship,
  PersonRole,
  UpdatePersonInput
} from '../../shared/types/person'

interface PersonRow {
  id: string
  full_name: string
  relationship: string | null
  date_of_birth: string | null
  phone: string | null
  email: string | null
  address: string | null
  company: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
  last_reviewed_at: string | null
  archived_at: string | null
}

export class PersonRepository {
  constructor(private readonly db: VaultDatabase) {}

  list(includeArchived = false): Person[] {
    const sql = includeArchived
      ? 'SELECT * FROM people ORDER BY full_name COLLATE NOCASE ASC'
      : 'SELECT * FROM people WHERE archived_at IS NULL ORDER BY full_name COLLATE NOCASE ASC'

    const rows = this.db.prepare(sql).all() as PersonRow[]
    return rows.map((row) => this.mapPerson(row))
  }

  getById(id: string): Person | null {
    const row = this.db.prepare('SELECT * FROM people WHERE id = ?').get(id) as PersonRow | undefined
    return row ? this.mapPerson(row) : null
  }

  create(input: CreatePersonInput): Person {
    const id = uuidv4()
    const now = new Date().toISOString()

    withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO people (
            id, full_name, relationship, date_of_birth, phone, email, address, notes,
            company, website, created_at, updated_at, last_reviewed_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        )
        .run(
          id,
          input.fullName,
          input.relationship ?? null,
          input.dateOfBirth ?? null,
          input.phone ?? null,
          input.email ?? null,
          input.address ?? null,
          input.notes ?? null,
          input.company ?? null,
          input.website ?? null,
          now,
          now,
          now
        )

      for (const role of input.roles ?? []) {
        this.insertRole(id, role, now)
      }

      this.insertAudit('people', id, 'created', now)
    })

    const person = this.getById(id)
    if (!person) {
      throw new Error('Failed to create person')
    }
    return person
  }

  update(input: UpdatePersonInput): Person {
    const existing = this.getById(input.id)
    if (!existing || existing.archivedAt) {
      throw new Error('Person not found')
    }

    const now = new Date().toISOString()

    withTransaction(this.db, () => {
      this.db
        .prepare(
          `UPDATE people SET
            full_name = ?,
            relationship = ?,
            date_of_birth = ?,
            phone = ?,
            email = ?,
            address = ?,
            company = ?,
            website = ?,
            notes = ?,
            last_reviewed_at = ?,
            updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.fullName ?? existing.fullName,
          input.relationship !== undefined ? input.relationship : existing.relationship,
          input.dateOfBirth !== undefined ? input.dateOfBirth : existing.dateOfBirth,
          input.phone !== undefined ? input.phone : existing.phone,
          input.email !== undefined ? input.email : existing.email,
          input.address !== undefined ? input.address : existing.address,
          input.company !== undefined ? input.company : existing.company,
          input.website !== undefined ? input.website : existing.website,
          input.notes !== undefined ? input.notes : existing.notes,
          input.lastReviewedAt !== undefined ? input.lastReviewedAt : existing.lastReviewedAt,
          now,
          input.id
        )

      if (input.roles) {
        this.db.prepare('DELETE FROM person_roles WHERE person_id = ?').run(input.id)
        for (const role of input.roles) {
          this.insertRole(input.id, role, now)
        }
      }

      this.insertAudit('people', input.id, 'updated', now)
    })

    const person = this.getById(input.id)
    if (!person) {
      throw new Error('Failed to update person')
    }
    return person
  }

  archive(id: string): boolean {
    const existing = this.getById(id)
    if (!existing || existing.archivedAt) {
      return false
    }

    const now = new Date().toISOString()
    withTransaction(this.db, () => {
      this.db
        .prepare('UPDATE people SET archived_at = ?, updated_at = ? WHERE id = ?')
        .run(now, now, id)
      this.insertAudit('people', id, 'archived', now)
    })
    return true
  }

  markReviewed(id: string): Person {
    return this.update({ id, lastReviewedAt: new Date().toISOString() })
  }

  private insertRole(personId: string, role: PersonRole, createdAt: string): void {
    this.db
      .prepare(
        'INSERT INTO person_roles (id, person_id, role, created_at) VALUES (?, ?, ?, ?)'
      )
      .run(uuidv4(), personId, role, createdAt)
  }

  private insertAudit(entity: string, entityId: string, event: string, timestamp: string): void {
    this.db
      .prepare(
        'INSERT INTO audit_log (id, entity, entity_id, event, timestamp) VALUES (?, ?, ?, ?, ?)'
      )
      .run(uuidv4(), entity, entityId, event, timestamp)
  }

  private mapPerson(row: PersonRow): Person {
    const roleRows = this.db
      .prepare('SELECT role FROM person_roles WHERE person_id = ? ORDER BY role ASC')
      .all(row.id) as Array<{ role: string }>

    return {
      id: row.id,
      fullName: row.full_name,
      relationship: row.relationship as PersonRelationship | null,
      dateOfBirth: row.date_of_birth,
      phone: row.phone,
      email: row.email,
      address: row.address,
      company: row.company,
      website: row.website,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastReviewedAt: row.last_reviewed_at,
      archivedAt: row.archived_at,
      roles: roleRows.map((r) => r.role as PersonRole)
    }
  }
}

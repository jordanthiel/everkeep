import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import { withTransaction } from '../database/connection'
import type {
  CreateDigitalAccountInput,
  DigitalAccount,
  DigitalCategory
} from '../../shared/types/digital'

interface DigitalRow {
  id: string
  category: string
  provider: string | null
  account_identifier: string | null
  url: string | null
  instructions: string | null
  preference: string | null
  notes: string | null
  created_at: string
  updated_at: string
  last_reviewed_at: string | null
  archived_at: string | null
}

export class DigitalAccountRepository {
  constructor(private readonly db: VaultDatabase) {}

  list(): DigitalAccount[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM digital_accounts
         WHERE archived_at IS NULL
         ORDER BY category ASC, provider COLLATE NOCASE ASC`
      )
      .all() as DigitalRow[]
    return rows.map((row) => this.map(row))
  }

  create(input: CreateDigitalAccountInput): DigitalAccount {
    const id = uuidv4()
    const now = new Date().toISOString()
    withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO digital_accounts (
            id, category, provider, account_identifier, url, instructions, preference, notes,
            created_at, updated_at, last_reviewed_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        )
        .run(
          id,
          input.category,
          input.provider ?? null,
          input.accountIdentifier ?? null,
          input.url ?? null,
          input.instructions ?? null,
          input.preference ?? null,
          input.notes ?? null,
          now,
          now,
          now
        )
      this.db
        .prepare(
          'INSERT INTO audit_log (id, entity, entity_id, event, timestamp) VALUES (?, ?, ?, ?, ?)'
        )
        .run(uuidv4(), 'digital_accounts', id, 'created', now)
    })

    const created = this.list().find((item) => item.id === id)
    if (!created) throw new Error('Failed to create digital account')
    return created
  }

  archive(id: string): boolean {
    const now = new Date().toISOString()
    const result = this.db
      .prepare(
        `UPDATE digital_accounts SET archived_at = ?, updated_at = ?
         WHERE id = ? AND archived_at IS NULL`
      )
      .run(now, now, id)
    return result.changes > 0
  }

  private map(row: DigitalRow): DigitalAccount {
    return {
      id: row.id,
      category: row.category as DigitalCategory,
      provider: row.provider,
      accountIdentifier: row.account_identifier,
      url: row.url,
      instructions: row.instructions,
      preference: row.preference,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastReviewedAt: row.last_reviewed_at,
      archivedAt: row.archived_at
    }
  }
}

import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import { withTransaction } from '../database/connection'
import type {
  Account,
  AccountType,
  BeneficiaryDesignation,
  BeneficiaryDesignationType,
  CreateAccountInput,
  UpdateAccountInput
} from '../../shared/types/account'
import type { EncryptionService } from '../security/EncryptionService'

interface AccountRow {
  id: string
  institution: string
  account_name: string | null
  account_type: string
  last_four: string | null
  full_account_number_encrypted: string | null
  approximate_value: number | null
  transfer_on_death: number | null
  contact_info: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
  last_reviewed_at: string | null
  archived_at: string | null
}

export class AccountRepository {
  constructor(
    private readonly db: VaultDatabase,
    private readonly encryption: EncryptionService | null,
    private readonly key: Buffer | null
  ) {}

  list(): Account[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM accounts WHERE archived_at IS NULL ORDER BY institution COLLATE NOCASE ASC'
      )
      .all() as AccountRow[]
    return rows.map((row) => this.map(row))
  }

  getById(id: string): Account | null {
    const row = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as
      | AccountRow
      | undefined
    return row ? this.map(row) : null
  }

  create(input: CreateAccountInput): Account {
    this.assertBeneficiaryPercents(input.beneficiaries)
    const id = uuidv4()
    const now = new Date().toISOString()

    withTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO accounts (
            id, institution, account_name, account_type, last_four, full_account_number_encrypted,
            approximate_value, transfer_on_death, contact_info, website, notes,
            created_at, updated_at, last_reviewed_at, archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        )
        .run(
          id,
          input.institution,
          input.accountName ?? null,
          input.accountType,
          input.lastFour ?? null,
          this.encryptSensitive(input.fullAccountNumber ?? null),
          input.approximateValue ?? null,
          input.transferOnDeath ? 1 : 0,
          input.contactInfo ?? null,
          input.website ?? null,
          input.notes ?? null,
          now,
          now,
          now
        )

      for (const personId of input.ownerPersonIds ?? []) {
        this.db
          .prepare(
            'INSERT INTO account_owners (id, account_id, person_id) VALUES (?, ?, ?)'
          )
          .run(uuidv4(), id, personId)
      }

      for (const beneficiary of input.beneficiaries ?? []) {
        this.insertBeneficiary(id, beneficiary, now)
      }

      this.audit(id, 'created', now)
    })

    const account = this.getById(id)
    if (!account) throw new Error('Failed to create account')
    return account
  }

  update(input: UpdateAccountInput): Account {
    const existing = this.getById(input.id)
    if (!existing || existing.archivedAt) throw new Error('Account not found')
    if (input.beneficiaries) this.assertBeneficiaryPercents(input.beneficiaries)

    const now = new Date().toISOString()
    withTransaction(this.db, () => {
      let encryptedValue: string | null
      if (input.fullAccountNumber !== undefined) {
        encryptedValue = this.encryptSensitive(input.fullAccountNumber)
      } else {
        const current = this.db
          .prepare('SELECT full_account_number_encrypted FROM accounts WHERE id = ?')
          .get(input.id) as { full_account_number_encrypted: string | null }
        encryptedValue = current.full_account_number_encrypted
      }

      this.db
        .prepare(
          `UPDATE accounts SET
            institution = ?, account_name = ?, account_type = ?, last_four = ?,
            full_account_number_encrypted = ?, approximate_value = ?, transfer_on_death = ?,
            contact_info = ?, website = ?, notes = ?, last_reviewed_at = ?, updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.institution ?? existing.institution,
          input.accountName !== undefined ? input.accountName : existing.accountName,
          input.accountType ?? existing.accountType,
          input.lastFour !== undefined ? input.lastFour : existing.lastFour,
          encryptedValue,
          input.approximateValue !== undefined
            ? input.approximateValue
            : existing.approximateValue,
          input.transferOnDeath !== undefined
            ? input.transferOnDeath
              ? 1
              : 0
            : existing.transferOnDeath
              ? 1
              : 0,
          input.contactInfo !== undefined ? input.contactInfo : existing.contactInfo,
          input.website !== undefined ? input.website : existing.website,
          input.notes !== undefined ? input.notes : existing.notes,
          input.lastReviewedAt !== undefined ? input.lastReviewedAt : existing.lastReviewedAt,
          now,
          input.id
        )

      if (input.ownerPersonIds) {
        this.db.prepare('DELETE FROM account_owners WHERE account_id = ?').run(input.id)
        for (const personId of input.ownerPersonIds) {
          this.db
            .prepare(
              'INSERT INTO account_owners (id, account_id, person_id) VALUES (?, ?, ?)'
            )
            .run(uuidv4(), input.id, personId)
        }
      }

      if (input.beneficiaries) {
        this.db.prepare('DELETE FROM beneficiary_designations WHERE account_id = ?').run(input.id)
        for (const beneficiary of input.beneficiaries) {
          this.insertBeneficiary(input.id, beneficiary, now)
        }
        this.audit(input.id, 'beneficiaries_changed', now)
      }

      this.audit(input.id, 'updated', now)
    })

    const account = this.getById(input.id)
    if (!account) throw new Error('Failed to update account')
    return account
  }

  archive(id: string): boolean {
    const existing = this.getById(id)
    if (!existing || existing.archivedAt) return false
    const now = new Date().toISOString()
    withTransaction(this.db, () => {
      this.db
        .prepare('UPDATE accounts SET archived_at = ?, updated_at = ? WHERE id = ?')
        .run(now, now, id)
      this.audit(id, 'archived', now)
    })
    return true
  }

  markReviewed(id: string): Account {
    return this.update({ id, lastReviewedAt: new Date().toISOString() })
  }

  private insertBeneficiary(
    accountId: string,
    beneficiary: {
      personId: string
      designationType: BeneficiaryDesignationType
      percentage: number
      perStirpes?: boolean
      notes?: string | null
    },
    now: string
  ): void {
    this.db
      .prepare(
        `INSERT INTO beneficiary_designations (
          id, account_id, person_id, designation_type, percentage, per_stirpes, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uuidv4(),
        accountId,
        beneficiary.personId,
        beneficiary.designationType,
        beneficiary.percentage,
        beneficiary.perStirpes ? 1 : 0,
        beneficiary.notes ?? null,
        now,
        now
      )
  }

  private assertBeneficiaryPercents(
    beneficiaries:
      | Array<{ designationType: BeneficiaryDesignationType; percentage: number }>
      | undefined
  ): void {
    if (!beneficiaries || beneficiaries.length === 0) return

    for (const type of ['primary', 'contingent'] as const) {
      const group = beneficiaries.filter((b) => b.designationType === type)
      if (group.length === 0) continue
      const total = group.reduce((sum, b) => sum + b.percentage, 0)
      if (Math.abs(total - 100) > 0.01) {
        throw new Error(`${type} beneficiary percentages must total 100% (currently ${total}%).`)
      }
    }
  }

  private encryptSensitive(value: string | null): string | null {
    if (!value) return null
    if (!this.encryption || !this.key) {
      // Unprotected vault: store as opaque JSON marker without claiming encryption.
      return JSON.stringify({ v: 0, plain: value })
    }
    return this.encryption.encrypt(value, this.key)
  }

  private decryptSensitive(payload: string | null): string | null {
    if (!payload) return null
    try {
      const parsed = JSON.parse(payload) as { v?: number; plain?: string }
      if (parsed.v === 0 && typeof parsed.plain === 'string') {
        return parsed.plain
      }
    } catch {
      // Fall through to encrypted decrypt
    }

    if (!this.encryption || !this.key) {
      return null
    }

    try {
      return this.encryption.decrypt(payload, this.key)
    } catch {
      return null
    }
  }

  private audit(entityId: string, event: string, timestamp: string): void {
    this.db
      .prepare(
        'INSERT INTO audit_log (id, entity, entity_id, event, timestamp) VALUES (?, ?, ?, ?, ?)'
      )
      .run(uuidv4(), 'accounts', entityId, event, timestamp)
  }

  private map(row: AccountRow): Account {
    const owners = this.db
      .prepare('SELECT person_id FROM account_owners WHERE account_id = ?')
      .all(row.id) as Array<{ person_id: string }>

    const beneficiaryRows = this.db
      .prepare(
        `SELECT b.*, p.full_name AS person_name
         FROM beneficiary_designations b
         LEFT JOIN people p ON p.id = b.person_id
         WHERE b.account_id = ?
         ORDER BY b.designation_type ASC, b.percentage DESC`
      )
      .all(row.id) as Array<{
      id: string
      account_id: string
      person_id: string
      person_name: string | null
      designation_type: string
      percentage: number
      per_stirpes: number
      notes: string | null
      created_at: string
      updated_at: string
    }>

    const beneficiaries: BeneficiaryDesignation[] = beneficiaryRows.map((b) => ({
      id: b.id,
      accountId: b.account_id,
      personId: b.person_id,
      personName: b.person_name ?? undefined,
      designationType: b.designation_type as BeneficiaryDesignationType,
      percentage: b.percentage,
      perStirpes: b.per_stirpes === 1,
      notes: b.notes,
      createdAt: b.created_at,
      updatedAt: b.updated_at
    }))

    return {
      id: row.id,
      institution: row.institution,
      accountName: row.account_name,
      accountType: row.account_type as AccountType,
      lastFour: row.last_four,
      fullAccountNumber: this.decryptSensitive(row.full_account_number_encrypted),
      approximateValue: row.approximate_value,
      transferOnDeath: row.transfer_on_death === 1,
      contactInfo: row.contact_info,
      website: row.website,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastReviewedAt: row.last_reviewed_at,
      archivedAt: row.archived_at,
      ownerPersonIds: owners.map((o) => o.person_id),
      beneficiaries
    }
  }
}

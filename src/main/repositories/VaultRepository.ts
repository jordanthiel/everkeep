import { v4 as uuidv4 } from 'uuid'
import type { VaultDatabase } from '../database/connection'
import type { VaultMetadata } from '../../shared/types/vault'
import { getLatestSchemaVersion } from '../database/migrations'

interface VaultMetadataRow {
  id: string
  name: string
  household_name: string | null
  owner_first_name: string | null
  owner_middle_name: string | null
  owner_last_name: string | null
  owner_preferred_name: string | null
  owner_date_of_birth: string | null
  spouse_partner_name: string | null
  schema_version: number
  is_password_protected: number
  created_at: string
  updated_at: string
}

function mapRow(row: VaultMetadataRow): VaultMetadata {
  return {
    id: row.id,
    name: row.name,
    householdName: row.household_name,
    ownerFirstName: row.owner_first_name,
    ownerMiddleName: row.owner_middle_name,
    ownerLastName: row.owner_last_name,
    ownerPreferredName: row.owner_preferred_name,
    ownerDateOfBirth: row.owner_date_of_birth,
    spousePartnerName: row.spouse_partner_name,
    schemaVersion: row.schema_version,
    isPasswordProtected: row.is_password_protected === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export interface CreateVaultMetadataInput {
  name: string
  householdName?: string
  ownerFirstName?: string
  ownerMiddleName?: string
  ownerLastName?: string
  ownerPreferredName?: string
  ownerDateOfBirth?: string
  spousePartnerName?: string
  isPasswordProtected: boolean
  passwordVerifier?: string | null
  encryptionSalt?: string | null
  encryptionParams?: string | null
}

export class VaultRepository {
  constructor(private readonly db: VaultDatabase) {}

  createMetadata(input: CreateVaultMetadataInput): VaultMetadata {
    const id = uuidv4()
    const now = new Date().toISOString()
    const schemaVersion = getLatestSchemaVersion()

    this.db
      .prepare(
        `INSERT INTO vault_metadata (
          id, name, household_name, owner_first_name, owner_middle_name, owner_last_name,
          owner_preferred_name, owner_date_of_birth, spouse_partner_name, schema_version,
          is_password_protected, password_verifier, encryption_salt, encryption_params,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.householdName ?? null,
        input.ownerFirstName ?? null,
        input.ownerMiddleName ?? null,
        input.ownerLastName ?? null,
        input.ownerPreferredName ?? null,
        input.ownerDateOfBirth ?? null,
        input.spousePartnerName ?? null,
        schemaVersion,
        input.isPasswordProtected ? 1 : 0,
        input.passwordVerifier ?? null,
        input.encryptionSalt ?? null,
        input.encryptionParams ?? null,
        now,
        now
      )

    const metadata = this.getMetadata()
    if (!metadata) {
      throw new Error('Failed to create vault metadata')
    }
    return metadata
  }

  getMetadata(): VaultMetadata | null {
    const row = this.db.prepare('SELECT * FROM vault_metadata LIMIT 1').get() as
      | VaultMetadataRow
      | undefined
    return row ? mapRow(row) : null
  }

  updateMetadata(
    patch: Partial<{
      name: string
      householdName: string | null
      ownerFirstName: string | null
      ownerMiddleName: string | null
      ownerLastName: string | null
      ownerPreferredName: string | null
      ownerDateOfBirth: string | null
      spousePartnerName: string | null
    }>
  ): VaultMetadata {
    const current = this.getMetadata()
    if (!current) {
      throw new Error('Vault metadata not found')
    }

    const now = new Date().toISOString()
    this.db
      .prepare(
        `UPDATE vault_metadata SET
          name = ?,
          household_name = ?,
          owner_first_name = ?,
          owner_middle_name = ?,
          owner_last_name = ?,
          owner_preferred_name = ?,
          owner_date_of_birth = ?,
          spouse_partner_name = ?,
          updated_at = ?
        WHERE id = ?`
      )
      .run(
        patch.name ?? current.name,
        patch.householdName !== undefined ? patch.householdName : current.householdName,
        patch.ownerFirstName !== undefined ? patch.ownerFirstName : current.ownerFirstName,
        patch.ownerMiddleName !== undefined ? patch.ownerMiddleName : current.ownerMiddleName,
        patch.ownerLastName !== undefined ? patch.ownerLastName : current.ownerLastName,
        patch.ownerPreferredName !== undefined
          ? patch.ownerPreferredName
          : current.ownerPreferredName,
        patch.ownerDateOfBirth !== undefined ? patch.ownerDateOfBirth : current.ownerDateOfBirth,
        patch.spousePartnerName !== undefined
          ? patch.spousePartnerName
          : current.spousePartnerName,
        now,
        current.id
      )

    const updated = this.getMetadata()
    if (!updated) {
      throw new Error('Failed to update vault metadata')
    }
    return updated
  }

  getPasswordVerifier(): string | null {
    const row = this.db.prepare('SELECT password_verifier FROM vault_metadata LIMIT 1').get() as
      | { password_verifier: string | null }
      | undefined
    return row?.password_verifier ?? null
  }
}

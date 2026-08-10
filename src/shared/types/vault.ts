export interface VaultMetadata {
  id: string
  name: string
  householdName: string | null
  ownerFirstName: string | null
  ownerMiddleName: string | null
  ownerLastName: string | null
  ownerPreferredName: string | null
  ownerDateOfBirth: string | null
  spousePartnerName: string | null
  schemaVersion: number
  isPasswordProtected: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateVaultInput {
  name: string
  filePath: string
  householdName?: string
  ownerFirstName?: string
  ownerMiddleName?: string
  ownerLastName?: string
  ownerPreferredName?: string
  ownerDateOfBirth?: string
  spousePartnerName?: string
  password?: string
}

export interface OpenVaultInput {
  filePath: string
  password?: string
}

export interface RecentVault {
  filePath: string
  name: string
  householdName: string | null
  lastOpenedAt: string
}

export interface VaultSession {
  filePath: string
  metadata: VaultMetadata
  isLocked: boolean
}

export interface SaveAsVaultInput {
  destinationPath: string
}

export interface BackupVaultInput {
  destinationPath: string
}

export interface VaultStatus {
  isOpen: boolean
  session: VaultSession | null
}

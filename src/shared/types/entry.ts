import type { BaseEntity } from './base'

export type VaultSectionId =
  | 'identity'
  | 'legal'
  | 'insurance'
  | 'property'
  | 'income'
  | 'taxes'
  | 'healthcare'
  | 'digital'
  | 'household'
  | 'personal-property'
  | 'final-wishes'
  | 'letters'
  | 'documents'

export interface VaultEntry extends BaseEntity {
  section: VaultSectionId
  kind: string | null
  title: string
  fields: Record<string, string>
  sensitiveFields: Record<string, string>
  locationText: string | null
}

export interface CreateVaultEntryInput {
  section: VaultSectionId
  kind?: string | null
  title: string
  fields?: Record<string, string>
  sensitiveFields?: Record<string, string>
  notes?: string | null
  locationText?: string | null
}

export interface UpdateVaultEntryInput {
  id: string
  kind?: string | null
  title?: string
  fields?: Record<string, string>
  sensitiveFields?: Record<string, string>
  notes?: string | null
  locationText?: string | null
  lastReviewedAt?: string | null
}

export interface ReviewItem {
  id: string
  entity: string
  title: string
  section: string
  path: string
  lastReviewedAt: string | null
  updatedAt: string
  staleDays: number | null
}

export interface ExportReportInput {
  destinationPath: string
  sections?: VaultSectionId[]
  includeSensitive?: boolean
}

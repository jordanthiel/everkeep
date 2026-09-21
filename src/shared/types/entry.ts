import type { PacketIntroduction } from './packet'
import type { RecordLoginInput, LinkedRecord } from './recordLogin'
import type { BaseEntity } from './base'

export type VaultSectionId =
  | 'dependents'
  | 'debts'
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
  linkedRecords?: LinkedRecord[]
  login?: RecordLoginInput | null
  section: VaultSectionId
  kind: string | null
  title: string
  fields: Record<string, string>
  sensitiveFields: Record<string, string>
  locationText: string | null
}

export interface CreateVaultEntryInput {
  login?: RecordLoginInput | null
  section: VaultSectionId
  kind?: string | null
  title: string
  fields?: Record<string, string>
  sensitiveFields?: Record<string, string>
  notes?: string | null
  locationText?: string | null
}

export interface UpdateVaultEntryInput {
  login?: RecordLoginInput | null
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

export interface ExportSelection {
  people: string[]
  accounts: string[]
  entries: string[]
}
export interface ExportCatalogItem { id: string; title: string; section: string; private: boolean }
export interface ExportCatalog { people: ExportCatalogItem[]; accounts: ExportCatalogItem[]; entries: ExportCatalogItem[] }
export interface ExportOptions {
  selection?: ExportSelection
  includePrivateLetters?: boolean
  includeStartHere?: boolean
  includeAccessPlan?: boolean
  scenario?: 'incapacity' | 'death' | 'both'
  recipientContactId?: string
  introduction?: PacketIntroduction
  recipient?: string
  sections?: VaultSectionId[]
  includeSensitive?: boolean
}

export interface ExportReportInput extends ExportOptions { destinationPath: string; previewToken?: string }

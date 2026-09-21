import { RecordLoginSchema } from './recordLogin'
import { z } from 'zod'

export const VaultSectionIdSchema = z.enum([
  'dependents',
  'debts',
  'identity',
  'legal',
  'insurance',
  'property',
  'income',
  'taxes',
  'healthcare',
  'digital',
  'household',
  'personal-property',
  'final-wishes',
  'letters',
  'documents'
])

const FieldsSchema = z.record(z.string(), z.string())

export const CreateVaultEntrySchema = z.object({
  login: RecordLoginSchema.nullable().optional(),
  section: VaultSectionIdSchema,
  kind: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(300),
  fields: FieldsSchema.optional(),
  sensitiveFields: FieldsSchema.optional(),
  notes: z.string().max(20000).nullable().optional(),
  locationText: z.string().max(1000).nullable().optional()
})

export const UpdateVaultEntrySchema = z.object({
  login: RecordLoginSchema.nullable().optional(),
  id: z.string().uuid(),
  kind: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(300).optional(),
  fields: FieldsSchema.optional(),
  sensitiveFields: FieldsSchema.optional(),
  notes: z.string().max(20000).nullable().optional(),
  locationText: z.string().max(1000).nullable().optional(),
  lastReviewedAt: z.string().nullable().optional()
})

export const VaultEntryIdSchema = z.object({
  id: z.string().uuid()
})

export const ListVaultEntriesSchema = z.object({
  section: VaultSectionIdSchema
})

export const ExportOptionsSchema = z.object({
  selection: z.object({ people: z.array(z.string().uuid()), accounts: z.array(z.string().uuid()), entries: z.array(z.string().uuid()) }).optional(),
  includePrivateLetters: z.boolean().optional(),
  includeStartHere: z.boolean().optional(),
  includeAccessPlan: z.boolean().optional(),
  scenario: z.enum(['incapacity', 'death']).optional(),
  recipient: z.string().max(200).optional(),
  sections: z.array(VaultSectionIdSchema).optional(),
  includeSensitive: z.boolean().optional()
})

export const ExportReportSchema = ExportOptionsSchema.extend({ destinationPath: z.string().min(1), previewToken: z.string().uuid().optional() })

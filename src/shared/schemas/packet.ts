import { z } from 'zod'
const text = z.string().max(20000)
export const PacketIntroductionSchema = z.object({
  careInstructions: text, incapacityInstructions: text, deathInstructions: text,
  documentsLocation: text, vaultLocation: text, backupLocation: text, passwordInstructions: text,
  helpers: z.array(z.object({ personId: z.string().uuid(), help: z.string().max(2000) })).max(100)
})
export const PacketDraftSchema = z.object({
  version: z.literal(1), step: z.number().int().min(0).max(3),
  preset: z.enum(['start', 'caregiver', 'executor', 'spouse', 'custom']),
  recipientMode: z.enum(['contact', 'named', 'general']),
  recipientContactId: z.string().uuid().or(z.literal('')), recipientName: z.string().max(200),
  scenario: z.enum(['incapacity', 'death', 'both']),
  selection: z.object({ people: z.array(z.string().uuid()), accounts: z.array(z.string().uuid()), entries: z.array(z.string().uuid()) }),
  includeStartHere: z.boolean(), includeAccessPlan: z.boolean(), includePrivateLetters: z.boolean(), includeSensitive: z.boolean(),
  introduction: PacketIntroductionSchema,
  latestExport: z.object({ path: z.string().max(4000), savedAt: z.string().datetime(), recipient: z.string().max(200), signature: z.string().max(200000), deliveredAt: z.string().datetime().or(z.literal('')) }).nullable()
})

export const SavePacketDraftSchema = z.object({ vaultId: z.string().uuid(), draft: PacketDraftSchema })

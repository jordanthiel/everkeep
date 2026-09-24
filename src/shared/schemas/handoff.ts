import { z } from 'zod'
const text = z.string().max(20000)
export const HandoffSchema = z.object({
  welcomeMessage: text.default(''), welcomeSignature: z.string().max(200).default(''),
  featuredLetterId: z.string().uuid().or(z.literal('')).default(''),
  primaryContactId: z.string().uuid().or(z.literal('')), alternateContactId: z.string().uuid().or(z.literal('')),
  careInstructions: text, incapacityInstructions: text, deathInstructions: text,
  documentsLocation: text, vaultLocation: text, backupLocation: text, passwordInstructions: text,
  sharedWith: text, handoffTestedAt: z.string().datetime().or(z.literal(''))
})
export const BackupCheckSchema = z.object({ backupPath: z.string().min(1), password: z.string().optional() })
export const RestoreBackupSchema = BackupCheckSchema.extend({ destinationPath: z.string().min(1) })

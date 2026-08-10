import { z } from 'zod'

export const CreateVaultSchema = z.object({
  name: z.string().min(1, 'Vault name is required').max(200),
  filePath: z.string().min(1, 'File path is required'),
  householdName: z.string().max(200).optional(),
  ownerFirstName: z.string().max(100).optional(),
  ownerMiddleName: z.string().max(100).optional(),
  ownerLastName: z.string().max(100).optional(),
  ownerPreferredName: z.string().max(100).optional(),
  ownerDateOfBirth: z.string().max(32).optional(),
  spousePartnerName: z.string().max(200).optional(),
  password: z.string().min(8).max(256).optional()
})

export const OpenVaultSchema = z.object({
  filePath: z.string().min(1),
  password: z.string().max(256).optional()
})

export const SaveAsVaultSchema = z.object({
  destinationPath: z.string().min(1)
})

export const BackupVaultSchema = z.object({
  destinationPath: z.string().min(1)
})

export const PickSavePathSchema = z.object({
  suggestedName: z.string().min(1).max(200)
})

export const PickBackupPathSchema = z.object({
  suggestedName: z.string().min(1).max(200)
})

export const UnlockVaultSchema = z.object({
  password: z.string().min(1).max(256)
})

export const RotatePasswordSchema = z.object({
  currentPassword: z.string().max(256).optional(),
  newPassword: z.string().min(8).max(256)
})

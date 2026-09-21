import { z } from 'zod'

export const ActivateLicenseKeySchema = z.object({
  key: z.string().min(1)
})

export const ActivateLicenseFileSchema = z.object({
  filePath: z.string().min(1)
})

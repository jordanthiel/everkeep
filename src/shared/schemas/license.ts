import { z } from 'zod'

export const ActivateLicenseSchema = z.object({
  key: z.string().min(1).max(500)
})

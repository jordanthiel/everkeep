import { z } from 'zod'

export const DigitalCategorySchema = z.enum([
  'password_manager',
  'email',
  'apple_google_microsoft',
  'social',
  'domain',
  'cloud',
  'crypto',
  'other'
])

export const CreateDigitalAccountSchema = z.object({
  category: DigitalCategorySchema,
  provider: z.string().max(200).nullable().optional(),
  accountIdentifier: z.string().max(300).nullable().optional(),
  url: z.string().max(500).nullable().optional(),
  instructions: z.string().max(10000).nullable().optional(),
  preference: z.string().max(500).nullable().optional(),
  notes: z.string().max(10000).nullable().optional()
})

export const DigitalAccountIdSchema = z.object({
  id: z.string().uuid()
})

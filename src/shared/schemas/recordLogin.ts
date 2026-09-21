import { z } from 'zod'
export const RecordLoginSchema = z.object({
  id: z.string().uuid().optional(),
  provider: z.string().trim().min(1).max(200),
  username: z.string().max(500),
  website: z.string().max(2000),
  password: z.string().max(10000),
  instructions: z.string().max(10000)
})

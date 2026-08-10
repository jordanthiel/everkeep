import { z } from 'zod'

export const AttachFileSchema = z.object({
  entryId: z.string().uuid(),
  sourcePath: z.string().min(1)
})

export const AttachmentIdSchema = z.object({
  id: z.string().uuid()
})

export const EntryIdForAttachmentsSchema = z.object({
  entryId: z.string().uuid()
})

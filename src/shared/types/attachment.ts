export interface Attachment {
  id: string
  entryId: string | null
  filename: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
  updatedAt: string
}

export interface AttachFileInput {
  entryId: string
  sourcePath: string
}

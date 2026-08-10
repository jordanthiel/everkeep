export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
  lastReviewedAt?: string | null
  notes?: string | null
  archivedAt?: string | null
}

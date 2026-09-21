import type { VaultDatabase } from '../database/connection'
import type { ReviewItem } from '../../shared/types/entry'
import { getSectionDefinition } from '../../shared/sections/definitions'
import type { VaultSectionId } from '../../shared/types/entry'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

function staleDays(lastReviewedAt: string | null): number | null {
  if (!lastReviewedAt) return null
  const age = Date.now() - new Date(lastReviewedAt).getTime()
  return Math.floor(age / (24 * 60 * 60 * 1000))
}

function isStale(lastReviewedAt: string | null): boolean {
  if (!lastReviewedAt) return true
  return Date.now() - new Date(lastReviewedAt).getTime() > ONE_YEAR_MS
}

export class ReviewService {
  constructor(private readonly db: VaultDatabase) {}

  listStaleItems(): ReviewItem[] {
    const items: ReviewItem[] = []

    const people = this.db
      .prepare(
        `SELECT id, full_name AS title, last_reviewed_at, updated_at
         FROM people WHERE archived_at IS NULL`
      )
      .all() as Array<{
      id: string
      title: string
      last_reviewed_at: string | null
      updated_at: string
    }>
    for (const row of people) {
      if (!isStale(row.last_reviewed_at)) continue
      items.push({
        id: row.id,
        entity: 'people',
        title: row.title,
        section: 'Contacts',
        path: '/people',
        lastReviewedAt: row.last_reviewed_at,
        updatedAt: row.updated_at,
        staleDays: staleDays(row.last_reviewed_at)
      })
    }

    const accounts = this.db
      .prepare(
        `SELECT id, COALESCE(account_name, institution) AS title, last_reviewed_at, updated_at
         FROM accounts WHERE archived_at IS NULL`
      )
      .all() as Array<{
      id: string
      title: string
      last_reviewed_at: string | null
      updated_at: string
    }>
    for (const row of accounts) {
      if (!isStale(row.last_reviewed_at)) continue
      items.push({
        id: row.id,
        entity: 'accounts',
        title: row.title,
        section: 'Financial',
        path: '/financial',
        lastReviewedAt: row.last_reviewed_at,
        updatedAt: row.updated_at,
        staleDays: staleDays(row.last_reviewed_at)
      })
    }

    try {
      const entries = this.db
        .prepare(
          `SELECT id, section, title, last_reviewed_at, updated_at
           FROM vault_entries WHERE archived_at IS NULL`
        )
        .all() as Array<{
        id: string
        section: string
        title: string
        last_reviewed_at: string | null
        updated_at: string
      }>
      for (const row of entries) {
        if (!isStale(row.last_reviewed_at)) continue
        let sectionTitle = row.section
        let path = `/${row.section}`
        try {
          const def = getSectionDefinition(row.section as VaultSectionId)
          sectionTitle = def.title
          path = def.path
        } catch {
          // keep defaults
        }
        items.push({
          id: row.id,
          entity: 'vault_entries',
          title: row.title,
          section: sectionTitle,
          path,
          lastReviewedAt: row.last_reviewed_at,
          updatedAt: row.updated_at,
          staleDays: staleDays(row.last_reviewed_at)
        })
      }
    } catch {
      // vault_entries may not exist on very old dbs mid-migration
    }

    return items.sort((a, b) => {
      const aTime = a.lastReviewedAt ?? ''
      const bTime = b.lastReviewedAt ?? ''
      return aTime.localeCompare(bTime)
    })
  }
}

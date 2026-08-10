import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { mkdirSync } from 'fs'
import type { RecentVault } from '../../shared/types/vault'

const MAX_RECENT = 10

export class RecentVaultsStore {
  constructor(private readonly storePath: string) {}

  list(): RecentVault[] {
    if (!existsSync(this.storePath)) {
      return []
    }

    try {
      const raw = readFileSync(this.storePath, 'utf8')
      const parsed = JSON.parse(raw) as RecentVault[]
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter(
        (item) => typeof item.filePath === 'string' && typeof item.name === 'string'
      )
    } catch {
      return []
    }
  }

  touch(entry: Omit<RecentVault, 'lastOpenedAt'>): RecentVault[] {
    const now = new Date().toISOString()
    const existing = this.list().filter((item) => item.filePath !== entry.filePath)
    const next: RecentVault[] = [
      {
        ...entry,
        lastOpenedAt: now
      },
      ...existing
    ].slice(0, MAX_RECENT)

    this.write(next)
    return next
  }

  remove(filePath: string): RecentVault[] {
    const next = this.list().filter((item) => item.filePath !== filePath)
    this.write(next)
    return next
  }

  private write(entries: RecentVault[]): void {
    mkdirSync(dirname(this.storePath), { recursive: true })
    writeFileSync(this.storePath, JSON.stringify(entries, null, 2), 'utf8')
  }
}

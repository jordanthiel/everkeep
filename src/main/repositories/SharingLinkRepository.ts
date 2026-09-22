import { withTransaction, type VaultDatabase } from '../database/connection'
import type { SharedSnapshot } from '../../shared/sharing'
export interface SharingLink { storage?: 'file' | 'hosted'; ownerEmail?: string; serviceUrl: string; remoteId: string; ownerId: string; revision: number; base: SharedSnapshot; lastSyncedAt: string; uploaded?: string[] }
export class SharingLinkRepository {
  constructor(private readonly db: VaultDatabase) {}
  get(): SharingLink | null { const row = this.db.prepare('SELECT data_json FROM sharing_link WHERE id=1').get() as { data_json: string } | undefined; return row ? JSON.parse(row.data_json) : null }
  save(link: SharingLink) { withTransaction(this.db, () => this.db.prepare('INSERT INTO sharing_link VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json').run(JSON.stringify(link))) }
}

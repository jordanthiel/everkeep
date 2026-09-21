import { withTransaction, type VaultDatabase } from '../database/connection'
import { PacketDraftSchema } from '../../shared/schemas/packet'
import type { PacketDraft } from '../../shared/types/packet'
export class PacketDraftRepository {
  constructor(private readonly db: VaultDatabase) {}
  get(): PacketDraft | null {
    const row = this.db.prepare('SELECT data_json FROM packet_draft WHERE id = 1').get() as { data_json: string } | undefined
    return row ? PacketDraftSchema.parse(JSON.parse(row.data_json)) : null
  }
  save(input: PacketDraft): PacketDraft {
    const draft = PacketDraftSchema.parse(input)
    withTransaction(this.db, () => this.db.prepare('INSERT INTO packet_draft (id, data_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json').run(JSON.stringify(draft)))
    return draft
  }
  clear(): { cleared: boolean } {
    withTransaction(this.db, () => this.db.prepare('DELETE FROM packet_draft').run())
    return { cleared: true }
  }
}

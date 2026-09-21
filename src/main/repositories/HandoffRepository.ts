import type { VaultDatabase } from '../database/connection'
import { withTransaction } from '../database/connection'
import { EMPTY_HANDOFF, type FamilyHandoff } from '../../shared/types/handoff'
export class HandoffRepository {
  constructor(private readonly db: VaultDatabase) {}
  get(): FamilyHandoff {
    const row = this.db.prepare('SELECT data_json FROM family_handoff WHERE id = 1').get() as { data_json: string } | undefined
    return { ...EMPTY_HANDOFF, ...(row ? JSON.parse(row.data_json) : {}) }
  }
  update(patch: Partial<FamilyHandoff>): FamilyHandoff {
    const next = { ...this.get(), ...patch }
    withTransaction(this.db, () => this.db.prepare('INSERT INTO family_handoff (id, data_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json').run(JSON.stringify(next)))
    return next
  }
}

import type { VaultDatabase } from '../database/connection'
import { EntryRepository } from './EntryRepository'
import type { RecordLoginInput, LinkedRecord } from '../../shared/types/recordLogin'
import type { VaultEntry } from '../../shared/types/entry'

export class RecordLoginRepository {
  constructor(private db: VaultDatabase, private entries: EntryRepository) {}
  get(type: 'entry' | 'account', id: string): RecordLoginInput | null {
    const row = this.db.prepare('SELECT login_entry_id FROM record_logins WHERE parent_type = ? AND parent_id = ?').get(type,id) as {login_entry_id:string} | undefined
    const entry = row && this.entries.getById(row.login_entry_id)
    return entry && !entry.archivedAt ? this.toInput(entry) : null
  }
  toInput(entry: VaultEntry): RecordLoginInput {
    return {id:entry.id,provider:entry.fields.provider || entry.title,username:entry.fields.accountIdentifier || '',website:entry.fields.url || '',password:entry.sensitiveFields.password || '',instructions:entry.fields.instructions || ''}
  }
  save(type: 'entry' | 'account', id: string, input: RecordLoginInput | null | undefined, beforeCreate: () => void) {
    if (input === undefined) return
    if (input === null) { this.db.prepare('DELETE FROM record_logins WHERE parent_type = ? AND parent_id = ?').run(type,id); return }
    const loginId = input.id
    const existing = loginId ? this.entries.getById(loginId) : null
    if (loginId && (!existing || existing.archivedAt || existing.section !== 'digital')) throw new Error('This digital login is no longer available. Choose another login or create a new one.')
    const fields = {...existing?.fields, provider:input.provider, accountIdentifier:input.username, url:input.website, instructions:input.instructions}
    const sensitiveFields = {...existing?.sensitiveFields, password:input.password}
    let entry: VaultEntry
    if (existing) entry = this.entries.update({id:existing.id,fields,sensitiveFields})
    else {
      beforeCreate()
      entry = this.entries.create({section:'digital',kind:'login',title:`${input.provider} login`,fields,sensitiveFields})
    }
    this.db.prepare('INSERT INTO record_logins (parent_type,parent_id,login_entry_id) VALUES (?,?,?) ON CONFLICT(parent_type,parent_id) DO UPDATE SET login_entry_id=excluded.login_entry_id').run(type,id,entry.id)
  }
  references(loginId: string): LinkedRecord[] {
    const rows = this.db.prepare(`SELECT parent_id AS id, 'entry' AS type, e.title, e.section, e.archived_at FROM record_logins r JOIN vault_entries e ON r.parent_id=e.id WHERE r.parent_type='entry' AND r.login_entry_id=?
      UNION ALL SELECT parent_id AS id, 'account' AS type, a.institution || CASE WHEN a.account_name IS NOT NULL THEN ' — ' || a.account_name ELSE '' END AS title, 'financial' AS section, a.archived_at FROM record_logins r JOIN accounts a ON r.parent_id=a.id WHERE r.parent_type='account' AND r.login_entry_id=?`).all(loginId,loginId) as Array<{id:string;type:string;title:string;section:string;archived_at:string|null}>
    return rows.map(row => ({id:row.id,title:row.title,section:row.section,path:`/${row.section}?edit=${row.id}`,archived:Boolean(row.archived_at)}))
  }
}

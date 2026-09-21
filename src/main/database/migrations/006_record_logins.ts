import type { Migration } from './types'
export const migration006: Migration = {
  id: '006_record_logins', version: 6,
  up(db) {
    db.exec(`CREATE TABLE record_logins (
      parent_type TEXT NOT NULL CHECK(parent_type IN ('entry', 'account')),
      parent_id TEXT NOT NULL,
      login_entry_id TEXT NOT NULL REFERENCES vault_entries(id),
      PRIMARY KEY(parent_type, parent_id)
    ); CREATE INDEX record_logins_login ON record_logins(login_entry_id);`)
  }
}

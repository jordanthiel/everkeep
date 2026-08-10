import type { Migration } from './types'

export const migration003: Migration = {
  id: '003_attachments_entry_link',
  version: 3,
  up(db) {
    db.exec(`
      ALTER TABLE attachments ADD COLUMN entry_id TEXT REFERENCES vault_entries(id);
      ALTER TABLE attachments ADD COLUMN archived_at TEXT;

      CREATE INDEX IF NOT EXISTS idx_attachments_entry
        ON attachments(entry_id, archived_at);
    `)
  }
}

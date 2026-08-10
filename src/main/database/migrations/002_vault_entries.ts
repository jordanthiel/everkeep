import type { Migration } from './types'

export const migration002: Migration = {
  id: '002_vault_entries',
  version: 2,
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS vault_entries (
        id TEXT PRIMARY KEY NOT NULL,
        section TEXT NOT NULL,
        kind TEXT,
        title TEXT NOT NULL,
        fields_json TEXT NOT NULL DEFAULT '{}',
        sensitive_json_encrypted TEXT,
        notes TEXT,
        location_text TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        archived_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_vault_entries_section
        ON vault_entries(section, archived_at);

      CREATE INDEX IF NOT EXISTS idx_vault_entries_reviewed
        ON vault_entries(last_reviewed_at);
    `)
  }
}

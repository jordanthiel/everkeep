import type { Migration } from './types'
export const migration005: Migration = {
  id: '005_family_handoff', version: 5,
  up(db) {
    db.exec(`CREATE TABLE family_handoff (id INTEGER PRIMARY KEY CHECK(id = 1), data_json TEXT NOT NULL);
      CREATE TABLE attachment_contents (attachment_id TEXT PRIMARY KEY REFERENCES attachments(id), content BLOB NOT NULL);`)
  }
}

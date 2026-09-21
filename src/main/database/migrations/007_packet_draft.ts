import type { Migration } from './types'
export const migration007: Migration = {
  id: '007_packet_draft', version: 7,
  up(db) { db.exec('CREATE TABLE packet_draft (id INTEGER PRIMARY KEY CHECK(id = 1), data_json TEXT NOT NULL)') }
}

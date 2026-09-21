import type { Migration } from './types'
export const migration008: Migration = { id: '008_sharing_link', version: 8, up(db) { db.exec('CREATE TABLE sharing_link (id INTEGER PRIMARY KEY CHECK(id=1), data_json TEXT NOT NULL)') } }

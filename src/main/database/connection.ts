import Database from 'better-sqlite3'
import { existsSync } from 'fs'

const persistence = new WeakMap<Database.Database, () => void>()
export function setDatabasePersistence(db: Database.Database, save?: () => void): void {
  if (save) persistence.set(db, save)
  else persistence.delete(db)
}
export function openMemoryDatabase(bytes?: Buffer): Database.Database {
  if (bytes) { bytes = Buffer.from(bytes); bytes[18] = 1; bytes[19] = 1 }
  const db = new Database(bytes ?? ':memory:')
  db.pragma('foreign_keys = ON')
  return db
}

export type VaultDatabase = Database.Database

export function openDatabase(filePath: string, options?: { readonly?: boolean }): VaultDatabase {
  const db = new Database(filePath, {
    readonly: options?.readonly ?? false,
    fileMustExist: options?.readonly === true
  })

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')

  return db
}

export function createDatabase(filePath: string): VaultDatabase {
  if (existsSync(filePath)) {
    throw new Error(`Vault already exists at ${filePath}`)
  }
  return openDatabase(filePath)
}

export function closeDatabase(db: VaultDatabase): void {
  if (db.open) {
    // Checkpoint WAL before close for durability
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      // Ignore checkpoint errors during close
    }
    db.close()
  }
}

export function verifyIntegrity(db: VaultDatabase): { ok: boolean; result: string } {
  const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
  const result = row.integrity_check
  return { ok: result === 'ok', result }
}

export function withTransaction<T>(db: VaultDatabase, fn: () => T): T {
  const nested = db.inTransaction
  const run = db.transaction(() => {
    const result = fn()
    // Memory-backed vaults have no disk COMMIT. Serialize only after every
    // statement succeeds, but before committing, so an I/O failure rolls back.
    if (!nested) persistence.get(db)?.()
    return result
  })
  return run()
}

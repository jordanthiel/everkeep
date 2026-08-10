import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import type { VaultDatabase } from './connection'
import { withTransaction } from './connection'
import { getLatestSchemaVersion, migrations } from './migrations'

function ensureMigrationsTable(db: VaultDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      version INTEGER NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `)
}

function getAppliedMigrationIds(db: VaultDatabase): Set<string> {
  ensureMigrationsTable(db)
  const rows = db.prepare('SELECT id FROM schema_migrations ORDER BY version ASC').all() as Array<{
    id: string
  }>
  return new Set(rows.map((r) => r.id))
}

function getCurrentSchemaVersion(db: VaultDatabase): number {
  ensureMigrationsTable(db)
  const row = db
    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
    .get() as { version: number }
  return row.version
}

export function createPreMigrationBackup(vaultPath: string): string | null {
  if (!existsSync(vaultPath)) {
    return null
  }

  const backupDir = join(dirname(vaultPath), 'Everkeep Migration Backups')
  mkdirSync(backupDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(backupDir, `pre-migration-${stamp}.everkeep`)
  copyFileSync(vaultPath, backupPath)
  return backupPath
}

export function runMigrations(db: VaultDatabase, vaultPath?: string): {
  fromVersion: number
  toVersion: number
  applied: string[]
  backupPath: string | null
} {
  const fromVersion = getCurrentSchemaVersion(db)
  const appliedIds = getAppliedMigrationIds(db)
  const pending = migrations.filter((m) => !appliedIds.has(m.id)).sort((a, b) => a.version - b.version)

  if (pending.length === 0) {
    return {
      fromVersion,
      toVersion: fromVersion,
      applied: [],
      backupPath: null
    }
  }

  let backupPath: string | null = null
  if (vaultPath && fromVersion > 0) {
    backupPath = createPreMigrationBackup(vaultPath)
  }

  const applied: string[] = []

  withTransaction(db, () => {
    for (const migration of pending) {
      migration.up(db)
      db.prepare(
        'INSERT INTO schema_migrations (id, version, applied_at) VALUES (?, ?, ?)'
      ).run(migration.id, migration.version, new Date().toISOString())
      applied.push(migration.id)
    }

    const meta = db.prepare('SELECT id FROM vault_metadata LIMIT 1').get() as { id: string } | undefined
    if (meta) {
      db.prepare('UPDATE vault_metadata SET schema_version = ?, updated_at = ? WHERE id = ?').run(
        getLatestSchemaVersion(),
        new Date().toISOString(),
        meta.id
      )
    }
  })

  return {
    fromVersion,
    toVersion: getLatestSchemaVersion(),
    applied,
    backupPath
  }
}

export function getSchemaVersion(db: VaultDatabase): number {
  return getCurrentSchemaVersion(db)
}

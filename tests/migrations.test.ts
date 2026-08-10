import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDatabase, createDatabase, openDatabase } from '../src/main/database/connection'
import { getLatestSchemaVersion } from '../src/main/database/migrations'
import { getSchemaVersion, runMigrations } from '../src/main/database/migrator'
import { VaultRepository } from '../src/main/repositories/VaultRepository'

describe('schema migrations', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('applies initial schema and records schema version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'everkeep-migrate-'))
    dirs.push(dir)
    const path = join(dir, 'test.everkeep')

    const db = createDatabase(path)
    const result = runMigrations(db, path)
    expect(result.applied).toContain('001_initial_schema')
    expect(getSchemaVersion(db)).toBe(getLatestSchemaVersion())

    const repo = new VaultRepository(db)
    const meta = repo.createMetadata({
      name: 'Migration Test',
      isPasswordProtected: false
    })
    expect(meta.schemaVersion).toBe(getLatestSchemaVersion())

    closeDatabase(db)

    const reopened = openDatabase(path)
    const second = runMigrations(reopened, path)
    expect(second.applied).toEqual([])
    expect(getSchemaVersion(reopened)).toBe(getLatestSchemaVersion())
    closeDatabase(reopened)
  })
})

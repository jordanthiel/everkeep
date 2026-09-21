import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDatabase, createDatabase, openDatabase } from '../src/main/database/connection'
import { getLatestSchemaVersion, migrations } from '../src/main/database/migrations'
import { getSchemaVersion, runMigrations } from '../src/main/database/migrator'
import { VaultRepository } from '../src/main/repositories/VaultRepository'

function applyMigrationsThrough(db: ReturnType<typeof createDatabase>, version: number): void {
  const now = new Date().toISOString()
  for (const migration of migrations.filter((item) => item.version <= version)) {
    migration.up(db)
    db.prepare('INSERT INTO schema_migrations (id, version, applied_at) VALUES (?, ?, ?)').run(
      migration.id,
      migration.version,
      now
    )
  }
}

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

  it('copies contacts into people, maps roles, and archives the source rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'everkeep-unify-'))
    dirs.push(dir)
    const path = join(dir, 'legacy.everkeep')
    const db = createDatabase(path)
    applyMigrationsThrough(db, 3)

    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO people (
        id, full_name, relationship, date_of_birth, phone, email, address, notes,
        created_at, updated_at, last_reviewed_at, archived_at
      ) VALUES (?, ?, 'self', NULL, NULL, NULL, NULL, NULL, ?, ?, ?, NULL)`
    ).run('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alex Morgan', now, now, now)

    db.prepare(
      `INSERT INTO contacts (
        id, name, company, role, phone, email, address, website, notes,
        created_at, updated_at, last_reviewed_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL)`
    ).run(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'Alex Morgan',
      'Smith Law',
      'estate_attorney',
      '555-0100',
      'alex@law.test',
      'Estate notes',
      now,
      now,
      now
    )
    db.prepare(
      `INSERT INTO contacts (
        id, name, company, role, phone, email, address, website, notes,
        created_at, updated_at, last_reviewed_at, archived_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, NULL)`
    ).run(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'Jordan CPA',
      'Numbers LLC',
      'cpa',
      now,
      now,
      now
    )

    const result = runMigrations(db, path)
    expect(result.applied).toContain('004_unify_contacts_into_people')
    expect(getSchemaVersion(db)).toBe(8)

    const people = db
      .prepare(
        `SELECT id, full_name, company, phone, email FROM people WHERE archived_at IS NULL ORDER BY full_name`
      )
      .all() as Array<{
      id: string
      full_name: string
      company: string | null
      phone: string | null
      email: string | null
    }>
    expect(people).toHaveLength(2)

    const alex = people.find((person) => person.full_name === 'Alex Morgan')
    expect(alex?.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(alex?.company).toBe('Smith Law')
    expect(alex?.phone).toBe('555-0100')
    expect(alex?.email).toBe('alex@law.test')

    const jordan = people.find((person) => person.full_name === 'Jordan CPA')
    expect(jordan?.company).toBe('Numbers LLC')

    const roles = db
      .prepare('SELECT person_id, role FROM person_roles ORDER BY role')
      .all() as Array<{ person_id: string; role: string }>
    expect(roles).toEqual(
      expect.arrayContaining([
        { person_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'attorney' },
        { person_id: jordan?.id, role: 'cpa' }
      ])
    )

    const leftover = db
      .prepare('SELECT archived_at FROM contacts WHERE archived_at IS NULL')
      .all()
    expect(leftover).toHaveLength(0)

    closeDatabase(db)
  })
})

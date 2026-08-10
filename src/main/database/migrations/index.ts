import { migration001 } from './001_initial_schema'
import { migration002 } from './002_vault_entries'
import type { Migration } from './types'

export const migrations: Migration[] = [migration001, migration002]

export function getLatestSchemaVersion(): number {
  return migrations.reduce((max, m) => Math.max(max, m.version), 0)
}

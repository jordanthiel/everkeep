import { migration001 } from './001_initial_schema'
import { migration002 } from './002_vault_entries'
import { migration003 } from './003_attachments_entry_link'
import type { Migration } from './types'

export const migrations: Migration[] = [migration001, migration002, migration003]

export function getLatestSchemaVersion(): number {
  return migrations.reduce((max, m) => Math.max(max, m.version), 0)
}

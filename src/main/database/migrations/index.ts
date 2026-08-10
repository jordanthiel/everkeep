import { migration001 } from './001_initial_schema'
import type { Migration } from './types'

export const migrations: Migration[] = [migration001]

export function getLatestSchemaVersion(): number {
  return migrations.reduce((max, m) => Math.max(max, m.version), 0)
}

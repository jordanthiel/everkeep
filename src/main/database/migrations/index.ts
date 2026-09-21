import { migration006 } from './006_record_logins'
import { migration001 } from './001_initial_schema'
import { migration002 } from './002_vault_entries'
import { migration003 } from './003_attachments_entry_link'
import { migration004 } from './004_unify_contacts_into_people'
import { migration005 } from './005_family_handoff'
import type { Migration } from './types'

export const migrations: Migration[] = [migration001, migration002, migration003, migration004, migration005, migration006]

export function getLatestSchemaVersion(): number {
  return migrations.reduce((max, m) => Math.max(max, m.version), 0)
}

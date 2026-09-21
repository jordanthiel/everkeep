import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import type { Person, PersonRole } from '@shared/types/person'

export async function ensurePersonRoles(
  personId: string,
  roles: PersonRole[],
  people: Person[]
): Promise<void> {
  if (roles.length === 0) return
  const person = people.find((item) => item.id === personId)
  if (!person) return
  const next = Array.from(new Set([...person.roles, ...roles]))
  if (next.length === person.roles.length && next.every((role) => person.roles.includes(role))) {
    return
  }
  await unwrap(getEverkeepApi().people.update({ id: personId, roles: next }))
}

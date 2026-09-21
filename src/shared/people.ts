import type { Person } from './types/person'
import type { VaultEntry } from './types/entry'

export function parsePersonIds(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function formatPersonIds(ids: string[]): string {
  return Array.from(new Set(ids.filter(Boolean))).join(',')
}

export function resolvePersonNames(
  value: string | null | undefined,
  people: Array<Pick<Person, 'id' | 'fullName'>>
): string | null {
  const ids = parsePersonIds(value)
  if (ids.length === 0) return null
  return ids
    .map((id) => people.find((person) => person.id === id)?.fullName ?? 'Unknown person')
    .join(', ')
}

export interface PersonEntryGroup<T extends Pick<VaultEntry, 'fields'>> {
  personId: string | null
  personName: string
  entries: T[]
}

export function groupEntriesByPerson<T extends Pick<VaultEntry, 'fields'>>(
  entries: T[],
  people: Array<Pick<Person, 'id' | 'fullName'> & { relationship?: Person['relationship'] }>
): PersonEntryGroup<T>[] {
  const groups = new Map<string, T[]>()
  for (const entry of entries) {
    const personId = parsePersonIds(entry.fields.personId)[0] ?? ''
    const current = groups.get(personId) ?? []
    current.push(entry)
    groups.set(personId, current)
  }

  const result: PersonEntryGroup<T>[] = []
  for (const person of people) {
    const personEntries = groups.get(person.id)
    if (!personEntries?.length) continue
    result.push({
      personId: person.id,
      personName: person.relationship === 'self' ? 'You' : person.fullName,
      entries: personEntries
    })
    groups.delete(person.id)
  }

  const unassigned = groups.get('') ?? []
  const leftovers = Array.from(groups.entries()).flatMap(([id, items]) =>
    id ? items : []
  )
  const orphaned = [...unassigned, ...leftovers]
  if (orphaned.length > 0) {
    result.push({
      personId: null,
      personName: 'Not linked to a contact',
      entries: orphaned
    })
  }
  return result
}

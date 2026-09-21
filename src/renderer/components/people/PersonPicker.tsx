import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { ensurePersonRoles } from '@renderer/lib/people'
import { useVaultStore } from '@renderer/state/vaultStore'
import { formatPersonIds, parsePersonIds } from '@shared/people'
import {
  PERSON_RELATIONSHIP_OPTIONS,
  PERSON_ROLE_OPTIONS,
  type Person,
  type PersonRelationship,
  type PersonRole
} from '@shared/types/person'

export function PersonPicker({
  id,
  people,
  value,
  onChange,
  assignRole,
  multi = false,
  placeholder = 'Type a name…'
}: {
  id?: string
  people: Person[]
  value: string
  onChange: (next: string) => void
  assignRole?: PersonRole
  multi?: boolean
  placeholder?: string
}) {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftRelationship, setDraftRelationship] = useState<PersonRelationship>('other')
  const [draftPhone, setDraftPhone] = useState('')
  const [draftRoles, setDraftRoles] = useState<PersonRole[]>(assignRole ? [assignRole] : [])
  const [error, setError] = useState<string | null>(null)

  const selectedIds = parsePersonIds(value)
  const selectedPeople = selectedIds
    .map((personId) => people.find((person) => person.id === personId))
    .filter((person): person is Person => Boolean(person))

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return people
      .filter((person) => !selectedIds.includes(person.id))
      .filter((person) => !needle || person.fullName.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [people, query, selectedIds])

  const canAdd =
    query.trim().length > 0 &&
    !people.some((person) => person.fullName.toLowerCase() === query.trim().toLowerCase())

  async function selectPerson(person: Person) {
    const nextIds = multi ? [...selectedIds, person.id] : [person.id]
    onChange(formatPersonIds(nextIds))
    setQuery('')
    setOpen(false)
    if (assignRole) {
      try {
        await ensurePersonRoles(person.id, [assignRole], people)
        await queryClient.invalidateQueries({ queryKey: ['people'] })
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      } catch {
        // Selection still works even if the role update fails.
      }
    }
  }

  function removePerson(personId: string) {
    onChange(formatPersonIds(selectedIds.filter((id) => id !== personId)))
  }

  function startCreate(name: string) {
    setDraftName(name.trim())
    setDraftRelationship('other')
    setDraftPhone('')
    setDraftRoles(assignRole ? [assignRole] : [])
    setError(null)
    setCreating(true)
    setOpen(false)
  }

  async function saveNewPerson() {
    if (!draftName.trim()) {
      setError('A name is required.')
      return
    }
    setSaveStatus('saving')
    try {
      const created = await unwrap(
        getEverkeepApi().people.create({
          fullName: draftName.trim(),
          relationship: draftRelationship,
          phone: draftPhone.trim() || null,
          roles: draftRoles
        })
      )
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const nextIds = multi ? [...selectedIds, created.id] : [created.id]
      onChange(formatPersonIds(nextIds))
      setCreating(false)
      setQuery('')
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (err) {
      setSaveStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to save this contact.')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {selectedPeople.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedPeople.map((person) => (
            <span
              key={person.id}
              className="inline-flex items-center gap-1 rounded-md bg-forest-700/10 px-2 py-1 text-xs font-medium text-forest-700"
            >
              {person.fullName}
              <button
                type="button"
                className="text-forest-700/70 hover:text-forest-700"
                onClick={() => removePerson(person.id)}
                aria-label={`Remove ${person.fullName}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={query}
        placeholder={selectedPeople.length && !multi ? selectedPeople[0].fullName : placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150)
        }}
        autoComplete="off"
      />
      {open && (matches.length > 0 || canAdd) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-warm-200 bg-ivory-50 shadow-soft">
          {matches.map((person) => (
            <button
              key={person.id}
              type="button"
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-warm-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void selectPerson(person)}
            >
              <span className="text-charcoal-900">{person.fullName}</span>
              {person.roles.length > 0 && (
                <span className="text-xs text-warm-400">
                  {person.roles
                    .slice(0, 3)
                    .map(
                      (role) => PERSON_ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role
                    )
                    .join(' · ')}
                </span>
              )}
            </button>
          ))}
          {canAdd && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-warm-200 px-3 py-2 text-left text-sm text-forest-700 hover:bg-forest-700/5"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => startCreate(query)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add “{query.trim()}” as a contact
            </button>
          )}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-charcoal-900/30 px-4">
          <div className="w-full max-w-md rounded-xl border border-warm-200 bg-ivory-50 p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-charcoal-900">New contact</p>
                <p className="mt-1 text-xs text-warm-400">
                  Save them once. Other sections can pick this name later.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-warm-400 hover:bg-warm-100"
                onClick={() => setCreating(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <div>
                <Label htmlFor={`${id ?? 'person'}-new-name`}>Name</Label>
                <Input
                  id={`${id ?? 'person'}-new-name`}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`${id ?? 'person'}-new-relationship`}>Relationship</Label>
                <select
                  id={`${id ?? 'person'}-new-relationship`}
                  value={draftRelationship}
                  onChange={(e) =>
                    setDraftRelationship(e.target.value as PersonRelationship)
                  }
                  className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
                >
                  {PERSON_RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`${id ?? 'person'}-new-phone`}>Phone (optional)</Label>
                <Input
                  id={`${id ?? 'person'}-new-phone`}
                  value={draftPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                />
              </div>
              <div>
                <Label>Assignments</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PERSON_ROLE_OPTIONS.map((role) => {
                    const selected = draftRoles.includes(role.value)
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() =>
                          setDraftRoles((current) =>
                            current.includes(role.value)
                              ? current.filter((item) => item !== role.value)
                              : [...current, role.value]
                          )
                        }
                        className={
                          selected
                            ? 'rounded-md bg-forest-700 px-2.5 py-1 text-xs text-ivory-50'
                            : 'rounded-md border border-warm-300 bg-white px-2.5 py-1 text-xs text-charcoal-800'
                        }
                      >
                        {role.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {error && <p className="text-sm text-red-800">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void saveNewPerson()}>
                  Save contact
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

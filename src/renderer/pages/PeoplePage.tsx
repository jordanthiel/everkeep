import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import type { PersonRole } from '@shared/types/person'

const ROLE_OPTIONS: Array<{ value: PersonRole; label: string }> = [
  { value: 'executor', label: 'Executor' },
  { value: 'trustee', label: 'Trustee' },
  { value: 'beneficiary', label: 'Beneficiary' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'healthcare_proxy', label: 'Healthcare proxy' },
  { value: 'power_of_attorney', label: 'Power of attorney' },
  { value: 'emergency_contact', label: 'Emergency contact' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' }
]

export function PeoplePage() {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const [fullName, setFullName] = useState('')
  const [relationship, setRelationship] = useState('spouse')
  const [roles, setRoles] = useState<PersonRole[]>([])

  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => unwrap(getEverkeepApi().people.list())
  })

  const createMutation = useMutation({
    mutationFn: () =>
      unwrap(
        getEverkeepApi().people.create({
          fullName: fullName.trim(),
          relationship: relationship as
            | 'spouse'
            | 'partner'
            | 'child'
            | 'parent'
            | 'sibling'
            | 'friend'
            | 'other',
          roles
        })
      ),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: async () => {
      setFullName('')
      setRoles([])
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: () => setSaveStatus('error')
  })

  const reviewMutation = useMutation({
    mutationFn: (id: string) => unwrap(getEverkeepApi().people.markReviewed(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['people'] })
    }
  })

  function toggleRole(role: PersonRole) {
    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    )
  }

  async function setPersonRole(personId: string, role: PersonRole, enabled: boolean) {
    const person = peopleQuery.data?.find((p) => p.id === personId)
    if (!person) return
    const nextRoles = enabled
      ? Array.from(new Set([...person.roles, role]))
      : person.roles.filter((r) => r !== role)
    setSaveStatus('saving')
    try {
      await unwrap(getEverkeepApi().people.update({ id: personId, roles: nextRoles }))
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
    }
  }

  return (
    <SectionPage
      title="People"
      description="Reusable records for family members, executors, trustees, and other trusted people. One person can have many roles."
      badge="Foundation"
    >
      <div className="mb-6 grid gap-4 rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="personName">Full name</Label>
            <Input
              id="personName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <Label htmlFor="relationship">Relationship</Label>
            <select
              id="relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
            >
              <option value="spouse">Spouse</option>
              <option value="partner">Partner</option>
              <option value="child">Child</option>
              <option value="parent">Parent</option>
              <option value="sibling">Sibling</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Roles</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => {
              const active = roles.includes(role.value)
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={
                    active
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
        <div>
          <Button
            disabled={!fullName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Plus className="h-4 w-4" />
            Add person
          </Button>
        </div>
      </div>

      {peopleQuery.isLoading && <p className="text-sm text-warm-500">Loading people…</p>}
      {peopleQuery.isError && (
        <p className="text-sm text-red-800">Unable to load people. Is a vault open?</p>
      )}

      <div className="space-y-3">
        {(peopleQuery.data ?? []).map((person) => (
          <article
            key={person.id}
            className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-charcoal-900">{person.fullName}</h3>
                <p className="mt-1 text-sm capitalize text-warm-500">
                  {person.relationship ?? 'No relationship set'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ROLE_OPTIONS.slice(0, 6).map((role) => {
                    const active = person.roles.includes(role.value)
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => void setPersonRole(person.id, role.value, !active)}
                        className={
                          active
                            ? 'rounded-md bg-forest-700/10 px-2 py-1 text-xs font-medium text-forest-700'
                            : 'rounded-md border border-dashed border-warm-300 px-2 py-1 text-xs text-warm-400'
                        }
                      >
                        {role.label}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs text-warm-400">
                  Last reviewed{' '}
                  {person.lastReviewedAt
                    ? new Date(person.lastReviewedAt).toLocaleDateString()
                    : 'never'}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => reviewMutation.mutate(person.id)}
              >
                <Check className="h-3.5 w-3.5" />
                Still accurate
              </Button>
            </div>
          </article>
        ))}

        {peopleQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            No people yet. Add yourself and the people who would need access to this information.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { RecordActions } from '@renderer/components/records/RecordActions'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import {
  PERSON_RELATIONSHIP_OPTIONS,
  type Person,
  type PersonRelationship,
  type PersonRole
} from '@shared/types/person'

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

function emptyForm() {
  return {
    fullName: '',
    relationship: 'spouse' as PersonRelationship,
    dateOfBirth: '',
    phone: '',
    email: '',
    roles: [] as PersonRole[]
  }
}

export function PeoplePage() {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const formRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => unwrap(getEverkeepApi().people.list())
  })

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setError(null)
  }

  function startEdit(person: Person) {
    setEditingId(person.id)
    setForm({
      fullName: person.fullName,
      relationship: person.relationship ?? 'spouse',
      dateOfBirth: person.dateOfBirth ?? '',
      phone: person.phone ?? '',
      email: person.email ?? '',
      roles: [...person.roles]
    })
    setError(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        fullName: form.fullName.trim(),
        relationship: form.relationship,
        dateOfBirth: form.dateOfBirth || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        roles: form.roles
      }
      if (editingId) {
        return unwrap(
          getEverkeepApi().people.update({
            id: editingId,
            ...payload,
            lastReviewedAt: new Date().toISOString()
          })
        )
      }
      return unwrap(getEverkeepApi().people.create(payload))
    },
    onMutate: () => {
      setError(null)
      setSaveStatus('saving')
    },
    onSuccess: async () => {
      resetForm()
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['review'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: (err) => {
      setSaveStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to save.')
    }
  })

  function toggleRole(role: PersonRole) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role]
    }))
  }

  return (
    <SectionPage
      title="People"
      description="Family and trusted people. Add each person once — you’ll reuse them for passports, accounts, beneficiaries, and roles. Legal documents belong in Identity."
      badge="Foundation"
    >
      <div
        ref={formRef}
        className={`mb-6 grid gap-4 rounded-xl border bg-ivory-50/80 p-5 ${
          editingId ? 'border-forest-600/40 ring-1 ring-forest-600/20' : 'border-warm-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal-900">
              {editingId ? 'Edit person' : 'New person'}
            </p>
            <p className="mt-1 text-xs text-warm-400">
              Save stores this person. A blank record is then ready so you can keep going.
            </p>
          </div>
          {editingId && (
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="personName">Full name</Label>
            <Input
              id="personName"
              value={form.fullName}
              onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <Label htmlFor="relationship">Relationship</Label>
            <select
              id="relationship"
              value={form.relationship}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  relationship: e.target.value as PersonRelationship
                }))
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
            <Label htmlFor="personDob">Date of birth (optional)</Label>
            <Input
              id="personDob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((current) => ({ ...current, dateOfBirth: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="personPhone">Phone</Label>
            <Input
              id="personPhone"
              value={form.phone}
              onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="personEmail">Email</Label>
            <Input
              id="personEmail"
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Roles</Label>
          <p className="mt-1 text-xs text-warm-400">
            Optional. Mark executor, trustee, and similar roles here instead of creating duplicate
            name records.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => {
              const selected = form.roles.includes(role.value)
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
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
        <div>
          <Button
            disabled={!form.fullName.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
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
                  {PERSON_RELATIONSHIP_OPTIONS.find((item) => item.value === person.relationship)
                    ?.label ?? 'No relationship set'}
                </p>
                {(person.phone || person.email) && (
                  <p className="mt-2 text-sm text-warm-500">
                    {[person.phone, person.email].filter(Boolean).join(' · ')}
                  </p>
                )}
                {person.roles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {person.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-md bg-forest-700/10 px-2 py-1 text-xs font-medium text-forest-700"
                      >
                        {ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <RecordActions
                onEdit={() => startEdit(person)}
                onArchive={() =>
                  void unwrap(getEverkeepApi().people.archive(person.id)).then(async () => {
                    if (editingId === person.id) resetForm()
                    await queryClient.invalidateQueries({ queryKey: ['people'] })
                    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                    await queryClient.invalidateQueries({ queryKey: ['review'] })
                  })
                }
              />
            </div>
          </article>
        ))}

        {peopleQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            No people yet. Save yourself and the people who would need access to this information.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

import { useJourneyStore } from '@renderer/state/journeyStore'
import { TOPIC_CONTENT } from '@shared/sections/topicContent'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { RecordActions } from '@renderer/components/records/RecordActions'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { parsePersonIds } from '@shared/people'
import { kindLabelFor } from '@shared/sections/definitions'
import { getSectionDefinition } from '@shared/sections/definitions'
import {
  PERSON_RELATIONSHIP_OPTIONS,
  PERSON_ROLE_OPTIONS,
  type Person,
  type PersonRelationship,
  type PersonRole
} from '@shared/types/person'

const IDENTITY_SHORTCUTS = [
  { kind: 'legal_name', label: 'Legal name' },
  { kind: 'ssn', label: 'Social Security' },
  { kind: 'drivers_license', label: 'License' },
  { kind: 'passport', label: 'Passport' }
] as const

function emptyForm() {
  return {
    fullName: '',
    relationship: 'spouse' as PersonRelationship,
    dateOfBirth: '',
    phone: '',
    email: '',
    company: '',
    roles: [] as PersonRole[]
  }
}

export function PeoplePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const formRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const identityDef = getSectionDefinition('identity')

  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => unwrap(getEverkeepApi().people.list())
  })

  const identityQuery = useQuery({
    queryKey: ['entries', 'identity'],
    queryFn: () => unwrap(getEverkeepApi().entries.list('identity'))
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
      company: person.company ?? '',
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
        company: form.company.trim() || null,
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
      const vaultId = useVaultStore.getState().session?.metadata.id
      const status = vaultId ? useJourneyStore.getState().vaults[vaultId]?.['people'] : undefined
      if (vaultId && (!status || status === 'reviewed' || status === 'not-applicable')) useJourneyStore.getState().mark(vaultId, 'people', 'in-progress')
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
    <SectionPage journeyBlocked={Boolean(editingId) || JSON.stringify(form) !== JSON.stringify(emptyForm()) || saveMutation.isPending}
      title="Contacts"
      description="Everyone in one list — family, beneficiaries, attorneys, and anyone else. Add a person once, then pick them in other sections. IDs like passports belong on that person."
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
            <h2 className="font-display text-2xl text-charcoal-900">
              {editingId ? 'Update this contact' : TOPIC_CONTENT.people.heading}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-warm-500">
              {TOPIC_CONTENT.people.guidance}
            </p>
          </div>
          {(editingId || JSON.stringify(form) !== JSON.stringify(emptyForm())) && (
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
            <Label htmlFor="personCompany">Company (optional)</Label>
            <Input
              id="personCompany"
              value={form.company}
              onChange={(e) => setForm((current) => ({ ...current, company: e.target.value }))}
              placeholder="Law firm, clinic, employer…"
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
          <div>
            <Label htmlFor="personEmail">Email</Label>
            <Input
              id="personEmail"
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Assignments</Label>
          <p className="mt-1 text-xs text-warm-400">
            Check every role that applies. One person can be family, a beneficiary, and an executor.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PERSON_ROLE_OPTIONS.map((role) => {
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
            {saveMutation.isPending ? 'Saving…' : 'Save contact'}
          </Button>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
      </div>

      {peopleQuery.isLoading && <p className="text-sm text-warm-500">Loading contacts…</p>}
      {peopleQuery.isError && (
        <p className="text-sm text-red-800">Unable to load contacts. Is a vault open?</p>
      )}

      <h2 className="mb-4 font-display text-2xl">{TOPIC_CONTENT.people.collection}</h2>
      <div className="space-y-3">
        {(peopleQuery.data ?? []).map((person) => {
          const ids = (identityQuery.data ?? []).filter(
            (entry) => parsePersonIds(entry.fields.personId)[0] === person.id
          )
          return (
            <article
              key={person.id}
              className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-charcoal-900">{person.fullName}</h3>
                  <p className="mt-1 text-sm text-warm-500">
                    {[
                      PERSON_RELATIONSHIP_OPTIONS.find((item) => item.value === person.relationship)
                        ?.label,
                      person.company
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No relationship set'}
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
                          {PERSON_ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 rounded-lg border border-warm-200 bg-white/60 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-warm-400">
                      IDs and documents
                    </p>
                    {ids.length === 0 ? (
                      <p className="mt-1 text-sm text-warm-500">None yet for this person.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-sm text-charcoal-800">
                        {ids.map((entry) => (
                          <li key={entry.id}>
                            <button
                              type="button"
                              className="text-left text-forest-700 underline-offset-2 hover:underline"
                              onClick={() =>
                                navigate(`/identity?edit=${entry.id}`)
                              }
                            >
                              {kindLabelFor(identityDef, entry.kind) || entry.title}
                              {entry.title && entry.title !== kindLabelFor(identityDef, entry.kind)
                                ? ` — ${entry.title}`
                                : ''}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {IDENTITY_SHORTCUTS.map((item) => (
                        <Button
                          key={item.kind}
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            navigate(`/identity?personId=${person.id}&kind=${item.kind}`)
                          }
                        >
                          Add {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>
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
          )
        })}

        {peopleQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            {TOPIC_CONTENT.people.empty}
          </div>
        )}
      </div>
    </SectionPage>
  )
}

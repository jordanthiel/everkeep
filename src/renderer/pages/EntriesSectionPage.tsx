import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, FileUp, Save, X } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { RecordActions } from '@renderer/components/records/RecordActions'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { EntryAttachments } from '@renderer/components/attachments/EntryAttachments'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import {
  buildEntryTitle,
  getSectionDefinition,
  getVisibleFields,
  kindLabelFor
} from '@shared/sections/definitions'
import type { VaultEntry, VaultSectionId } from '@shared/types/entry'
import type { Person } from '@shared/types/person'

function maskValue(value: string): string {
  if (value.length <= 4) return '••••'
  return `•••-••-${value.slice(-4)}`
}

function emptyForm(sectionId: VaultSectionId) {
  const def = getSectionDefinition(sectionId)
  return {
    kind: def.kinds?.[0]?.value ?? '',
    title: '',
    fields: {} as Record<string, string>,
    sensitiveFields: {} as Record<string, string>,
    notes: '',
    locationText: '',
    pendingFile: null as { path: string; filename: string } | null
  }
}

export function EntriesSectionPage({ sectionId }: { sectionId: VaultSectionId }) {
  const def = useMemo(() => getSectionDefinition(sectionId), [sectionId])
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const formRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState(() => emptyForm(sectionId))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const entriesQuery = useQuery({
    queryKey: ['entries', sectionId],
    queryFn: () => unwrap(getEverkeepApi().entries.list(sectionId))
  })

  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => unwrap(getEverkeepApi().people.list())
  })

  const people = peopleQuery.data ?? []
  const visibleFields = getVisibleFields(def, form.kind)
  const usesPeople = def.fields.some((field) => field.type === 'person')

  useEffect(() => {
    setForm(emptyForm(sectionId))
    setEditingId(null)
    setError(null)
  }, [sectionId])

  function resetForm() {
    setForm(emptyForm(sectionId))
    setEditingId(null)
    setError(null)
  }

  function startEdit(entry: VaultEntry) {
    setEditingId(entry.id)
    setForm({
      kind: entry.kind || def.kinds?.[0]?.value || '',
      title: def.hideTitle ? '' : entry.title,
      fields: { ...entry.fields },
      sensitiveFields: { ...entry.sensitiveFields },
      notes: entry.notes ?? '',
      locationText: entry.locationText ?? '',
      pendingFile: null
    })
    setError(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const personName = people.find((person) => person.id === form.fields.personId)?.fullName
      const resolvedTitle = buildEntryTitle({
        def,
        kind: form.kind,
        title: form.title,
        fields: form.fields,
        personName,
        fallbackFilename: form.pendingFile?.filename
      })

      const nextFields: Record<string, string> = {}
      const nextSensitive: Record<string, string> = {}
      for (const field of visibleFields) {
        const value = field.sensitive
          ? (form.sensitiveFields[field.key] ?? '')
          : (form.fields[field.key] ?? '')
        if (!value) continue
        if (field.sensitive) nextSensitive[field.key] = value
        else nextFields[field.key] = value
      }

      const payload = {
        kind: form.kind || null,
        title: resolvedTitle,
        fields: nextFields,
        sensitiveFields: nextSensitive,
        notes: form.notes.trim() || null,
        locationText: form.locationText.trim() || null
      }

      if (editingId) {
        return unwrap(
          getEverkeepApi().entries.update({
            id: editingId,
            ...payload,
            lastReviewedAt: new Date().toISOString()
          })
        )
      }

      const created = await unwrap(
        getEverkeepApi().entries.create({
          section: sectionId,
          ...payload
        })
      )
      if (form.pendingFile) {
        await unwrap(getEverkeepApi().attachments.attach(created.id, form.pendingFile.path))
      }
      return created
    },
    onMutate: () => {
      setError(null)
      setSaveStatus('saving')
    },
    onSuccess: async (saved) => {
      resetForm()
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['entries', sectionId] })
      await queryClient.invalidateQueries({ queryKey: ['attachments', saved.id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['review'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: (err) => {
      setSaveStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to save.')
    }
  })

  async function choosePendingFile() {
    setError(null)
    try {
      const picked = await unwrap(getEverkeepApi().attachments.pickFile())
      if (!picked) return
      setForm((current) => ({
        ...current,
        pendingFile: picked,
        title:
          current.title.trim() || picked.filename.replace(/\.[^.]+$/, '')
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to choose file.')
    }
  }

  function setField(key: string, value: string, sensitive?: boolean) {
    if (sensitive) {
      setForm((current) => ({
        ...current,
        sensitiveFields: { ...current.sensitiveFields, [key]: value }
      }))
    } else {
      setForm((current) => ({
        ...current,
        fields: { ...current.fields, [key]: value }
      }))
    }
  }

  function onPersonChange(personId: string) {
    const person = people.find((item) => item.id === personId)
    setForm((current) => {
      const nextFields: Record<string, string> = { ...current.fields, personId }
      if (person && def.id === 'identity' && current.kind === 'legal_name') {
        if (!nextFields.fullLegalName?.trim()) nextFields.fullLegalName = person.fullName
        if (!nextFields.dateOfBirth && person.dateOfBirth) nextFields.dateOfBirth = person.dateOfBirth
      }
      return { ...current, fields: nextFields }
    })
  }

  function fieldValue(field: { key: string; sensitive?: boolean }): string {
    return field.sensitive
      ? (form.sensitiveFields[field.key] ?? '')
      : (form.fields[field.key] ?? '')
  }

  function displayFieldValue(
    entry: VaultEntry,
    field: (typeof def.fields)[number],
    peopleList: Person[]
  ): string | null {
    const raw = field.sensitive ? entry.sensitiveFields[field.key] : entry.fields[field.key]
    if (!raw) return null
    if (field.type === 'person') {
      return peopleList.find((person) => person.id === raw)?.fullName ?? 'Unknown person'
    }
    return raw
  }

  return (
    <SectionPage title={def.title} description={def.description} badge={def.badge}>
      {def.disclaimer && (
        <div className="mb-6 rounded-xl border border-brass-400/30 bg-brass-400/5 px-5 py-4 text-sm text-charcoal-800">
          {def.disclaimer}
        </div>
      )}

      <div
        ref={formRef}
        className={`mb-6 grid gap-4 rounded-xl border bg-ivory-50/80 p-5 md:grid-cols-2 ${
          editingId ? 'border-forest-600/40 ring-1 ring-forest-600/20' : 'border-warm-200'
        }`}
      >
        <div className="md:col-span-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal-900">
              {editingId ? 'Edit record' : 'New record'}
            </p>
            <p className="mt-1 text-xs text-warm-400">
              Save stores this one. A blank record is then ready so you can keep going.
            </p>
          </div>
          {editingId && (
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>

        {def.kinds && (
          <div className={def.hideTitle ? 'md:col-span-2' : undefined}>
            <Label htmlFor={`${sectionId}-kind`}>{def.kindLabel ?? 'Type'}</Label>
            <select
              id={`${sectionId}-kind`}
              value={form.kind}
              onChange={(e) => setForm((current) => ({ ...current, kind: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
            >
              {def.kinds.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!def.hideTitle && (
          <div className={def.kinds ? '' : 'md:col-span-2'}>
            <Label htmlFor={`${sectionId}-title`}>{def.titleLabel ?? 'Title'}</Label>
            <Input
              id={`${sectionId}-title`}
              value={form.title}
              placeholder={def.titlePlaceholder}
              onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
            />
          </div>
        )}

        {visibleFields.map((field) => {
          const value = fieldValue(field)
          const id = `${sectionId}-${field.key}`
          return (
            <div
              key={field.key}
              className={field.type === 'textarea' ? 'md:col-span-2' : undefined}
            >
              <Label htmlFor={id}>{field.label}</Label>
              {field.type === 'person' ? (
                <>
                  <select
                    id={id}
                    value={value}
                    onChange={(e) => onPersonChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
                  >
                    <option value="">Select a person</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                  </select>
                  {usesPeople && people.length === 0 && (
                    <p className="mt-1 text-xs text-warm-400">
                      <Link to="/people" className="text-forest-700 underline-offset-2 hover:underline">
                        Add people
                      </Link>{' '}
                      first, then pick who this belongs to.
                    </p>
                  )}
                </>
              ) : field.type === 'textarea' ? (
                <textarea
                  id={id}
                  rows={4}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(e) => setField(field.key, e.target.value, field.sensitive)}
                  className="w-full rounded-md border border-warm-300 bg-ivory-50 px-3 py-2 text-sm"
                />
              ) : field.type === 'select' ? (
                <select
                  id={id}
                  value={value}
                  onChange={(e) => setField(field.key, e.target.value, field.sensitive)}
                  className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={id}
                  type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(e) => setField(field.key, e.target.value, field.sensitive)}
                  autoComplete={field.sensitive ? 'off' : undefined}
                />
              )}
            </div>
          )
        })}

        {def.showLocation && (
          <div className="md:col-span-2">
            <Label htmlFor={`${sectionId}-location`}>Where is it?</Label>
            <Input
              id={`${sectionId}-location`}
              value={form.locationText}
              onChange={(e) =>
                setForm((current) => ({ ...current, locationText: e.target.value }))
              }
              placeholder="Home safe, attorney office, filing cabinet…"
            />
          </div>
        )}

        {def.showNotes !== false && (
          <div className="md:col-span-2">
            <Label htmlFor={`${sectionId}-notes`}>Notes</Label>
            <textarea
              id={`${sectionId}-notes`}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              className="w-full rounded-md border border-warm-300 bg-ivory-50 px-3 py-2 text-sm"
            />
          </div>
        )}

        {def.showAttachments && !editingId && (
          <div className="md:col-span-2">
            <Label>File to attach</Label>
            {form.pendingFile ? (
              <div className="mt-1.5 flex items-center justify-between gap-3 rounded-md border border-forest-600/20 bg-forest-700/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal-900">
                    {form.pendingFile.filename}
                  </p>
                  <p className="text-xs text-warm-500">Will be uploaded when you save this document</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void choosePendingFile()}>
                    Change
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((current) => ({ ...current, pendingFile: null }))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="mt-1.5"
                variant="secondary"
                onClick={() => void choosePendingFile()}
              >
                <FileUp className="h-4 w-4" />
                Choose file
              </Button>
            )}
          </div>
        )}

        <div className="md:col-span-2">
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {(entriesQuery.data ?? []).map((entry) => {
          const kindLabel = kindLabelFor(def, entry.kind)
          return (
            <article
              key={entry.id}
              className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-charcoal-900">{entry.title}</h3>
                  {kindLabel && (
                    <p className="mt-1 text-sm text-warm-500">{kindLabel}</p>
                  )}
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {def.fields.map((field) => {
                      const raw = displayFieldValue(entry, field, people)
                      if (!raw) return null
                      const show = revealed[`${entry.id}:${field.key}`]
                      return (
                        <div key={field.key}>
                          <dt className="text-xs uppercase tracking-wide text-warm-400">
                            {field.label}
                          </dt>
                          <dd className="mt-0.5 flex items-center gap-2 text-charcoal-800">
                            <span className="break-words">
                              {field.sensitive && !show ? maskValue(raw) : raw}
                            </span>
                            {field.sensitive && (
                              <button
                                type="button"
                                className="text-warm-400 hover:text-charcoal-800"
                                onClick={() =>
                                  setRevealed((current) => ({
                                    ...current,
                                    [`${entry.id}:${field.key}`]: !show
                                  }))
                                }
                                aria-label={show ? 'Hide' : 'Reveal'}
                              >
                                {show ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                  {entry.locationText && (
                    <p className="mt-3 text-sm text-warm-500">
                      Location: {entry.locationText}
                    </p>
                  )}
                  {entry.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal-800">
                      {entry.notes}
                    </p>
                  )}
                  {def.showAttachments && <EntryAttachments entryId={entry.id} />}
                </div>
                <RecordActions
                  onEdit={() => startEdit(entry)}
                  onArchive={() =>
                    void unwrap(getEverkeepApi().entries.archive(entry.id)).then(async () => {
                      if (editingId === entry.id) resetForm()
                      await queryClient.invalidateQueries({ queryKey: ['entries', sectionId] })
                      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                      await queryClient.invalidateQueries({ queryKey: ['review'] })
                    })
                  }
                />
              </div>
            </article>
          )
        })}

        {entriesQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            Nothing here yet. Save the first record your family would need to find.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

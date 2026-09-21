import { useJourneyStore } from '@renderer/state/journeyStore'
import { RecordLoginFields } from '@renderer/components/records/RecordLoginFields'
import type { RecordLoginInput } from '@shared/types/recordLogin'
import { TOPIC_CONTENT, entryFormContent, topicFieldPresentation } from '@shared/sections/topicContent'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, FileUp, Save, X } from 'lucide-react'
import { RecordPage } from '@renderer/components/records/RecordPage'
import { useRecordEditor } from '@renderer/hooks/useRecordEditor'
import { PersonPicker } from '@renderer/components/people/PersonPicker'
import { RecordActions } from '@renderer/components/records/RecordActions'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { EntryAttachments } from '@renderer/components/attachments/EntryAttachments'
import { isFreemiumLimitError, PaywallSheet } from '@renderer/components/license/PaywallSheet'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { groupEntriesByPerson, resolvePersonNames } from '@shared/people'
import {
  buildEntryTitle,
  getSectionDefinition,
  getVisibleFields,
  kindLabelFor,
  type SectionDefinition
} from '@shared/sections/definitions'
import type { VaultEntry, VaultSectionId } from '@shared/types/entry'

function maskValue(value: string): string {
  if (value.length <= 4) return '••••'
  return `•••-••-${value.slice(-4)}`
}

function emptyForm(sectionId: VaultSectionId) {
  const def = getSectionDefinition(sectionId)
  return {
    login: null as RecordLoginInput | null,
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
  const protectedVault = useVaultStore(s => s.session?.metadata.isPasswordProtected)
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const [searchParams, setSearchParams] = useSearchParams()

  const [form, setForm] = useState(() => emptyForm(sectionId))
  const content = entryFormContent(sectionId, form.kind, def.kinds?.find(kind => kind.value === form.kind)?.label)
  const editor = useRecordEditor(form)
  const openEditor = editor.open
  const setRecordMessage = editor.setMessage
  const [editingId, setEditingId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)

  const entriesQuery = useQuery({
    queryKey: ['entries', sectionId],
    queryFn: () => unwrap(getEverkeepApi().entries.list(sectionId))
  })

  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => unwrap(getEverkeepApi().people.list())
  })

  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data])
  const visibleFields = getVisibleFields(def, form.kind)
  const identityGroups = useMemo(
    () =>
      sectionId === 'identity'
        ? groupEntriesByPerson(entriesQuery.data ?? [], people)
        : [],
    [sectionId, entriesQuery.data, people]
  )

  useEffect(() => {
    setForm(emptyForm(sectionId))
    setEditingId(null)
    setError(null)
  }, [sectionId])

  const startEdit = useCallback(
    (entry: VaultEntry) => {
      setEditingId(entry.id)
      const initial = {
        kind: entry.kind || def.kinds?.[0]?.value || '',
        title: def.hideTitle ? '' : entry.title,
        fields: { ...entry.fields },
        sensitiveFields: { ...entry.sensitiveFields },
        login: entry.login ?? null,
        notes: entry.notes ?? '',
        locationText: entry.locationText ?? '',
        pendingFile: null
      }
      setForm(initial)
      openEditor(initial)
      setError(null)
    },
    [def, openEditor]
  )

  useEffect(() => {
    const personId = searchParams.get('personId')
    const kind = searchParams.get('kind')
    const editId = searchParams.get('edit')
    if (!personId && !kind && !editId) return

    if (editId) {
      if (!entriesQuery.isSuccess) return
      const entry = entriesQuery.data?.find((item) => item.id === editId)
      if (entry) startEdit(entry)
      else setRecordMessage('This record is no longer available. Choose another record or add a new one.')
      setSearchParams({}, { replace: true })
      return
    }

    const initial = emptyForm(sectionId)
    if (kind && def.kinds?.some(option => option.value === kind)) initial.kind = kind
    if (personId) initial.fields.personId = personId
    setForm(initial)
    openEditor(initial)
    setSearchParams({}, { replace: true })
  }, [searchParams, entriesQuery.data, entriesQuery.isSuccess, setSearchParams, startEdit, sectionId, def.kinds, openEditor, setRecordMessage])

  function resetForm() {
    setForm(emptyForm(sectionId))
    setEditingId(null)
    setError(null)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.login && !form.login.provider.trim()) throw new Error('Enter the login’s provider or service, or remove the optional login before saving.')
      for (const field of visibleFields) {
        if (field.required && !(field.sensitive ? form.sensitiveFields[field.key] : form.fields[field.key])?.trim()) throw new Error(`Enter ${field.label.toLowerCase()} before saving.`)
      }
      if (sectionId === 'identity' && !form.fields.personId?.trim()) {
        throw new Error('Choose who this ID belongs to before saving.')
      }
      const personName = resolvePersonNames(form.fields.personId, people)
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
        login: sectionId === 'digital' ? undefined : form.login,
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
      const vaultId = useVaultStore.getState().session?.metadata.id
      const status = vaultId ? useJourneyStore.getState().vaults[vaultId]?.[sectionId] : undefined
      if (vaultId && (!status || status === 'reviewed' || status === 'not-applicable')) useJourneyStore.getState().mark(vaultId, sectionId, 'in-progress')
      await queryClient.invalidateQueries({ queryKey: ['entries'] })
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      await queryClient.invalidateQueries({ queryKey: ['attachments', saved.id] })
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['review'] })
      resetForm()
      setSaveStatus('saved')
      editor.saved(saved.id)
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: (err) => {
      setSaveStatus('error')
      if (isFreemiumLimitError(err)) {
        setPaywallOpen(true)
        setError(null)
        return
      }
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

  function onPersonFieldChange(key: string, next: string) {
    const person = people.find((item) => item.id === next)
    setForm((current) => {
      const nextFields: Record<string, string> = { ...current.fields, [key]: next }
      if (key === 'personId' && person && def.id === 'identity' && current.kind === 'legal_name') {
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
    peopleList: Array<{ id: string; fullName: string }>
  ): string | null {
    const raw = field.sensitive ? entry.sensitiveFields[field.key] : entry.fields[field.key]
    if (!raw) return null
    if (field.type === 'person') {
      return resolvePersonNames(raw, peopleList)
    }
    return raw
  }

  return (
    <>
    <RecordPage title={def.title} description={def.description.split(/(?<=[.!?])\s/)[0]}
      collection={TOPIC_CONTENT[sectionId].collection} noun={TOPIC_CONTENT[sectionId].noun} empty={TOPIC_CONTENT[sectionId].empty}
      count={entriesQuery.data?.length ?? 0} loading={entriesQuery.isPending} failed={entriesQuery.isError} retry={() => void entriesQuery.refetch()}
      editor={editor} saving={saveMutation.isPending}
      onAdd={() => { resetForm(); openEditor(emptyForm(sectionId)) }}
      onCancel={() => { resetForm(); editor.close() }}
      saveAction={<div className="md:col-span-2">
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : `Save ${content.noun}`}
          </Button>
          {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
        </div>}
      form={<>{sectionId === 'digital' && <p className="mb-4 text-sm text-warm-500">Use the provider’s setup tools: <a className="text-forest-700 underline" href="https://support.apple.com/en-us/102631" target="_blank" rel="noreferrer">Apple Legacy Contact</a> or <a className="text-forest-700 underline" href="https://support.google.com/accounts/answer/3036546?hl=en" target="_blank" rel="noreferrer">Google Inactive Account Manager</a>. Apple legacy access does not include Keychain passwords or passkeys.</p>}
      {def.disclaimer && (
        <div className="mb-6 rounded-xl border border-brass-400/30 bg-brass-400/5 px-5 py-4 text-sm text-charcoal-800">
          {def.disclaimer}
        </div>
      )}
      <div
        className={`mb-6 grid gap-4 rounded-xl border bg-ivory-50/80 p-5 md:grid-cols-2 ${
          editingId ? 'border-forest-600/40 ring-1 ring-forest-600/20' : 'border-warm-200'
        }`}
      >
        <div className="md:col-span-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-charcoal-900">
              {editingId ? `Edit ${content.noun}` : `Add ${content.noun}`}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-warm-500">
              {content.guidance}
            </p>
          </div>

        </div>

        {sectionId === 'dependents' && <fieldset className="md:col-span-2"><legend className="mb-3 text-sm font-medium">{content.kindLabel}</legend><div className="grid gap-3 sm:grid-cols-3">{def.kinds?.map(kind => <label key={kind.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm ${form.kind === kind.value ? 'border-forest-600 bg-forest-700/5' : 'border-warm-200 bg-white'}`}><input type="radio" name="care-profile-kind" value={kind.value} checked={form.kind === kind.value} onChange={() => setForm(current => ({...current, kind: kind.value}))} />{kind.label}</label>)}</div></fieldset>}
        {def.kinds && sectionId !== 'dependents' && (
          <div className={def.hideTitle ? 'md:col-span-2' : undefined}>
            <Label htmlFor={`${sectionId}-kind`}>{content.kindLabel}</Label>
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
            <Label htmlFor={`${sectionId}-title`}>{content.titleLabel}</Label>
            <Input
              id={`${sectionId}-title`}
              value={form.title}
              placeholder={content.titleExample ?? def.titlePlaceholder}
              onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
            />
          </div>
        )}

        {sectionId === 'digital' && editingId && entriesQuery.data?.find(entry => entry.id === editingId)?.linkedRecords?.map(record => <p key={record.path} className="md:col-span-2 text-sm text-forest-700">Linked to: {record.archived ? `${record.title} (archived)` : <Link className="underline" to={record.path}>{record.title}</Link>}. Changes to this login appear on the linked record too.</p>)}

        {visibleFields.map((field) => {
          const presentation = topicFieldPresentation(sectionId, field.key, form.kind)
          const value = fieldValue(field)
          const id = `${sectionId}-${field.key}`
          return (
            <div
              key={field.key}
              className={field.type === 'textarea' ? 'md:col-span-2' : undefined}
            >
              <Label htmlFor={id}>{presentation.label ?? field.label}</Label>
              {field.type === 'person' ? (
                <PersonPicker
                  id={id}
                  people={people}
                  value={value}
                  multi={field.multi}
                  assignRole={field.assignRole}
                  placeholder="Type a name to pick or add…"
                  onChange={(next) => onPersonFieldChange(field.key, next)}
                />
              ) : field.type === 'textarea' ? (
                <textarea
                  id={id}
                  rows={sectionId === 'letters' && field.key === 'body' ? 10 : 4}
                  value={value}
                  placeholder={presentation.placeholder ?? field.placeholder}
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
                  disabled={sectionId === 'digital' && field.key === 'password' && !protectedVault}
                  type={field.key === 'password' ? 'password' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                  value={value}
                  placeholder={presentation.placeholder ?? field.placeholder}
                  onChange={(e) => setField(field.key, e.target.value, field.sensitive)}
                  autoComplete={field.sensitive ? 'off' : undefined}
                />
              )}
            </div>
          )
        })}

        {sectionId !== 'digital' && <RecordLoginFields key={editingId ?? 'new'} value={form.login} provider={form.fields.carrier || form.fields.creditor || form.fields.institution || (def.fields.find(field => field.key === 'provider')?.type === 'person' ? resolvePersonNames(form.fields.provider, people) : form.fields.provider) || form.title} onChange={login => setForm(current => ({ ...current, login }))} />}
        {sectionId === 'digital' && !protectedVault && <p className="md:col-span-2 text-sm text-warm-500">Enable vault password protection in <Link className="underline" to="/settings">Settings</Link> to save a login password. Other details can be saved now.</p>}

        {def.showLocation && (
          <div className="md:col-span-2">
            <Label htmlFor={`${sectionId}-location`}>{content.locationLabel}</Label>
            <Input
              id={`${sectionId}-location`}
              value={form.locationText}
              onChange={(e) =>
                setForm((current) => ({ ...current, locationText: e.target.value }))
              }
              placeholder={content.locationExample}
            />
          </div>
        )}

        {def.showNotes !== false && (
          <div className="md:col-span-2">
            <Label htmlFor={`${sectionId}-notes`}>{content.notesLabel}</Label>
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
                  <p className="text-xs text-warm-500">The copy will be stored in your vault when you save this document</p>
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
                Choose a document copy
              </Button>
            )}
          </div>
        )}


      </div>
      </>}
    >
      <div className="space-y-6">
        {sectionId === 'identity'
          ? identityGroups.map((group) => (
              <section key={group.personId ?? 'unassigned'} className="space-y-3">
                <h2 className="text-sm font-medium text-charcoal-800">{group.personName}</h2>
                {group.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    def={def}
                    people={people}
                    revealed={revealed}
                    setRevealed={setRevealed}
                    onEdit={() => startEdit(entry)}
                    onArchive={() =>
                      void unwrap(getEverkeepApi().entries.archive(entry.id)).then(async () => {
                        if (editingId === entry.id) resetForm()
                        await queryClient.invalidateQueries({ queryKey: ['entries'] })
                        await queryClient.invalidateQueries({ queryKey: ['accounts'] })
                        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                        await queryClient.invalidateQueries({ queryKey: ['review'] })
                      })
                    }
                    displayFieldValue={displayFieldValue}
                  />
                ))}
              </section>
            ))
          : (entriesQuery.data ?? []).map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                def={def}
                people={people}
                revealed={revealed}
                setRevealed={setRevealed}
                onEdit={() => startEdit(entry)}
                onArchive={() =>
                  void unwrap(getEverkeepApi().entries.archive(entry.id)).then(async () => {
                    if (editingId === entry.id) resetForm()
                    await queryClient.invalidateQueries({ queryKey: ['entries'] })
                    await queryClient.invalidateQueries({ queryKey: ['accounts'] })
                    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                    await queryClient.invalidateQueries({ queryKey: ['review'] })
                  })
                }
                displayFieldValue={displayFieldValue}
              />
            ))}


      </div>
    </RecordPage>
    <PaywallSheet open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </>
  )
}

function EntryCard({
  entry,
  def,
  people,
  revealed,
  setRevealed,
  onEdit,
  onArchive,
  displayFieldValue
}: {
  entry: VaultEntry
  def: SectionDefinition
  people: Array<{ id: string; fullName: string }>
  revealed: Record<string, boolean>
  setRevealed: Dispatch<SetStateAction<Record<string, boolean>>>
  onEdit: () => void
  onArchive: () => void
  displayFieldValue: (
    entry: VaultEntry,
    field: SectionDefinition['fields'][number],
    peopleList: Array<{ id: string; fullName: string }>
  ) => string | null
}) {
  const kindLabel = kindLabelFor(def, entry.kind)
  const hidePersonField = def.id === 'identity'
  return (
    <article data-record-id={entry.id} tabIndex={-1} className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-charcoal-900">{entry.title}</h3>
          {kindLabel && <p className="mt-1 text-sm text-warm-500">{kindLabel}</p>}
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {def.fields.map((field) => {
              if (hidePersonField && field.key === 'personId') return null
              const raw = displayFieldValue(entry, field, people)
              if (!raw) return null
              const show = revealed[`${entry.id}:${field.key}`]
              return (
                <div key={field.key}>
                  <dt className="text-xs uppercase tracking-wide text-warm-400">{field.label}</dt>
                  <dd className="mt-0.5 flex items-center gap-2 text-charcoal-800">
                    <span className="break-words">
                      {field.sensitive && !show ? (field.key === 'password' ? '••••••••' : maskValue(raw)) : raw}
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
                        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
          {entry.login?.id && <p className="mt-3 text-sm"><Link className="text-forest-700 underline" to={`/digital?edit=${entry.login.id}`}>Digital login: {entry.login.provider}</Link></p>}
          {entry.linkedRecords?.map(record => <p key={record.path} className="mt-2 text-sm">Linked to: {record.archived ? `${record.title} (archived)` : <Link className="text-forest-700 underline" to={record.path}>{record.title}</Link>}</p>)}
          {entry.locationText && (
            <p className="mt-3 text-sm text-warm-500">Location: {entry.locationText}</p>
          )}
          {entry.notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal-800">{entry.notes}</p>
          )}
          {def.showAttachments && <EntryAttachments entryId={entry.id} />}
        </div>
        <RecordActions onEdit={onEdit} onArchive={onArchive} />
      </div>
    </article>
  )
}

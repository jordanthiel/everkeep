import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Check, Eye, EyeOff, Plus } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { getSectionDefinition } from '@shared/sections/definitions'
import type { VaultSectionId } from '@shared/types/entry'

function maskValue(value: string): string {
  if (value.length <= 4) return '••••'
  return `•••-••-${value.slice(-4)}`
}

export function EntriesSectionPage({ sectionId }: { sectionId: VaultSectionId }) {
  const def = useMemo(() => getSectionDefinition(sectionId), [sectionId])
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)

  const [kind, setKind] = useState(def.kinds?.[0]?.value ?? '')
  const [title, setTitle] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [sensitiveFields, setSensitiveFields] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [locationText, setLocationText] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const entriesQuery = useQuery({
    queryKey: ['entries', sectionId],
    queryFn: () => unwrap(getEverkeepApi().entries.list(sectionId))
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const resolvedTitle =
        title.trim() ||
        fields.carrier ||
        fields.provider ||
        fields.fullLegalName ||
        kind ||
        'Untitled'
      return unwrap(
        getEverkeepApi().entries.create({
          section: sectionId,
          kind: kind || null,
          title: resolvedTitle,
          fields,
          sensitiveFields,
          notes: notes.trim() || null,
          locationText: locationText.trim() || null
        })
      )
    },
    onMutate: () => {
      setError(null)
      setSaveStatus('saving')
    },
    onSuccess: async () => {
      setTitle('')
      setFields({})
      setSensitiveFields({})
      setNotes('')
      setLocationText('')
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['entries', sectionId] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['review'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: (err) => {
      setSaveStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to save.')
    }
  })

  function setField(key: string, value: string, sensitive?: boolean) {
    if (sensitive) {
      setSensitiveFields((current) => ({ ...current, [key]: value }))
    } else {
      setFields((current) => ({ ...current, [key]: value }))
    }
  }

  return (
    <SectionPage title={def.title} description={def.description} badge={def.badge}>
      {def.disclaimer && (
        <div className="mb-6 rounded-xl border border-brass-400/30 bg-brass-400/5 px-5 py-4 text-sm text-charcoal-800">
          {def.disclaimer}
        </div>
      )}

      <div className="mb-6 grid gap-4 rounded-xl border border-warm-200 bg-ivory-50/80 p-5 md:grid-cols-2">
        {def.kinds && (
          <div>
            <Label htmlFor={`${sectionId}-kind`}>{def.kindLabel ?? 'Type'}</Label>
            <select
              id={`${sectionId}-kind`}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
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
        <div className={def.kinds ? '' : 'md:col-span-2'}>
          <Label htmlFor={`${sectionId}-title`}>{def.titleLabel ?? 'Title'}</Label>
          <Input
            id={`${sectionId}-title`}
            value={title}
            placeholder={def.titlePlaceholder}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {def.fields.map((field) => {
          const value = field.sensitive
            ? (sensitiveFields[field.key] ?? '')
            : (fields[field.key] ?? '')
          const id = `${sectionId}-${field.key}`
          return (
            <div
              key={field.key}
              className={field.type === 'textarea' ? 'md:col-span-2' : undefined}
            >
              <Label htmlFor={id}>{field.label}</Label>
              {field.type === 'textarea' ? (
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
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-warm-300 bg-ivory-50 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="md:col-span-2">
          <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Plus className="h-4 w-4" />
            {def.addLabel}
          </Button>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {(entriesQuery.data ?? []).map((entry) => {
          const kindLabel =
            def.kinds?.find((item) => item.value === entry.kind)?.label ?? entry.kind
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
                      const raw = field.sensitive
                        ? entry.sensitiveFields[field.key]
                        : entry.fields[field.key]
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
                  <p className="mt-3 text-xs text-warm-400">
                    Last reviewed{' '}
                    {entry.lastReviewedAt
                      ? new Date(entry.lastReviewedAt).toLocaleDateString()
                      : 'never'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void unwrap(getEverkeepApi().entries.markReviewed(entry.id)).then(
                        async () => {
                          await queryClient.invalidateQueries({ queryKey: ['entries', sectionId] })
                          await queryClient.invalidateQueries({ queryKey: ['review'] })
                        }
                      )
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    Still accurate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void unwrap(getEverkeepApi().entries.archive(entry.id)).then(async () => {
                        await queryClient.invalidateQueries({ queryKey: ['entries', sectionId] })
                        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                        await queryClient.invalidateQueries({ queryKey: ['review'] })
                      })
                    }
                  >
                    Archive
                  </Button>
                </div>
              </div>
            </article>
          )
        })}

        {entriesQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            Nothing here yet. Add the first record your family would need to find.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

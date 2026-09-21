import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Label } from '@renderer/components/ui/Label'
import { PersonPicker } from '@renderer/components/people/PersonPicker'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import type { FamilyHandoff, HandoffInput } from '@shared/types/handoff'
import type { Person } from '@shared/types/person'

export function HandoffPage() {
  const vaultId = useVaultStore((s) => s.session?.metadata.id)
  const query = useQuery({ queryKey: ['handoff', vaultId], queryFn: () => unwrap(getEverkeepApi().vault.getHandoff()) })
  const people = useQuery({ queryKey: ['people'], queryFn: () => unwrap(getEverkeepApi().people.list()) })
  if (!query.data || !people.data) return <SectionPage title="Default packet instructions" description="Loading reusable instructions…"><p role="status">{query.isError || people.isError ? 'Unable to load the plan.' : 'Loading…'}</p>{(query.isError || people.isError) && <Button onClick={() => { void query.refetch(); void people.refetch() }}>Try again</Button>}</SectionPage>
  return <HandoffEditor key={vaultId} initial={query.data} people={people.data} />
}

function HandoffEditor({ initial, people }: { initial: FamilyHandoff; people: Person[] }) {
  const [form, setForm] = useState<HandoffInput>(initial)
  const [saved, setSaved] = useState<HandoffInput>(initial)
  const client = useQueryClient()
  const navigate = useNavigate()
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const save = useMutation({ mutationFn: () => unwrap(getEverkeepApi().vault.updateHandoff(form)), onSuccess: (data) => { setForm(data); setSaved(data); void client.invalidateQueries({ queryKey: ['handoff'] }) } })
  const change = (key: keyof HandoffInput, value: string) => setForm((f) => ({ ...f, [key]: value }))
  function area(key: keyof HandoffInput, label: string, hint: string) {
    return <div><Label htmlFor={key}>{label}</Label><p id={`${key}-hint`} className="mb-2 text-sm text-warm-500">{hint}</p><textarea id={key} aria-describedby={`${key}-hint`} rows={3} className="w-full rounded-md border border-warm-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/40" value={form[key]} onChange={(e) => change(key, e.target.value)} /></div>
  }
  return <SectionPage title="Default packet instructions" description="Use these notes as a starting point for new packets. Changes here do not alter an existing packet draft." journeyBlocked={dirty || save.isPending}>
    <div className="space-y-6">
      <section className="rounded-xl border border-warm-200 bg-ivory-50 p-5">
        <h2 className="mb-4 font-display text-xl">People who may be able to help (optional)</h2>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="primaryContactId">Supporting contact</Label><PersonPicker id="primaryContactId" people={people} value={form.primaryContactId} onChange={(v) => change('primaryContactId', v)} /></div><div><Label htmlFor="alternateContactId">Another supporting contact</Label><PersonPicker id="alternateContactId" people={people} value={form.alternateContactId} onChange={(v) => change('alternateContactId', v)} /></div></div>
      </section>
      <section className="space-y-4 rounded-xl border border-warm-200 bg-ivory-50 p-5">
        <h2 className="font-display text-xl">Instructions to start from</h2>
        {area('careInstructions', 'Immediate care responsibilities', 'Who depends on you? Include children, dependent adults, pets, temporary caregivers, and where to find detailed routines.')}
        {area('incapacityInstructions', 'If I cannot help', 'List immediate priorities, care contacts, and practical household needs.')}
        {area('deathInstructions', 'After my death', 'Explain where to find your preferences and which professionals can guide next steps.')}
        {area('documentsLocation', 'Where are the original documents?', 'Give a specific location and who can access it. These instructions do not replace signed documents or grant legal authority.')}
      </section>
      {save.isError && <p role="alert" className="text-sm text-red-800">{save.error.message}</p>}
      {save.isSuccess && !dirty && <p role="status" className="text-sm text-forest-700">Default instructions saved.</p>}
      <div className="flex flex-wrap gap-3"><Button disabled={save.isPending || !dirty} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save default instructions'}</Button>{dirty && <Button variant="ghost" onClick={() => setForm(saved)}>Cancel changes</Button>}<Button variant="secondary" disabled={dirty || save.isPending} onClick={() => navigate('/export')}>Continue to packet</Button><Button variant="secondary" disabled={dirty || save.isPending} onClick={() => navigate('/backup')}>Manage full-vault access</Button></div>
    </div>
  </SectionPage>
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
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
  if (!query.data || !people.data) return <SectionPage title="Start here" description="Preparing your family handoff…"><p role="status">{query.isError || people.isError ? 'Unable to load the plan.' : 'Loading…'}</p>{(query.isError || people.isError) && <Button onClick={() => { void query.refetch(); void people.refetch() }}>Try again</Button>}</SectionPage>
  return <HandoffEditor key={vaultId} initial={query.data} people={people.data} />
}

function HandoffEditor({ initial, people }: { initial: FamilyHandoff; people: Person[] }) {
  const [form, setForm] = useState<HandoffInput>(initial)
  const [saved, setSaved] = useState<HandoffInput>(initial)
  const [scenario, setScenario] = useState<'incapacity' | 'death'>('incapacity')
  const client = useQueryClient()
  const navigate = useNavigate()
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const save = useMutation({ mutationFn: () => unwrap(getEverkeepApi().vault.updateHandoff(form)), onSuccess: (data) => { setForm(data); setSaved(data); void client.invalidateQueries({ queryKey: ['handoff'] }) } })
  const change = (key: keyof HandoffInput, value: string) => setForm((f) => ({ ...f, [key]: value, ...(key !== 'handoffTestedAt' ? { handoffTestedAt: '' } : {}) }))
  function area(key: keyof HandoffInput, label: string, hint: string) {
    return <div><Label htmlFor={key}>{label}</Label><p id={`${key}-hint`} className="mb-2 text-sm text-warm-500">{hint}</p><textarea id={key} aria-describedby={`${key}-hint`} rows={3} className="w-full rounded-md border border-warm-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/40" value={form[key]} onChange={(e) => change(key, e.target.value)} /></div>
  }
  return <SectionPage title="Start here" description="Leave a short, practical starting point for someone who needs to help. Save this page, then prepare a packet for them." journeyBlocked={dirty || save.isPending}>
    <div className="space-y-6">
      <section className="rounded-xl border border-warm-200 bg-ivory-50 p-5">
        <h2 className="mb-4 font-display text-xl">1. Who should they call?</h2>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="primaryContactId">Call first</Label><PersonPicker id="primaryContactId" people={people} value={form.primaryContactId} onChange={(v) => change('primaryContactId', v)} /></div><div><Label htmlFor="alternateContactId">If that person is unavailable</Label><PersonPicker id="alternateContactId" people={people} value={form.alternateContactId} onChange={(v) => change('alternateContactId', v)} /></div></div>
      </section>
      <section className="space-y-4 rounded-xl border border-warm-200 bg-ivory-50 p-5">
        <h2 className="font-display text-xl">2. What needs attention?</h2>
        {area('careInstructions', 'Immediate care responsibilities', 'Who depends on you? Include children, dependent adults, pets, temporary caregivers, and where to find detailed routines.')}
        <div className="flex flex-wrap gap-2" aria-label="Situation"><Button variant={scenario === 'incapacity' ? 'primary' : 'secondary'} onClick={() => setScenario('incapacity')}>If I cannot help right now</Button><Button variant={scenario === 'death' ? 'primary' : 'secondary'} onClick={() => setScenario('death')}>After my death</Button></div>
        {scenario === 'incapacity' ? area('incapacityInstructions', 'Instructions if you are unavailable', 'List the immediate priorities, your care contact, and practical household needs.') : area('deathInstructions', 'Instructions after your death', 'List whom to contact, where funeral preferences are recorded, and which professional can guide next steps.')}
        {area('documentsLocation', 'Where are the original documents?', 'Give a specific location and who can access it. These instructions do not replace signed documents or grant legal authority.')}
      </section>
      <section className="space-y-4 rounded-xl border border-warm-200 bg-ivory-50 p-5">
        <h2 className="font-display text-xl">3. Can someone find and open the plan?</h2>
        {area('vaultLocation', 'How to find the vault', 'Include which computer or storage location to use and that Everkeep opens the file.')}
        {area('backupLocation', 'Where is the separate backup?', 'A backup on another device or storage location should remain available if this computer is lost.')}
        {area('passwordInstructions', 'How can an authorized person obtain access?', 'Describe a separate password handoff, such as a sealed envelope or password-manager emergency access. Do not put the only access instructions inside a locked vault.')}
        <div><Label htmlFor="sharedWith">Who has received your instructions?</Label><Input id="sharedWith" value={form.sharedWith} onChange={(e) => change('sharedWith', e.target.value)} placeholder="Name and where you gave them the instructions" /></div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={Boolean(form.handoffTestedAt)} onChange={(e) => change('handoffTestedAt', e.target.checked ? new Date().toISOString() : '')} /><span>We practiced: this person found the plan and could open it without my help.{form.handoffTestedAt && <span className="block text-xs text-warm-500">Confirmed {new Date(form.handoffTestedAt).toLocaleDateString()}</span>}</span></label>
        <p className="text-xs text-warm-500">Changing the plan clears the practice confirmation so you can check it again. Keep an accessible copy of the handoff instructions outside this vault.</p>
      </section>
      {save.isError && <p role="alert" className="text-sm text-red-800">{save.error.message}</p>}
      {save.isSuccess && !dirty && <p role="status" className="text-sm text-forest-700">Family handoff saved.</p>}
      <div className="flex flex-wrap gap-3"><Button disabled={save.isPending || !dirty} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save family handoff'}</Button>{dirty && <Button variant="ghost" onClick={() => setForm(saved)}>Cancel changes</Button>}<Button variant="secondary" disabled={dirty || save.isPending} onClick={() => navigate(`/export?preset=start&scenario=${scenario}`)}>Prepare the Start here packet</Button><Button variant="secondary" disabled={dirty || save.isPending} onClick={() => navigate('/backup')}>Back up and test access</Button></div>
    </div>
  </SectionPage>
}

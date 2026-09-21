import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { usePacketDraft } from '@renderer/hooks/usePacketDraft'
import { presetSelection, type PacketPreset } from '@shared/sections/exportPresets'
import { SECTION_DEFINITIONS } from '@shared/sections/definitions'
import { createPacketDraft, packetHasContent, packetOptions, packetRecipient, reconcilePacket } from '@shared/packet'
import type { ExportCatalog, ExportSelection } from '@shared/types/entry'
import type { PacketDraft, PacketIntroduction } from '@shared/types/packet'
import type { FamilyHandoff } from '@shared/types/handoff'
import type { Person } from '@shared/types/person'

const presets = [['start', 'Starting information'], ['caregiver', 'Care information'], ['executor', 'Estate information'], ['spouse', 'Comprehensive copy'], ['custom', 'Custom selection']] as const
const steps = ['Recipient', 'Contents', 'Introduction', 'Preview and save']
const panel = 'space-y-4 rounded-xl border border-warm-200 bg-ivory-50 p-5'
const selectStyle = 'mt-1 block w-full rounded-md border border-warm-300 bg-white p-3 text-sm'

export function ExportPage() {
  const vaultId = useVaultStore(s => s.session!.metadata.id)
  const draft = useQuery({ queryKey: ['packet-draft', vaultId], queryFn: () => unwrap(getEverkeepApi().vault.getPacketDraft()), staleTime: 0 })
  const catalog = useQuery({ queryKey: ['export-catalog', vaultId], queryFn: () => unwrap(getEverkeepApi().vault.getExportCatalog()), staleTime: 0 })
  const people = useQuery({ queryKey: ['people'], queryFn: () => unwrap(getEverkeepApi().people.list()) })
  const plan = useQuery({ queryKey: ['handoff', vaultId], queryFn: () => unwrap(getEverkeepApi().vault.getHandoff()) })
  const failed = draft.isError || catalog.isError || people.isError || plan.isError
  if (draft.data === undefined || !catalog.data || !people.data || !plan.data) return <SectionPage title="Prepare a packet" description="Choose what someone needs to know."><p role="status">{failed ? 'Unable to load your packet.' : 'Loading your packet…'}</p>{failed && <Button onClick={() => { void draft.refetch(); void catalog.refetch(); void people.refetch(); void plan.refetch() }}>Try again</Button>}</SectionPage>
  return <PacketEditor key={vaultId} vaultId={vaultId} persisted={draft.data} catalog={catalog.data} people={people.data} plan={plan.data} />
}

function PacketEditor({ vaultId, persisted, catalog, people, plan }: { vaultId: string; persisted: PacketDraft | null; catalog: ExportCatalog; people: Person[]; plan: FamilyHandoff }) {
  const [params] = useSearchParams()
  const requestedPreset = params.get('preset') as PacketPreset
  const requestedScenario = params.get('scenario')
  const initial = persisted ?? createPacketDraft(plan, catalog, presets.some(([id]) => id === requestedPreset) ? requestedPreset : 'start', requestedScenario === 'death' || requestedScenario === 'incapacity' ? requestedScenario : 'both')
  const { draft, update, flush, dirty, saving, error: saveError } = usePacketDraft(initial, persisted, vaultId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [replacement, setReplacement] = useState<PacketPreset | 'new' | null>(null)
  const [preview, setPreview] = useState<{ html: string; token: string; signature: string } | null>(null)
  const [helperId, setHelperId] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const progress = useRef<HTMLOListElement>(null)
  const stepMounted = useRef(false)
  const license = useQuery({ queryKey: ['license'], queryFn: () => unwrap(getEverkeepApi().license.getStatus()) })
  const options = packetOptions(draft, people, Boolean(license.data?.activated))
  const signature = JSON.stringify(options)
  const recipient = packetRecipient(draft, people)
  const recipientValid = Boolean(recipient)
  const missingHelpers = draft.introduction.helpers.filter(helper => !people.some(person => person.id === helper.personId))
  const hasContent = packetHasContent(options, people)
  const canPreview = recipientValid && hasContent && (!draft.includeStartHere || missingHelpers.length === 0)
  const upToDate = preview?.signature === signature
  const count = Object.values(draft.selection).reduce((total, ids) => total + ids.length, 0)
  const latest = draft.latestExport
  const latestMatches = latest?.signature === signature

  useEffect(() => {
    update(previous => {
      const result = reconcilePacket(previous, catalog)
      if (result.removed) setNotice(`${result.removed} unavailable or private record selection(s) were removed. Review your contents.`)
      return result.draft
    })
    setPreview(null)
  }, [catalog, update])
  useEffect(() => {
    if (stepMounted.current) { heading.current?.focus({ preventScroll: true }); progress.current?.scrollIntoView({ block: 'start' }) }
    stepMounted.current = true
  }, [draft.step])

  function change(patch: Partial<PacketDraft>) { update(previous => ({ ...previous, ...patch })) }
  function introduction(key: keyof Omit<PacketIntroduction, 'helpers'>, label: string, hint?: string) {
    return <label className="block text-sm" key={key}>{label}{hint && <span className="my-1 block text-warm-500">{hint}</span>}<textarea id={`packet-${key}`} rows={3} className={`${selectStyle} focus:outline-none focus:ring-2 focus:ring-forest-500/40`} value={draft.introduction[key]} onChange={event => update(previous => ({ ...previous, introduction: { ...previous.introduction, [key]: event.target.value } }))} /></label>
  }
  function applyPreset(preset: PacketPreset) {
    change({ preset, selection: presetSelection(catalog, preset), includePrivateLetters: false, includeSensitive: false, includeAccessPlan: false })
    setPreview(null)
  }
  function selectPreset(preset: PacketPreset) {
    if (preset === draft.preset) return
    if (JSON.stringify(draft.selection) !== JSON.stringify(presetSelection(catalog, draft.preset))) setReplacement(preset)
    else applyPreset(preset)
  }
  function toggle(group: keyof ExportSelection, id: string) {
    update(previous => ({ ...previous, selection: { ...previous.selection, [group]: previous.selection[group].includes(id) ? previous.selection[group].filter(item => item !== id) : [...previous.selection[group], id] } }))
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await flush(); await action() } catch (err) { setError(err instanceof Error ? err.message : 'Unable to prepare the packet.') } finally { setBusy(false) }
  }

  return <SectionPage title="Prepare a packet" description="Choose a recipient, add what they need, then preview and save their copy." journeyBlocked={dirty || saving || busy} beforeLeave={async () => { if (busy) throw new Error('Please finish the current packet operation before leaving.'); await flush() }}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p role="status" className={`text-sm ${saveError ? 'text-red-800' : 'text-warm-500'}`}>{saveError ? `Draft not saved: ${saveError}` : saving || dirty ? 'Saving draft…' : 'Draft saved in this vault'}</p>
      {saveError && <Button size="sm" variant="secondary" onClick={() => void flush().catch(() => {})}>Retry saving draft</Button>}
      <Button size="sm" variant="ghost" disabled={busy || saving} onClick={() => setReplacement('new')}>Start another packet</Button>
    </div>
    <ol ref={progress} aria-label="Packet progress" className="sticky top-0 z-10 mb-6 grid bg-ivory-50 py-2 grid-cols-2 gap-2 sm:grid-cols-4">{steps.map((label, index) => <li key={label} aria-current={draft.step === index ? 'step' : undefined} className={`rounded-md border px-3 py-2 text-sm ${draft.step === index ? 'border-forest-600 bg-forest-700/5 font-medium' : 'border-warm-200 text-warm-500'}`}>{index + 1}. {label}</li>)}</ol>
    {notice && <p role="status" className="mb-4 text-sm text-brass-500">{notice}</p>}
    <h2 ref={heading} tabIndex={-1} className="mb-4 font-display text-2xl focus:outline-none">{steps[draft.step]}</h2>
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      {draft.step === 0 && <section className={panel}>
        <h3 className="font-medium">Who will receive this?</h3>
        <div className="flex flex-wrap gap-4">{([['contact', 'Choose a contact'], ['named', 'Enter a name'], ['general', 'General copy']] as const).map(([mode, label]) => <label key={mode} className="flex items-center gap-2 text-sm"><input type="radio" name="recipient-mode" checked={draft.recipientMode === mode} onChange={() => change({ recipientMode: mode })} />{label}</label>)}</div>
        {draft.recipientMode === 'contact' && <label className="block text-sm">Recipient<select id="packet-recipient" className={selectStyle} value={draft.recipientContactId} onChange={event => { const id = event.target.value; update(previous => ({ ...previous, recipientContactId: id, introduction: { ...previous.introduction, helpers: previous.introduction.helpers.filter(helper => helper.personId !== id) } })) }}><option value="">Choose a contact</option>{draft.recipientContactId && !recipientValid && <option value={draft.recipientContactId}>Contact no longer available—choose another</option>}{people.map(person => <option value={person.id} key={person.id}>{person.fullName}</option>)}</select></label>}
        {draft.recipientMode === 'named' && <label className="block text-sm">Recipient name<Input id="packet-recipient-name" className="mt-1" maxLength={200} value={draft.recipientName} onChange={event => change({ recipientName: event.target.value })} /><span className="mt-1 block text-xs text-warm-500">This does not create a contact. Choose a saved contact above if this person is already in your plan.</span></label>}
        <p className="text-sm text-warm-500">Choosing a recipient does not assign responsibilities or legal authority.</p>
        <label className="block text-sm">When might they need this?<select id="packet-scenario" className={selectStyle} value={draft.scenario} onChange={event => change({ scenario: event.target.value as PacketDraft['scenario'] })}><option value="both">Both situations</option><option value="incapacity">If I cannot help</option><option value="death">After my death</option></select></label>
      </section>}
      {draft.step === 1 && <section className={panel}>
        <p className="text-sm">Choose what {recipient || 'the recipient'} should receive. Suggestions are starting selections; review every included record.</p>
        <div className="flex flex-wrap gap-2">{presets.map(([id, label]) => <Button key={id} size="sm" variant={draft.preset === id ? 'primary' : 'secondary'} onClick={() => selectPreset(id)}>{label}</Button>)}</div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.includeStartHere} onChange={event => change({ includeStartHere: event.target.checked })} />Include a short introduction</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.includePrivateLetters} onChange={event => { const enabled = event.target.checked; update(previous => reconcilePacket({ ...previous, includePrivateLetters: enabled }, catalog).draft) }} />Allow me to select private letters</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" disabled={!license.data?.activated} checked={Boolean(license.data?.activated) && draft.includeSensitive} onChange={event => change({ includeSensitive: event.target.checked })} />Include sensitive identifiers{!license.data?.activated && ' (Lifetime)'}</label>
        <p className="text-sm text-warm-500">{count} records selected. Attached files are not included. Other record text may still contain personal information.</p>
        {(['people', 'accounts', 'entries'] as const).map(group => <details key={group} open className="rounded-md border border-warm-200 p-3"><summary className="cursor-pointer text-sm font-medium">{group === 'people' ? 'Contacts' : group === 'accounts' ? 'Financial accounts' : 'Other records'} · {draft.selection[group].length} selected</summary><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{!catalog[group].length ? <p className="text-sm text-warm-500">No saved records in this group.</p> : catalog[group].map(item => <label key={item.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={item.private && !draft.includePrivateLetters} checked={draft.selection[group].includes(item.id)} onChange={() => toggle(group, item.id)} /><span>{item.title}<span className="block text-xs text-warm-500">{SECTION_DEFINITIONS.find(section => section.id === item.section)?.title ?? item.section}{item.private ? ' · Private letter' : ''}</span></span></label>)}</div></details>)}
      </section>}
      {draft.step === 2 && <section className={panel}>
        <p className="text-sm">For {recipient || 'your recipient'}. These notes belong to this packet. Editing them does not change your default instructions.</p>
        {!draft.includeStartHere ? <p className="text-sm text-warm-500">The introduction is off. Turn it on in Contents to add instructions.</p> : <>
          {introduction('careInstructions', 'Immediate priorities', 'What needs attention first? Point to care routines or other details already included in this packet.')}
          {draft.scenario !== 'death' && introduction('incapacityInstructions', 'If I cannot help')}
          {draft.scenario !== 'incapacity' && introduction('deathInstructions', 'After my death')}
          <div className="space-y-3 border-t border-warm-200 pt-4"><h3 className="font-medium">Other people who can help <span className="text-sm font-normal text-warm-500">(optional)</span></h3>
            {draft.introduction.helpers.filter(helper => helper.personId !== options.recipientContactId).map(helper => <div key={helper.personId} className="rounded-md border border-warm-200 p-3"><p className="text-sm font-medium">{people.find(person => person.id === helper.personId)?.fullName ?? 'Contact no longer available—remove or replace'}</p><label className="mt-2 block text-sm">How they can help<Input maxLength={2000} className="mt-1" value={helper.help} onChange={event => update(previous => ({ ...previous, introduction: { ...previous.introduction, helpers: previous.introduction.helpers.map(item => item.personId === helper.personId ? { ...item, help: event.target.value } : item) } }))} /></label><Button size="sm" variant="ghost" className="mt-2" onClick={() => update(previous => ({ ...previous, introduction: { ...previous.introduction, helpers: previous.introduction.helpers.filter(item => item.personId !== helper.personId) } }))}>Remove helper</Button></div>)}
            <label className="block text-sm">Add a supporting contact<select className={selectStyle} value={helperId} onChange={event => setHelperId(event.target.value)}><option value="">Choose someone</option>{people.filter(person => person.id !== options.recipientContactId && !draft.introduction.helpers.some(helper => helper.personId === person.id)).map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>
            <Button size="sm" variant="secondary" disabled={!helperId || helperId === options.recipientContactId || !people.some(person => person.id === helperId) || draft.introduction.helpers.some(helper => helper.personId === helperId)} onClick={() => { update(previous => ({ ...previous, introduction: { ...previous.introduction, helpers: [...previous.introduction.helpers, { personId: helperId, help: '' }] } })); setHelperId('') }}>Add helper</Button>
            <p className="text-xs text-warm-500">These helpers’ phone numbers and email addresses will be included, even if their full contact records are not selected.</p>
          </div>
          {introduction('documentsLocation', 'Original documents', 'Where are they, and how can this person find them?')}
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.includeAccessPlan} onChange={event => change({ includeAccessPlan: event.target.checked })} />Include instructions for accessing the full vault</label>
          {draft.includeAccessPlan && <div className="space-y-4 border-l-2 border-warm-200 pl-4">{introduction('vaultLocation', 'Where to find the vault')}{introduction('backupLocation', 'Where to find a separate backup')}{introduction('passwordInstructions', 'How an authorized person can obtain access', 'Describe a separate password handoff. The exported packet is not encrypted.')}</div>}
        </>}
      </section>}
      {draft.step === 3 && <section className={panel}>
        <p className="text-sm">For <strong>{recipient || 'a recipient not yet selected'}</strong> · {draft.scenario === 'both' ? 'Both situations' : draft.scenario === 'death' ? 'After my death' : 'If I cannot help'} · {count} records{draft.includeStartHere ? ' plus introduction' : ''}</p>
        <p className="text-sm text-warm-500">Check exactly what this person will receive. The exported HTML file is not encrypted. Attached files are not included.</p>
        {!recipientValid && <p role="alert" className="text-sm text-red-800">Choose an available recipient or General copy in step 1.</p>}
        {draft.includeStartHere && missingHelpers.length > 0 && <p role="alert" className="text-sm text-red-800">Remove or replace unavailable helpers in the Introduction.</p>}
        {!hasContent && <p role="status" className="text-sm text-warm-500">Add a record or some introduction text before previewing.</p>}
        <div className="flex flex-wrap gap-3"><Button disabled={!canPreview || !license.isSuccess} onClick={() => void run(async () => { const result = await unwrap(getEverkeepApi().vault.previewReport(options)); setPreview({ ...result, signature }) })}>Preview packet</Button><Button variant="secondary" disabled={!upToDate || !canPreview} onClick={() => void run(async () => { if (!preview) return; const path = await unwrap(getEverkeepApi().vault.pickExportPath(`Packet-${draft.preset}`)); if (!path) return; const result = await unwrap(getEverkeepApi().vault.exportReport({ ...options, destinationPath: path, previewToken: preview.token })); change({ latestExport: { path: result.path, savedAt: new Date().toISOString(), recipient, signature, deliveredAt: '' } }); await flush() })}>Save this preview</Button></div>
        {preview && !upToDate && <p role="status" className="text-sm text-warm-500">The packet changed. Preview it again before saving.</p>}
        {preview && upToDate && <iframe title="Exact packet preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html} className="h-[550px] w-full rounded-md border border-warm-300 bg-white" />}
        {latest && <div role="status" className="space-y-3 border-t border-warm-200 pt-4"><h3 className="font-medium">{latest.deliveredAt ? `You confirmed giving the packet to ${latest.recipient}` : 'Packet saved—it has not been sent'}</h3><p className="break-all text-sm">{latest.path}</p><p className="text-sm text-warm-500">Open this HTML file in a browser to print it or save as PDF, then give the copy to your recipient. Review it together if possible.</p>{!latestMatches && <p className="text-sm text-warm-500">Your draft has changed since this export. Save a new preview to include those changes.</p>}{latestMatches && !latest.deliveredAt && <Button variant="secondary" onClick={() => void run(async () => { change({ latestExport: { ...latest, deliveredAt: new Date().toISOString() } }); await flush() })}>I gave this packet to {latest.recipient === 'General copy' ? 'someone' : latest.recipient}</Button>}</div>}
      </section>}
    </fieldset>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-warm-200 bg-ivory-50 py-4">
      <Button variant="secondary" disabled={busy || draft.step === 0} onClick={() => change({ step: draft.step - 1 })}>Back</Button>
      {draft.step < 3 ? <Button disabled={busy || (draft.step === 0 && !recipientValid)} onClick={() => change({ step: draft.step + 1 })}>Continue to {steps[draft.step + 1].toLowerCase()}</Button> : <Link to="/finish" className="text-sm text-forest-700 underline">Back to Review & Share</Link>}
    </div>
    <ConfirmDialog open={replacement !== null} title={replacement === 'new' ? 'Start another packet?' : 'Replace your selected contents?'} description={replacement === 'new' ? 'This replaces the current draft. Files you already exported will remain available.' : 'The suggested contents will replace your selections and reset optional private, sensitive, and access inclusions.'} onCancel={() => setReplacement(null)} onConfirm={() => { if (replacement === 'new') { update(() => createPacketDraft(plan, catalog)); setPreview(null); setNotice(''); setHelperId('') } else if (replacement) applyPreset(replacement); setReplacement(null) }} />
  </SectionPage>
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { presetSelection, type PacketPreset } from '@shared/sections/exportPresets'
import { SECTION_DEFINITIONS } from '@shared/sections/definitions'
import type { ExportCatalog, ExportOptions, ExportSelection } from '@shared/types/entry'

export function ExportPage() {
  const session = useVaultStore((s) => s.session)
  const catalog = useQuery({ queryKey: ['export-catalog', session?.metadata.id], queryFn: () => unwrap(getEverkeepApi().vault.getExportCatalog()) })
  if (!catalog.data) return <SectionPage title="Prepare a packet" description="Choose only what this person needs."><p role="status">{catalog.isError ? 'Unable to load records.' : 'Loading records…'}</p>{catalog.isError && <Button onClick={() => void catalog.refetch()}>Try again</Button>}</SectionPage>
  return <PacketEditor key={session?.metadata.id} catalog={catalog.data} />
}

function PacketEditor({ catalog }: { catalog: ExportCatalog }) {
  const [params] = useSearchParams()
  const initial: PacketPreset = ['start', 'caregiver', 'executor', 'spouse', 'custom'].includes(params.get('preset') ?? '') ? params.get('preset') as PacketPreset : 'start'
  const [preset, setPreset] = useState<PacketPreset>(initial)
  const [selection, setSelection] = useState<ExportSelection>(() => presetSelection(catalog, initial))
  const [recipient, setRecipient] = useState(''), [includePrivateLetters, setPrivate] = useState(false), [includeSensitive, setSensitive] = useState(false), [includeStartHere, setStart] = useState(true), [includeAccessPlan, setAccess] = useState(false)
  const [scenario, setScenario] = useState<'incapacity' | 'death'>(params.get('scenario') === 'death' ? 'death' : 'incapacity')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ html: string; token: string; signature: string } | null>(null)
  const session = useVaultStore((s) => s.session)
  const license = useQuery({ queryKey: ['license'], queryFn: () => unwrap(getEverkeepApi().license.getStatus()) })
  const paid = Boolean(license.data?.activated)
  const options: ExportOptions = { selection, recipient, includePrivateLetters, includeSensitive: paid && includeSensitive, includeStartHere, includeAccessPlan: includeStartHere && includeAccessPlan, scenario }
  const signature = JSON.stringify(options)
  const upToDate = preview?.signature === signature
  const count = selection.people.length + selection.accounts.length + selection.entries.length
  function toggle(group: keyof ExportSelection, id: string) { setSelection((s) => ({ ...s, [group]: s[group].includes(id) ? s[group].filter((x) => x !== id) : [...s[group], id] })) }
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to prepare the packet.') } finally { setBusy(false) } }
  return <SectionPage title="Prepare a packet" description="Start with a recipient, choose the records, then preview exactly what you will export." actions={<Link className="text-sm text-forest-700 underline" to="/backup">Backup & access check</Link>}>
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-warm-200 bg-ivory-50 p-5">
        <h2 className="font-display text-xl">1. Who is this for?</h2>
        <div className="flex flex-wrap gap-2">{([['start', 'Start here'], ['caregiver', 'Caregiver'], ['executor', 'Executor'], ['spouse', 'Spouse / partner'], ['custom', 'Choose myself']] as const).map(([id, label]) => <Button key={id} disabled={busy} variant={preset === id ? 'primary' : 'secondary'} onClick={() => { setPreset(id); setSelection(presetSelection(catalog, id)); setPrivate(false); setSensitive(false); setAccess(false); setPreview(null) }}>{label}</Button>)}</div>
        <label className="block text-sm">Recipient name (optional)<Input className="mt-1" value={recipient} onChange={(e) => setRecipient(e.target.value)} /></label>
        <p className="text-sm text-warm-500">These are starting selections, not access permissions. Review every included record before giving someone the report.</p>
      </section>
      <section className="space-y-4 rounded-xl border border-warm-200 bg-ivory-50 p-5">
        <h2 className="font-display text-xl">2. What should they receive?</h2>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={includeStartHere} onChange={(e) => setStart(e.target.checked)} />Include the Start here summary, including the two key contacts</label>
        {includeStartHere && <div className="space-y-3 border-l-2 border-warm-200 pl-4"><label className="block text-sm">Situation<select className="ml-2 rounded border border-warm-300 p-2" value={scenario} onChange={(e) => setScenario(e.target.value as typeof scenario)}><option value="incapacity">If I cannot help right now</option><option value="death">After my death</option></select></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={includeAccessPlan} onChange={(e) => setAccess(e.target.checked)} />Also include vault, backup, and access instructions</label><Link className="text-xs text-forest-700 underline" to="/start-here">Edit the Start here information</Link></div>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={includePrivateLetters} onChange={(e) => { setPrivate(e.target.checked); if (!e.target.checked) setSelection((s) => ({ ...s, entries: s.entries.filter((id) => !catalog.entries.find((e) => e.id === id)?.private) })) }} />Allow me to explicitly select private letters below</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" disabled={!paid} checked={paid && includeSensitive} onChange={(e) => setSensitive(e.target.checked)} />Include sensitive identifiers{!paid && ' (Lifetime)'}</label>
        <p className="text-xs text-warm-500">Other record text may still contain personal information. The preview is the final check; the exported HTML file is not encrypted.</p>
        {(['people', 'accounts', 'entries'] as const).map((group) => <details key={group} className="rounded-md border border-warm-200 p-3" open={group === 'entries'}><summary className="cursor-pointer text-sm font-medium">{group === 'people' ? 'Contacts' : group === 'accounts' ? 'Financial accounts' : 'Other records'} · {selection[group].length} selected</summary><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{catalog[group].length === 0 ? <p className="text-sm text-warm-500">No saved records in this group.</p> : catalog[group].map((item) => <label key={item.id} className="flex items-start gap-2 rounded p-1 text-sm"><input type="checkbox" className="mt-1" disabled={item.private && !includePrivateLetters} checked={selection[group].includes(item.id)} onChange={() => toggle(group, item.id)} /><span>{item.title}<span className="block text-xs text-warm-500">{SECTION_DEFINITIONS.find((s) => s.id === item.section)?.title ?? item.section}{item.private ? ' · Private letter' : ''}</span></span></label>)}</div></details>)}
      </section>
      <section className="space-y-3 rounded-xl border border-warm-200 bg-ivory-50 p-5"><h2 className="font-display text-xl">3. Preview and export</h2><p className="text-sm text-warm-500">{count} records selected{includeStartHere ? ' plus the Start here summary' : ''}. Attached files are not included in this packet.</p><div className="flex gap-3"><Button disabled={busy || (!count && !includeStartHere)} onClick={() => void run(async () => { const result = await unwrap(getEverkeepApi().vault.previewReport(options)); setPreview({ ...result, signature }) })}>{busy ? 'Working…' : 'Preview packet'}</Button><Button variant="secondary" disabled={busy || !upToDate} onClick={() => void run(async () => { if (!preview) return; const destinationPath = await unwrap(getEverkeepApi().vault.pickExportPath(`${session?.metadata.name ?? 'Vault'}-${preset}`)); if (!destinationPath) return; const result = await unwrap(getEverkeepApi().vault.exportReport({ ...options, destinationPath, previewToken: preview.token })); setMessage(`Packet saved: ${result.path}. Open it in a browser to print or save as PDF.`) })}>Export this preview</Button></div>{preview && !upToDate && <p role="status" className="text-sm text-warm-500">Selections changed. Preview again before exporting.</p>}{preview && upToDate && <iframe title="Exact export preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html} className="h-[600px] w-full rounded-md border border-warm-300 bg-white" />}</section>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}{message && <p role="status" className="break-all text-sm text-forest-700">{message}</p>}
    </div>
  </SectionPage>
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SharedRecord, SharedVaultSummary, SharedVaultView, SharingAccount as Account, SharingClient } from '../shared/sharing'
import { SharingAccount, message } from './SharingAccount'
import { SharingControls } from './SharingControls'
import './sharing.css'
import { SensitiveValue } from './SensitiveValue'
import { RecipientVault } from './RecipientVault'
const accessLost = (error: unknown) => /\[(401|403)\]/.test(message(error))
export function SharedVaultApp({ client, initialVaultId, desktop = false, onEditingChange, onViewChange }: { client: SharingClient; initialVaultId?: string; desktop?: boolean; onEditingChange?: (dirty: boolean, busy: boolean) => void; onViewChange?: (opened: boolean) => void }) {
  const [account, setAccount] = useState<Account | null>(null), [vaults, setVaults] = useState<SharedVaultSummary[]>([]), [view, setView] = useState<SharedVaultView | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [url, setUrl] = useState('')
  const [editing, setEditing] = useState<SharedRecord | null>(null), [values, setValues] = useState<Record<string, string>>({}), [changed, setChanged] = useState(false), [conflicting, setConflicting] = useState<SharedRecord | null>(null), [notice, setNotice] = useState('')
  const [managing, setManaging] = useState(false)
  const initialHandled = useRef<string | null>(null)
  const active = useRef<string | null>(null), generation = useRef(0), heading = useRef<HTMLHeadingElement>(null)
  const accountChanged = useCallback((next: Account | null) => { generation.current++; active.current = null; initialHandled.current = null; setView(null); setEditing(null); setChanged(false); setValues({}); setConflicting(null); setError(''); setNotice(''); setManaging(false); setVaults([]); setAccount(next) }, [])
  const reload = useCallback(async () => { const gen = generation.current; const result = await client.list(); if (gen === generation.current) setVaults(result) }, [client])
  useEffect(() => { if (!account) return; setLoading(true); reload().catch(error => setError(message(error))).finally(() => setLoading(false)); client.status().then(status => setUrl(status.url)).catch(() => {}); }, [account, client, reload])
  useEffect(() => {
    if (!account) return
    const tick = async () => {
      const id = active.current, gen = generation.current
      try { if (id) { const next = await client.get(id); if (gen === generation.current && active.current === id) { setView(next); if (next.role === 'viewer' || (editing && !next.records.some(record => record.id === editing.id))) { setEditing(null); setChanged(false); setValues({}); setConflicting(null) } } } else await reload() }
      catch (error) { if (gen !== generation.current || active.current !== id) return; if (accessLost(error)) { setView(null); setEditing(null); setValues({}); setChanged(false); active.current = null }; setError(accessLost(error) ? message(error) : `${message(error)} The last successful update remains in view while disconnected.`) }
    }
    const timer = setInterval(() => void tick(), 15000)
    return () => clearInterval(timer)
  }, [account, client, reload, editing])
  useEffect(() => { if (!changed) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [changed])
  const open = useCallback(async (id: string) => { setBusy(true); setError(''); initialHandled.current = id; const gen = generation.current; try { const next = await client.get(id); if (gen !== generation.current) return; if (active.current !== id) setManaging(false); active.current = id; setView(next); setEditing(null); requestAnimationFrame(() => heading.current?.focus()) } catch (error) { setError(message(error)) } finally { setBusy(false) } }, [client])
  useEffect(() => { if (initialVaultId && initialHandled.current !== initialVaultId && vaults.some(vault => vault.id === initialVaultId && vault.status === 'active') && !active.current) void open(initialVaultId) }, [initialVaultId, vaults, open])
  useEffect(() => { onEditingChange?.(changed, busy) }, [changed, busy, onEditingChange])
  useEffect(() => { onViewChange?.(Boolean(view && (view.storage !== 'file' || view.records.length))); }, [view, onViewChange])
  function cancel() { if (busy || (changed && !window.confirm('Discard your unsaved changes?'))) return; setEditing(null); setValues({}); setChanged(false); setConflicting(null); requestAnimationFrame(() => heading.current?.focus()) }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!editing || !view) return
    setBusy(true); setError(''); const gen = generation.current
    try {
      await client.edit(view.id, editing.id, { baseVersion: editing.version, values: Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== editing.fields[key].value)) })
      if (gen !== generation.current) return
      setChanged(false); setEditing(null); setConflicting(null); setNotice(view.storage === 'file' ? 'Changes kept in this session. Save an updated Everkeep file to keep them.' : 'Changes saved to the shared vault.'); await open(view.id)
    } catch (error) {
      if (gen !== generation.current) return
      setError(message(error))
      try { const latest = await client.get(view.id); const record = latest.records.find(record => record.id === editing.id); if (gen === generation.current) { setView(latest); if (!record || latest.role === 'viewer') { setEditing(null); setValues({}); setChanged(false); setConflicting(null) } else if (record.version !== editing.version) setConflicting(record) } } catch (refreshError) { if (accessLost(refreshError)) { setView(null); setEditing(null); setValues({}); setChanged(false); active.current = null } }
    } finally { setBusy(false) }
  }
  return <main className="ek-sharing">
    {!view && <><h1 ref={heading} tabIndex={-1}>Shared vaults</h1><p>Open the words and information someone has shared with you.</p></>}
    <details className="ek-session-tools" open={!view} hidden={Boolean(editing)}><summary hidden={!view}>Vault options</summary>
    <div className={view ? 'ek-account-utility' : undefined}><SharingAccount client={client} onChange={accountChanged} /></div>
      {view && <div className="ek-vault-utility"><div className="ek-row ek-between"><button onClick={() => { active.current = null; setView(null); setNotice(''); setManaging(false); void reload().catch(error => setError(message(error))) }}>Back to vaults</button><div className="ek-row">{view.role === 'owner' && <button aria-expanded={managing} onClick={() => setManaging(!managing)}>{managing ? 'Return to welcome' : 'Manage access'}</button>}{!desktop && <a className="ek-button" href={`everkeep://shared/${view.id}`}>Open in Everkeep</a>}</div></div><details><summary>About this shared vault · {view.role === 'owner' ? 'Owner' : view.role === 'collaborator' ? 'Editing enabled' : 'View only'}</summary><p className="ek-muted">{view.updatedAt ? `Updated ${new Date(view.updatedAt).toLocaleString()}. ` : ''}{view.storage === 'file' ? 'This file copy does not synchronize automatically. Save an updated file to keep your edits.' : 'This is the latest synchronized information. Changes made offline appear after the original vault reconnects.'}</p></details></div>}
    </details>
    {error && <p role="alert" className="ek-error">{error}</p>}{notice && <p role="status" className="ek-success">{notice}</p>}
    {account && !view && <>{loading && <p role="status">Loading vaults…</p>}{['owner', 'shared'].map(group => <section className="ek-card" key={group}><h2>{group === 'owner' ? 'My vaults' : 'Shared with me'}</h2>{!loading && !vaults.some(vault => (vault.role === 'owner') === (group === 'owner')) && <p>{group === 'owner' ? 'Register your vault from Review in the Everkeep app to share a file or enable hosted access.' : 'No invitations for this email address yet.'}</p>}{vaults.filter(vault => (vault.role === 'owner') === (group === 'owner')).map(vault => <div className="ek-card" key={vault.id}><h3>{vault.name}</h3><p>{vault.role === 'owner' ? 'You own this shared vault' : vault.role === 'collaborator' ? 'You can edit shared information' : 'View only'}{vault.status === 'pending' ? ' · Invitation pending' : ''}</p><button className="primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { if (vault.status === 'pending') await client.accept(vault.id); await open(vault.id); await reload() } catch (error) { setError(message(error)) } finally { setBusy(false) } }}>{vault.status === 'pending' ? 'Accept invitation and open' : 'Open vault'}</button></div>)}</section>)}<button disabled={busy} onClick={() => void reload().catch(error => setError(message(error)))}>Refresh invitations</button></>}
    {view && <>

      {editing && <form className="ek-card" onSubmit={save}><h2>Edit {editing.title}</h2><p>Changes are attributed to {account?.email}. Structured relationships are managed in the original vault.</p>
        {conflicting && <div className="ek-error"><h3>This record changed while you were editing</h3><p>Your entries are still below. Compare them with the latest version before saving again.</p><dl>{Object.entries(conflicting.fields).filter(([key, field]) => field.value !== editing.fields[key]?.value).map(([key, field]) => <div key={key}><dt>{field.label} — latest</dt><dd>{field.sensitive ? <SensitiveValue value={field.value} /> : field.value || 'Empty'}</dd></div>)}</dl><button type="button" onClick={() => { setValues(previous => Object.fromEntries(Object.entries(conflicting.fields).filter(([, field]) => field.editable).map(([key, field]) => [key, previous[key] !== editing.fields[key]?.value ? previous[key] : field.value]))); setEditing(conflicting); setConflicting(null); setError(''); setNotice('Latest version reviewed. Your entries remain below; Save will apply your changes to that version.') }}>I reviewed these changes; keep my entries</button></div>}
        {Object.entries(editing.fields).filter(([, field]) => field.editable).map(([key, field], index) => <label key={key}><span>{field.label}</span>{field.options ? <select value={values[key] ?? ''} onChange={event => { setValues({ ...values, [key]: event.target.value }); setChanged(true) }}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.sensitive ? <input type="password" autoComplete="off" required={field.required} maxLength={field.maxLength} value={values[key] ?? ''} onChange={event => { setValues({ ...values, [key]: event.target.value }); setChanged(true) }} /> : <textarea autoFocus={index === 0} required={field.required} maxLength={field.maxLength} rows={(values[key]?.length ?? 0) > 150 ? 5 : 2} value={values[key] ?? ''} onChange={event => { setValues({ ...values, [key]: event.target.value }); setChanged(true) }} />}</label>)}
        <div className="ek-actions"><button className="primary" disabled={busy || Boolean(conflicting)}>{busy ? 'Saving…' : 'Save changes'}</button><button type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
      </form>}
      <div hidden={Boolean(editing) || managing}>
        <RecipientVault key={`${account?.id}:${view.id}`} view={view} busy={busy} active={!editing && !managing}
          onAttachment={(record, fileId) => { const gen = generation.current; void client.attachment(view.id, record.id, fileId).catch(error => { if (gen !== generation.current) return; if (accessLost(error)) { setView(null); setEditing(null); setValues({}); setConflicting(null); setChanged(false); active.current = null }; setError(message(error)) }) }}
          onEdit={record => { setEditing(record); setValues(Object.fromEntries(Object.entries(record.fields).filter(([, field]) => field.editable).map(([key, field]) => [key, field.value]))); setChanged(false); setConflicting(null); setError(''); setNotice('') }} />
      </div>
      {managing && !editing && view.role === 'owner' && account && <SharingControls client={client} id={view.id} snapshot={view} storage={view.storage} owner={account.email} url={url} />}
    </>}
  </main>
}

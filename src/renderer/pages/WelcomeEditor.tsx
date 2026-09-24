import { useEffect, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import type { SharedSnapshot } from '@shared/sharing'
import type { FamilyHandoff } from '@shared/types/handoff'
import { isLetter, recordOrder } from '@shared/recipient'

type Welcome = Pick<FamilyHandoff, 'welcomeMessage' | 'welcomeSignature' | 'featuredLetterId'>
const pickWelcome = (plan: FamilyHandoff): Welcome => ({ welcomeMessage: plan.welcomeMessage, welcomeSignature: plan.welcomeSignature, featuredLetterId: plan.featuredLetterId })
export function WelcomeEditor({ snapshot, onSaved }: { snapshot: SharedSnapshot | null; onSaved: () => Promise<void> }) {
  const [saved, setSaved] = useState<Welcome | null>(null), [form, setForm] = useState<Welcome | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const cache = useQueryClient()
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const blocker = useBlocker(dirty || busy)
  useEffect(() => { if (blocker.state === 'blocked') { if (!busy && window.confirm('Discard your unsaved welcome changes?')) blocker.proceed(); else blocker.reset() } }, [blocker, busy])
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  useEffect(() => { let live = true; unwrap(getEverkeepApi().vault.getHandoff()).then(plan => { if (live) { setSaved(pickWelcome(plan)); setForm(pickWelcome(plan)) } }).catch(error => { if (live) setError(error.message) }); return () => { live = false } }, [])
  const letters = snapshot?.records.filter(isLetter).sort(recordOrder) ?? []
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!form) return
    setBusy(true); setError(''); setNotice('')
    try {
      const latest = await unwrap(getEverkeepApi().vault.getHandoff())
      const next = await unwrap(getEverkeepApi().vault.updateHandoff({ ...latest, ...form }))
      setSaved(pickWelcome(next)); setForm(pickWelcome(next)); await cache.invalidateQueries({ queryKey: ['handoff'] }); await onSaved()
      setNotice('Welcome saved. Online recipients see it after synchronization; file recipients need a newly saved shared file.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save the welcome.') } finally { setBusy(false) }
  }
  return <section className="ek-card"><h2>Welcome your recipients</h2><p>Begin with a few words in your own voice. This welcome is the same for everyone you share it with.</p><p className="ek-muted">The welcome is part of “Starting information and access instructions.” Sharing it includes that entire record, including its access instructions. Choosing a letter here does not give anyone access to it.</p>
    {error && <p role="alert" className="ek-error">{error}</p>}
    {!form ? <p role="status">{error ? 'Reopen this page to try loading the welcome again.' : 'Loading welcome…'}</p> : <form onSubmit={event => void save(event)}>
      <label><span>Welcome message (optional)</span><textarea rows={5} maxLength={20000} disabled={busy} value={form.welcomeMessage} onChange={event => setForm({ ...form, welcomeMessage: event.target.value })} placeholder="What would you like someone to read when they arrive?" /></label>
      <label><span>Signature or display name (optional)</span><input maxLength={200} disabled={busy} value={form.welcomeSignature} onChange={event => setForm({ ...form, welcomeSignature: event.target.value })} /></label>
      <label><span>Featured letter (optional)</span><select disabled={busy} value={form.featuredLetterId} onChange={event => setForm({ ...form, featuredLetterId: event.target.value })}><option value="">Choose automatically from shared letters</option>{form.featuredLetterId && !letters.some(letter => letter.id === form.featuredLetterId) && <option value={form.featuredLetterId}>Letter no longer available — choose another</option>}{letters.map(letter => <option key={letter.id} value={letter.id}>{letter.title}</option>)}</select></label>
      {!letters.length && <p><Link to="/letters">Write a letter or personal message</Link></p>}
      <p className="ek-muted">If your chosen letter is unavailable to a recipient, their welcome uses another letter they can access. Save your changes, then use “Preview recipient experience” in the sharing controls below.</p>
      <div className="ek-row"><button className="primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save welcome'}</button>{dirty && <button type="button" disabled={busy} onClick={() => { setForm(saved); setError(''); setNotice('') }}>Cancel changes</button>}</div>
      {notice && !dirty && <p role="status" className="ek-success">{notice}</p>}
    </form>}
  </section>
}

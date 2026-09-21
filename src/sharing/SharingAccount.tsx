import { useEffect, useState } from 'react'
import type { SharingAccount as Account, SharingClient } from '../shared/sharing'
export const message = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Unable to complete this request.'
export function SharingAccount({ client, onChange }: { client: SharingClient; onChange: (account: Account | null) => void }) {
  const [account, setAccount] = useState<Account | null>(null), [ready, setReady] = useState(false), [configured, setConfigured] = useState(true)
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [challenge, setChallenge] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { let live = true; client.status().then(status => { if (live) { setAccount(status.account); setConfigured(status.configured); onChange(status.account) } }).catch(error => { if (live) setError(message(error)) }).finally(() => { if (live) setReady(true) }); return () => { live = false } }, [client, onChange])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (!challenge) setChallenge((await client.requestCode(email)).challengeId)
      else { const next = await client.verifyCode(challenge, email, code); setAccount(next); onChange(next); setCode(''); setChallenge('') }
    } catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  if (!ready) return <p role="status">Checking your sharing account…</p>
  if (!configured) return <div className="ek-card" style={account ? { padding: '10px 16px' } : undefined}><h2>Online sharing needs to be connected</h2><p>This build has no sharing service configured. Your vault remains saved on this computer. You can still save an Everkeep file or export a readable copy below.</p></div>
  return <div className="ek-card" style={account ? { padding: '10px 16px' } : undefined}>
    {error && <p className="ek-error" role="alert">{error}</p>}
    {account ? <div className="ek-row ek-between"><p>Signed in as <strong>{account.email}</strong></p><button disabled={busy} onClick={async () => { setBusy(true); try { await client.logout() } catch (error) { setError(message(error)) } finally { setAccount(null); onChange(null); setBusy(false) } }}>Sign out</button></div> : <form onSubmit={submit}>
      <h2>Verify your email</h2><p className="ek-muted">Your account identifies which vaults you own and which have been shared with you. It is separate from the person described in a vault.</p>
      <label><span>Email address</span><input type="email" required autoComplete="email" value={email} disabled={busy || Boolean(challenge)} onChange={event => setEmail(event.target.value)} /></label>
      {challenge && <label><span>Six-digit code sent to {email}</span><input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} /></label>}
      <div className="ek-row"><button className="primary" disabled={busy}>{busy ? 'Please wait…' : challenge ? 'Verify and continue' : 'Email me a sign-in code'}</button>{challenge && <button type="button" disabled={busy} onClick={() => { setChallenge(''); setCode('') }}>Use another email or resend</button>}</div>
    </form>}
  </div>
}

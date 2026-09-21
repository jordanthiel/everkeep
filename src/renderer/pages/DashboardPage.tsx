import { useVaultStore } from '@renderer/state/vaultStore'
import { useNavigate } from 'react-router-dom'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useState } from 'react'
import { JourneyOverview } from '@renderer/components/layout/Journey'

export function DashboardPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const setSession = useVaultStore((s) => s.setSession)
  const session = useVaultStore((s) => s.session)
  const name = session?.metadata.ownerPreferredName || session?.metadata.ownerFirstName || 'there'
  return <div>
    <header className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-widest text-brass-500">Your plan</p>
      <h1 className="mt-2 font-display text-4xl text-charcoal-900">Welcome, {name}</h1>
      <p className="mt-3 text-lg text-warm-500">Make things easier for the people you trust, one topic at a time.</p>
    </header>
    {session?.metadata.isPasswordProtected && <Button className="mb-5" variant="secondary" onClick={async () => {
      try { setSession(await unwrap(getEverkeepApi().vault.lock())); navigate('/unlock') }
      catch { setError('Unable to lock the vault. Please try again.') }
    }}>Lock vault</Button>}
    {error && <p role="alert" className="mb-4 text-red-800">{error}</p>}
    <JourneyOverview />
  </div>
}

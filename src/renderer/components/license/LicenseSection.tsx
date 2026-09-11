import { useEffect, useState } from 'react'
import { BadgeCheck, KeyRound } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import type { LicenseState } from '@shared/types/license'

export function LicenseSection() {
  const [status, setStatus] = useState<LicenseState | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void unwrap(getEverkeepApi().license.getStatus())
      .then(setStatus)
      .catch(() => {})
  }, [])

  async function handleActivate() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await unwrap(getEverkeepApi().license.activate(key))
      setStatus(updated)
      setKey('')
      setMessage('Everkeep is activated. Thank you for supporting independent software.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await unwrap(getEverkeepApi().license.deactivate())
      const updated = await unwrap(getEverkeepApi().license.getStatus())
      setStatus(updated)
      setMessage('License removed. This copy is now running as a free trial.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove license.')
    } finally {
      setBusy(false)
    }
  }

  async function handleBuy() {
    try {
      await unwrap(getEverkeepApi().license.openPurchasePage())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the purchase page.')
    }
  }

  const licensed = status?.state === 'licensed'

  return (
    <section className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
      <h2 className="font-medium text-charcoal-900">License</h2>
      {status == null ? (
        <p className="mt-2 text-sm text-warm-500">Checking license…</p>
      ) : licensed ? (
        <div>
          <p className="mt-3 flex items-center gap-2 text-sm text-forest-700">
            <BadgeCheck className="h-4 w-4" />
            Licensed to {status.email}
          </p>
          <p className="mt-2 text-sm text-warm-500">
            One purchase covers your whole household, forever. No subscription, no renewals.
          </p>
          <Button variant="ghost" className="mt-4" onClick={() => void handleDeactivate()} disabled={busy}>
            Remove license
          </Button>
        </div>
      ) : (
        <div>
          <p className="mt-2 text-sm text-warm-500">
            You&apos;re using the free trial — everything works except exporting reports. Buy once
            and Everkeep is yours forever.
          </p>
          <div className="mt-4">
            <Label htmlFor="licenseKey">License key</Label>
            <div className="mt-1 flex flex-col gap-3 sm:flex-row">
              <Input
                id="licenseKey"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="EK1.…"
                autoComplete="off"
                spellCheck={false}
              />
              <Button onClick={() => void handleActivate()} disabled={busy || key.trim().length === 0}>
                <KeyRound className="h-4 w-4" />
                {busy ? 'Activating…' : 'Activate'}
              </Button>
            </div>
          </div>
          <Button variant="secondary" className="mt-4" onClick={() => void handleBuy()}>
            Buy Everkeep — $79 one-time
          </Button>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-forest-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
    </section>
  )
}

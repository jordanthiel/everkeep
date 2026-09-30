import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'
import { SharingAccount } from '../../../sharing/SharingAccount'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { Button } from '../ui/Button'
import { LIFETIME_PRICE_USD } from '@shared/constants'
import type { LicenseStatus } from '@shared/types/license'
import '../../../sharing/sharing.css'

export function AccountPurchasePanel({ onActivated }: { onActivated?: (status: LicenseStatus) => void }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const callback = useRef(onActivated)
  callback.current = onActivated
  const queries = useQueryClient()
  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const next = await unwrap(getEverkeepApi().license.getStatus())
      setStatus(next)
      setError(next.verificationError ?? '')
      queries.setQueryData(['license'], next)
      if (next.activated) callback.current?.(next)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to check your purchase.') }
    finally { setBusy(false) }
  }, [queries])
  const accountChanged = useCallback(() => { void refresh() }, [refresh])
  useEffect(() => {
    const focus = () => { void refresh() }
    window.addEventListener('focus', focus)
    const timer = setInterval(focus, 15000)
    return () => { window.removeEventListener('focus', focus); clearInterval(timer) }
  }, [refresh])
  async function buy() {
    setBusy(true); setError('')
    try { await unwrap(getEverkeepApi().license.openCheckout()) }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to open checkout.') }
    finally { setBusy(false) }
  }
  return <div>
    <p className="mt-3 text-sm text-warm-500">Lifetime belongs to your email account. Sign in with the email used at checkout to restore your purchase on this computer. No license key is needed.</p>
    <div className="ek-sharing" style={{ padding: 0 }}>
      <SharingAccount client={getEverkeepApi().sharing} onChange={accountChanged} billing />
    </div>
    <p className="mt-3 text-sm" role="status">{status?.activated ? `Lifetime active for ${status.email}` : status?.email ? `Free plan · ${status.email}` : 'Sign in to check your purchase.'}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      {!status?.activated && <Button disabled={busy || !status?.email || Boolean(error)} onClick={() => void buy()}><ShoppingCart className="h-4 w-4" />Buy Lifetime — ${status?.lifetimePriceUsd ?? LIFETIME_PRICE_USD}</Button>}
      <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>{busy ? 'Checking…' : 'Restore purchase / Check again'}</Button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {!status?.activated && status?.email && !error && <p className="mt-3 text-xs text-warm-500">Already paid? Use the same email as your Stripe receipt. Payment confirmation can take a moment; check again after checkout.</p>}
  </div>
}

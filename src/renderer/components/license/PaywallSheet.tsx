import { useEffect, useState } from 'react'
import { KeyRound, ShoppingCart } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { ApiError, getEverkeepApi, unwrap } from '@renderer/lib/api'
import { FREE_ATTACHMENT_CAP, FREE_ENTRY_CAP, LIFETIME_PRICE_USD } from '@shared/constants'
import type { LicenseStatus } from '@shared/types/license'

interface PaywallSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  message?: string
  onActivated?: (status: LicenseStatus) => void
}

export function PaywallSheet({
  open,
  onClose,
  title = 'Upgrade to Everkeep Lifetime',
  message = `Free Everkeep includes up to ${FREE_ENTRY_CAP} entries and ${FREE_ATTACHMENT_CAP} attachments. Your vault stays on this computer and remains readable forever.`,
  onActivated
}: PaywallSheetProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    void unwrap(getEverkeepApi().license.getStatus())
      .then(setStatus)
      .catch(() => {})
  }, [open])

  if (!open) return null

  const price = status?.lifetimePriceUsd ?? LIFETIME_PRICE_USD

  async function handleBuy() {
    setError(null)
    try {
      await unwrap(getEverkeepApi().license.openCheckout())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open checkout.')
    }
  }

  async function handleActivateKey() {
    setBusy(true)
    setError(null)
    try {
      const next = await unwrap(getEverkeepApi().license.activateKey(licenseKey))
      setStatus(next)
      onActivated?.(next)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to activate license.')
    } finally {
      setBusy(false)
    }
  }

  async function handleActivateFile() {
    setBusy(true)
    setError(null)
    try {
      const next = await unwrap(getEverkeepApi().license.activateFile())
      if (!next) return
      setStatus(next)
      onActivated?.(next)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to activate license file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-900/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="w-full max-w-lg rounded-xl border border-warm-200 bg-ivory-50 p-5 shadow-soft"
      >
        <h2 id="paywall-title" className="font-medium text-charcoal-900">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-warm-500">{message}</p>
        <p className="mt-3 text-sm text-charcoal-800">
          Lifetime is a one-time ${price} payment — unlimited entries and attachments, clean exports,
          and no recurring charge.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => void handleBuy()}>
            <ShoppingCart className="h-4 w-4" />
            Buy Lifetime — ${price}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Maybe later
          </Button>
        </div>

        <div className="mt-6 border-t border-warm-200 pt-5">
          <Label htmlFor="paywall-license-key">Already purchased? Paste your license key</Label>
          <Input
            id="paywall-license-key"
            className="mt-2 font-mono text-xs"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="ek1...."
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={busy || !licenseKey.trim()}
              onClick={() => void handleActivateKey()}
            >
              <KeyRound className="h-4 w-4" />
              Activate key
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void handleActivateFile()}>
              Activate from file
            </Button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
      </div>
    </div>
  )
}

export function isFreemiumLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'FREEMIUM_LIMIT'
}

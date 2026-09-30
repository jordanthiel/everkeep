import { Button } from '@renderer/components/ui/Button'
import { ApiError } from '@renderer/lib/api'
import { FREE_ATTACHMENT_CAP, FREE_ENTRY_CAP, LIFETIME_PRICE_USD } from '@shared/constants'
import type { LicenseStatus } from '@shared/types/license'
import { AccountPurchasePanel } from './AccountPurchasePanel'

interface PaywallSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  message?: string
  onActivated?: (status: LicenseStatus) => void
}

export function PaywallSheet({ open, onClose, title = 'Upgrade to Everkeep Lifetime', message = `Free Everkeep includes up to ${FREE_ENTRY_CAP} entries and ${FREE_ATTACHMENT_CAP} attachments.`, onActivated }: PaywallSheetProps) {
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-900/40 p-4 sm:items-center">
    <div role="dialog" aria-modal="true" aria-labelledby="paywall-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-warm-200 bg-ivory-50 p-5 shadow-soft">
      <h2 id="paywall-title" className="font-medium text-charcoal-900">{title}</h2>
      <p className="mt-2 text-sm text-warm-500">{message}</p>
      <p className="mt-3 text-sm">Lifetime is a one-time ${LIFETIME_PRICE_USD} payment for unlimited entries and attachments and clean exports.</p>
      <AccountPurchasePanel onActivated={status => { onActivated?.(status); onClose() }} />
      <Button className="mt-4" variant="ghost" onClick={onClose}>Close</Button>
    </div>
  </div>
}

export function isFreemiumLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'FREEMIUM_LIMIT'
}

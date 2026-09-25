import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import type { AppUpdateStatus } from '@shared/types/appUpdate'

export function UpdateBanner() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const api = getEverkeepApi()
    const unsubscribe = api.updates.onStatus(setStatus)
    void unwrap(api.updates.getStatus())
      .then(setStatus)
      .catch(() => {})
    return unsubscribe
  }, [])

  if (!status) return null

  const versionKey = status.availableVersion ?? ''
  const visible =
    (status.state === 'available' ||
      status.state === 'downloading' ||
      status.state === 'ready') &&
    dismissedVersion !== versionKey

  if (!visible) return null

  async function download() {
    setBusy(true)
    try {
      await unwrap(getEverkeepApi().updates.download())
    } finally {
      setBusy(false)
    }
  }

  async function install() {
    setBusy(true)
    try {
      await unwrap(getEverkeepApi().updates.install())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start the update installer.'
      setStatus(current => current ? { ...current, message } : current)
    } finally {
      setBusy(false)
    }
  }

  async function openReleasePage() {
    await unwrap(getEverkeepApi().updates.openReleasePage())
  }

  const title =
    status.state === 'ready'
      ? `Everkeep ${status.availableVersion} is ready to install`
      : status.state === 'downloading'
        ? `Downloading Everkeep ${status.availableVersion ?? ''}…`
        : `Everkeep ${status.availableVersion} is available`

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-forest-600/20 bg-ivory-50 p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-charcoal-900">{title}</p>
            <p className="mt-1 text-xs text-warm-500">
              {status.message || (status.state === 'ready'
                ? 'Your vault file stays where it is. Restart when you are ready.'
                : 'You can download it now, or get it from the releases page.')}
            </p>
            {status.state === 'downloading' && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-warm-200">
                <div
                  className="h-full rounded-full bg-forest-600 transition-all"
                  style={{ width: `${status.downloadPercent ?? 0}%` }}
                />
              </div>
            )}
          </div>
          {status.state !== 'downloading' && (
            <button
              type="button"
              className="rounded-md p-1 text-warm-400 hover:bg-warm-100 hover:text-charcoal-800"
              onClick={() => setDismissedVersion(versionKey)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {status.state === 'available' && (
            <>
              <Button size="sm" disabled={busy} onClick={() => void download()}>
                <Download className="h-3.5 w-3.5" />
                {busy ? 'Starting…' : 'Download update'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void openReleasePage()}>
                Releases page
              </Button>
            </>
          )}
          {status.state === 'ready' && (
            <>
              <Button size="sm" disabled={busy} onClick={() => void install()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Restart to update
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void openReleasePage()}>
                Releases page
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, KeyRound, RefreshCw, ShoppingCart } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { ApiError, getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import {
  FREE_ATTACHMENT_CAP,
  FREE_ENTRY_CAP,
  LEGAL_DISCLAIMER,
  LIFETIME_PRICE_USD
} from '@shared/constants'
import type { AppUpdateStatus } from '@shared/types/appUpdate'
import type { LicenseStatus } from '@shared/types/license'

export function SettingsPage() {
  const navigate = useNavigate()
  const session = useVaultStore((s) => s.session)
  const setSession = useVaultStore((s) => s.setSession)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseBusy, setLicenseBusy] = useState(false)
  const [licenseMessage, setLicenseMessage] = useState<string | null>(null)
  const [licenseError, setLicenseError] = useState<string | null>(null)

  useEffect(() => {
    const api = getEverkeepApi()
    const unsubscribe = api.updates.onStatus(setUpdateStatus)
    void unwrap(api.updates.getStatus())
      .then(setUpdateStatus)
      .catch(() => {})
    void unwrap(api.license.getStatus())
      .then(setLicenseStatus)
      .catch(() => {})
    return unsubscribe
  }, [])

  async function handleSaveCopy() {
    if (!session) return
    setError(null)
    setMessage(null)
    try {
      const path = await getEverkeepApi().sharing.saveCopy()
      if (path) setMessage(`Everkeep file saved at ${path}. Your original file remains open.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the file.')
    }
  }

  async function handleLock() {
    setError(null)
    try {
      const locked = await unwrap(getEverkeepApi().vault.lock())
      setSession(locked)
      navigate('/unlock')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to lock vault.')
    }
  }

  async function handleEnablePassword() {
    setError(null)
    setMessage(null)
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    try {
      const updated = await unwrap(getEverkeepApi().vault.enablePassword(newPassword))
      setSession(updated)
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password protection enabled. Your vault and stored attachments are now encrypted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enable password.')
    }
  }

  async function handleClose() {
    setError(null)
    try {
      await unwrap(getEverkeepApi().vault.close())
      setSession(null)
      navigate('/welcome')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to close vault.')
    }
  }

  async function handleCheckForUpdate() {
    setUpdateBusy(true)
    try {
      await unwrap(getEverkeepApi().updates.check())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check for updates.')
    } finally {
      setUpdateBusy(false)
    }
  }

  async function handleDownloadUpdate() {
    setUpdateBusy(true)
    try {
      await unwrap(getEverkeepApi().updates.download())
    } finally {
      setUpdateBusy(false)
    }
  }

  async function handleInstallUpdate() {
    setUpdateBusy(true)
    try {
      await unwrap(getEverkeepApi().updates.install())
    } finally {
      setUpdateBusy(false)
    }
  }

  async function handleBuyLicense() {
    setLicenseError(null)
    try {
      await unwrap(getEverkeepApi().license.openCheckout())
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : 'Unable to open checkout.')
    }
  }

  async function handleActivateLicenseKey() {
    setLicenseBusy(true)
    setLicenseError(null)
    setLicenseMessage(null)
    try {
      const status = await unwrap(getEverkeepApi().license.activateKey(licenseKey))
      setLicenseStatus(status)
      setLicenseKey('')
      setLicenseMessage('Lifetime license activated.')
    } catch (err) {
      setLicenseError(err instanceof ApiError ? err.message : 'Unable to activate license.')
    } finally {
      setLicenseBusy(false)
    }
  }

  async function handleActivateLicenseFile() {
    setLicenseBusy(true)
    setLicenseError(null)
    setLicenseMessage(null)
    try {
      const status = await unwrap(getEverkeepApi().license.activateFile())
      if (!status) return
      setLicenseStatus(status)
      setLicenseMessage('Lifetime license activated from file.')
    } catch (err) {
      setLicenseError(err instanceof ApiError ? err.message : 'Unable to activate license file.')
    } finally {
      setLicenseBusy(false)
    }
  }

  async function handleDeactivateLicense() {
    setLicenseBusy(true)
    setLicenseError(null)
    setLicenseMessage(null)
    try {
      const status = await unwrap(getEverkeepApi().license.deactivate())
      setLicenseStatus(status)
      setLicenseMessage('License deactivated on this computer. Your vault remains readable.')
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : 'Unable to deactivate license.')
    } finally {
      setLicenseBusy(false)
    }
  }

  const licenseLabel =
    licenseStatus?.entitlement === 'lifetime' || licenseStatus?.entitlement === 'family'
      ? 'Lifetime'
      : 'Free'
  const price = licenseStatus?.lifetimePriceUsd ?? LIFETIME_PRICE_USD

  return (
    <SectionPage
      title="Settings"
      description="Saved file location, copies, and product information."
      badge="Preferences"
    >
      <div className="space-y-5">
        <section className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">Current Vault</h2>
          {session ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-warm-500">Name</dt>
                <dd>{session.metadata.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-warm-500">Location</dt>
                <dd className="max-w-md break-all text-right">{session.filePath}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-warm-500">Password protected</dt>
                <dd>{session.metadata.isPasswordProtected ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-warm-500">No vault open.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void handleSaveCopy()} disabled={!session}>
              Save an Everkeep file
            </Button>
            {session?.metadata.isPasswordProtected && (
              <Button variant="secondary" onClick={() => void handleLock()}>
                Lock Vault
              </Button>
            )}
            <Button variant="ghost" onClick={() => void handleClose()} disabled={!session}>
              Close Vault
            </Button>
          </div>
          {message && <p className="mt-3 text-sm text-forest-700">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
        </section>

        {session && !session.metadata.isPasswordProtected && (
          <section className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
            <h2 className="font-medium text-charcoal-900">Add password protection</h2>
            <p className="mt-2 text-sm text-warm-500">
              Protect the entire vault and its stored attachments with a password. The password is never sent anywhere and cannot be recovered if forgotten.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <Button className="mt-4" onClick={() => void handleEnablePassword()}>
              Protect vault
            </Button>
          </section>
        )}

        <section className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">License</h2>
          <p className="mt-2 text-sm text-warm-500">
            Free Everkeep includes up to {FREE_ENTRY_CAP} entries and {FREE_ATTACHMENT_CAP}{' '}
            attachments. Lifetime unlocks unlimited entries, attachments, and clean exports for a
            one-time ${price}. Your vault stays on this computer and remains readable forever.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-warm-500">Status</dt>
              <dd>{licenseLabel}</dd>
            </div>
            {licenseStatus?.email && (
              <div className="flex justify-between gap-4">
                <dt className="text-warm-500">Licensed to</dt>
                <dd>{licenseStatus.email}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-3">
            {!licenseStatus?.activated && (
              <Button onClick={() => void handleBuyLicense()}>
                <ShoppingCart className="h-4 w-4" />
                Buy Lifetime — ${price}
              </Button>
            )}
            {licenseStatus?.activated && (
              <Button
                variant="ghost"
                disabled={licenseBusy}
                onClick={() => void handleDeactivateLicense()}
              >
                Deactivate on this computer
              </Button>
            )}
          </div>
          {!licenseStatus?.activated && (
            <div className="mt-5 border-t border-warm-200 pt-5">
              <Label htmlFor="license-key">Paste license key</Label>
              <Input
                id="license-key"
                className="mt-2 font-mono text-xs"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="ek1...."
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  disabled={licenseBusy || !licenseKey.trim()}
                  onClick={() => void handleActivateLicenseKey()}
                >
                  <KeyRound className="h-4 w-4" />
                  Activate key
                </Button>
                <Button
                  variant="ghost"
                  disabled={licenseBusy}
                  onClick={() => void handleActivateLicenseFile()}
                >
                  Activate from file
                </Button>
              </div>
            </div>
          )}
          {licenseMessage && <p className="mt-3 text-sm text-forest-700">{licenseMessage}</p>}
          {licenseError && <p className="mt-3 text-sm text-red-800">{licenseError}</p>}
        </section>

        <section className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">App updates</h2>
          <p className="mt-2 text-sm text-warm-500">
            Installed Everkeep checks GitHub Releases on startup and once a day. Your vault file is
            never part of an app update.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-warm-500">This version</dt>
              <dd>{updateStatus?.currentVersion ?? '…'}</dd>
            </div>
            {updateStatus?.availableVersion && (
              <div className="flex justify-between gap-4">
                <dt className="text-warm-500">Available</dt>
                <dd>{updateStatus.availableVersion}</dd>
              </div>
            )}
          </dl>
          <p className="mt-3 text-sm text-charcoal-800">
            {updateStatus?.state === 'checking' && 'Checking for updates…'}
            {updateStatus?.state === 'upToDate' &&
              (updateStatus.message ?? 'You have the latest version.')}
            {updateStatus?.state === 'available' &&
              `Version ${updateStatus.availableVersion} is available.`}
            {updateStatus?.state === 'downloading' &&
              `Downloading… ${updateStatus.downloadPercent ?? 0}%`}
            {updateStatus?.state === 'ready' &&
              (updateStatus.message ?? 'Restart Everkeep to install the update.')}
            {updateStatus?.state === 'error' && updateStatus.message}
            {updateStatus?.state === 'unsupported' && updateStatus.message}
            {updateStatus?.state === 'idle' && 'No update check has finished yet.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => void handleCheckForUpdate()}
              disabled={updateBusy || updateStatus?.state === 'downloading'}
            >
              {updateBusy && updateStatus?.state === 'checking' ? 'Checking…' : 'Check for updates'}
            </Button>
            {updateStatus?.state === 'available' && (
              <Button onClick={() => void handleDownloadUpdate()} disabled={updateBusy}>
                <Download className="h-4 w-4" />
                Download update
              </Button>
            )}
            {updateStatus?.state === 'ready' && (
              <Button onClick={() => void handleInstallUpdate()} disabled={updateBusy}>
                <RefreshCw className="h-4 w-4" />
                Restart to update
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => void unwrap(getEverkeepApi().updates.openReleasePage())}
            >
              Open releases
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">About Everkeep</h2>
          <p className="mt-3 text-sm leading-relaxed text-warm-500">{LEGAL_DISCLAIMER}</p>
          <p className="mt-4 text-xs text-warm-400">
            Everkeep is local-first. Your vault is saved on this computer. If you enable online sharing, records and attachments are uploaded to the sharing service, which encrypts stored information and enforces recipient permissions. Password protection encrypts the entire vault and stored attachments using
            Argon2id + AES-256-GCM. Older backups and exported reports keep their existing protection.
            Opening an attachment creates a temporary decrypted copy for the external viewer; Everkeep
            removes its temporary copy when you lock or close the vault.
          </p>
        </section>
      </div>
    </SectionPage>
  )
}

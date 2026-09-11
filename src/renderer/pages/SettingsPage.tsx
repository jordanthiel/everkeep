import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { LicenseSection } from '@renderer/components/license/LicenseSection'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { LEGAL_DISCLAIMER } from '@shared/constants'
import type { AppUpdateStatus } from '@shared/types/appUpdate'

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

  useEffect(() => {
    const api = getEverkeepApi()
    const unsubscribe = api.updates.onStatus(setUpdateStatus)
    void unwrap(api.updates.getStatus())
      .then(setUpdateStatus)
      .catch(() => {})
    return unsubscribe
  }, [])

  async function handleBackup() {
    if (!session) return
    setError(null)
    setMessage(null)
    try {
      const suggested = `${session.metadata.name}-backup`
      const path = await unwrap(getEverkeepApi().vault.pickBackupPath(suggested))
      if (!path) return
      const result = await unwrap(getEverkeepApi().vault.backup({ destinationPath: path }))
      setMessage(`Backup created at ${result.backupPath}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed.')
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
      setMessage('Password protection enabled. Sensitive fields will now be encrypted.')
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

  return (
    <SectionPage
      title="Settings"
      description="Vault location, backups, and product information."
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
            <Button variant="secondary" onClick={() => void handleBackup()} disabled={!session}>
              Back Up Vault
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
              If you chose a password before encryption existed, open the vault once and set a real
              password here. The password is never sent anywhere and cannot be recovered if forgotten.
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

        <LicenseSection />

        <section className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">About Everkeep</h2>
          <p className="mt-3 text-sm leading-relaxed text-warm-500">{LEGAL_DISCLAIMER}</p>
          <p className="mt-4 text-xs text-warm-400">
            Everkeep is local-first. Your vault stays on this computer and is never uploaded to an
            Everkeep server. Sensitive fields in password-protected vaults are encrypted with
            Argon2id + AES-256-GCM.
          </p>
        </section>
      </div>
    </SectionPage>
  )
}

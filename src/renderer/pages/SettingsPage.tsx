import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { LEGAL_DISCLAIMER } from '@shared/constants'

export function SettingsPage() {
  const navigate = useNavigate()
  const session = useVaultStore((s) => s.session)
  const setSession = useVaultStore((s) => s.setSession)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
            <Button variant="ghost" onClick={() => void handleClose()} disabled={!session}>
              Close Vault
            </Button>
          </div>
          {message && <p className="mt-3 text-sm text-forest-700">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
        </section>

        <section className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">About Everkeep</h2>
          <p className="mt-3 text-sm leading-relaxed text-warm-500">{LEGAL_DISCLAIMER}</p>
          <p className="mt-4 text-xs text-warm-400">
            Everkeep is local-first. Your vault stays on this computer and is never uploaded to an
            Everkeep server.
          </p>
        </section>
      </div>
    </SectionPage>
  )
}

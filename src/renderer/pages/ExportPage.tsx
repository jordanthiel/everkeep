import { useState } from 'react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'

export function ExportPage() {
  const session = useVaultStore((s) => s.session)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [includeSensitive, setIncludeSensitive] = useState(false)

  async function backup() {
    if (!session) return
    setError(null)
    setMessage(null)
    const path = await unwrap(
      getEverkeepApi().vault.pickBackupPath(`${session.metadata.name}-backup`)
    )
    if (!path) return
    const result = await unwrap(getEverkeepApi().vault.backup({ destinationPath: path }))
    setMessage(`Backup saved to ${result.backupPath}`)
  }

  async function exportReport() {
    if (!session) return
    setError(null)
    setMessage(null)
    try {
      const path = await unwrap(
        getEverkeepApi().vault.pickExportPath(`${session.metadata.name}-report`)
      )
      if (!path) return
      const result = await unwrap(
        getEverkeepApi().vault.exportReport({
          destinationPath: path,
          includeSensitive
        })
      )
      setMessage(`Report saved to ${result.path}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  return (
    <SectionPage
      title="Export"
      description="Create portable backups and human-readable reports for trusted people."
      badge="Share carefully"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">Everkeep Backup</h2>
          <p className="mt-2 text-sm text-warm-500">
            Creates a portable <code>.everkeep-backup</code> archive with your vault database and any
            uploaded document attachments. Store backups separately from your primary vault.
          </p>
          <Button className="mt-4" onClick={() => void backup()} disabled={!session}>
            Create Everkeep Backup
          </Button>
        </div>

        <div className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">Everkeep Report</h2>
          <p className="mt-2 text-sm text-warm-500">
            This report may contain extremely sensitive information. Highly sensitive credentials are
            excluded unless you explicitly include them.
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm text-charcoal-800">
            <input
              type="checkbox"
              checked={includeSensitive}
              onChange={(e) => setIncludeSensitive(e.target.checked)}
            />
            Include sensitive identifiers (SSN, full ID numbers, etc.)
          </label>
          <Button className="mt-4" variant="secondary" onClick={() => void exportReport()} disabled={!session}>
            Export HTML Report
          </Button>
        </div>

        {message && <p className="text-sm text-forest-700">{message}</p>}
        {error && <p className="text-sm text-red-800">{error}</p>}
      </div>
    </SectionPage>
  )
}

import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { useState } from 'react'

export function ExportPage() {
  const session = useVaultStore((s) => s.session)
  const [message, setMessage] = useState<string | null>(null)

  async function backup() {
    if (!session) return
    const path = await unwrap(
      getEverkeepApi().vault.pickBackupPath(`${session.metadata.name}-backup`)
    )
    if (!path) return
    const result = await unwrap(getEverkeepApi().vault.backup({ destinationPath: path }))
    setMessage(`Backup saved to ${result.backupPath}`)
  }

  return (
    <SectionPage
      title="Export"
      description="Create portable backups and, later, human-readable reports for trusted people."
      badge="Share carefully"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-warm-200 bg-ivory-50/80 p-5">
          <h2 className="font-medium text-charcoal-900">Everkeep Backup</h2>
          <p className="mt-2 text-sm text-warm-500">
            Creates a portable copy of your vault file. Store backups separately from your primary
            vault.
          </p>
          <Button className="mt-4" onClick={() => void backup()} disabled={!session}>
            Create Everkeep Backup
          </Button>
          {message && <p className="mt-3 text-sm text-forest-700">{message}</p>}
        </div>

        <div className="rounded-xl border border-dashed border-warm-300 p-5">
          <h2 className="font-medium text-charcoal-900">Everkeep Report (PDF)</h2>
          <p className="mt-2 text-sm text-warm-500">
            Printable reports arrive after the core sections are complete. Reports may contain
            extremely sensitive information.
          </p>
        </div>
      </div>
    </SectionPage>
  )
}

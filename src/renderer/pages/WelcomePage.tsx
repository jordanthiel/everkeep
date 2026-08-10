import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus } from 'lucide-react'
import { EverkeepMark } from '@renderer/components/brand/EverkeepMark'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import type { RecentVault } from '@shared/types/vault'
import { LEGAL_DISCLAIMER } from '@shared/constants'

export function WelcomePage() {
  const navigate = useNavigate()
  const setSession = useVaultStore((s) => s.setSession)
  const [recent, setRecent] = useState<RecentVault[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openingPath, setOpeningPath] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const items = await unwrap(getEverkeepApi().vault.getRecent())
        setRecent(items)
      } catch {
        setRecent([])
      }
    })()
  }, [])

  async function openPath(filePath: string, password?: string) {
    setError(null)
    setOpeningPath(filePath)
    try {
      const session = await unwrap(getEverkeepApi().vault.open({ filePath, password }))
      setSession(session)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open vault.')
    } finally {
      setOpeningPath(null)
    }
  }

  async function handleOpenExisting() {
    setError(null)
    try {
      const path = await unwrap(getEverkeepApi().vault.pickOpenPath())
      if (!path) return
      await openPath(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open vault.')
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center px-6 py-16">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brass-400/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-forest-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        <EverkeepMark size="lg" className="mb-10 justify-center" />

        <div className="text-center">
          <h1 className="font-display text-4xl font-medium leading-tight tracking-tight text-charcoal-900 sm:text-5xl">
            Everything they’ll need, when they need it.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-warm-500">
            Organize the important information your family would need if you couldn’t be there to
            explain it.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={() => navigate('/create-vault')}>
            <Plus className="h-4 w-4" />
            Create an Everkeep Vault
          </Button>
          <Button size="lg" variant="secondary" onClick={() => void handleOpenExisting()}>
            <FolderOpen className="h-4 w-4" />
            Open an Existing Vault
          </Button>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800">
            {error}
          </p>
        )}

        {recent.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-warm-400">
              Open Recent
            </h2>
            <ul className="space-y-2">
              {recent.map((item) => (
                <li key={item.filePath}>
                  <button
                    type="button"
                    disabled={openingPath === item.filePath}
                    onClick={() => void openPath(item.filePath)}
                    className="flex w-full items-center justify-between rounded-lg border border-warm-200 bg-ivory-50/90 px-4 py-3 text-left transition hover:border-forest-500/40 hover:bg-white"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-charcoal-900">{item.name}</p>
                      <p className="truncate text-xs text-warm-400">{item.filePath}</p>
                    </div>
                    <span className="ml-3 shrink-0 text-xs text-warm-400">
                      {new Date(item.lastOpenedAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mx-auto mt-12 max-w-lg text-center text-xs leading-relaxed text-warm-400">
          {LEGAL_DISCLAIMER}
        </p>
      </div>
    </div>
  )
}

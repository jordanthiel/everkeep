import { Link } from 'react-router-dom'
import { useVaultStore } from '@renderer/state/vaultStore'
import { cn } from '@renderer/lib/utils'

export function TitleBar() {
  const saveStatus = useVaultStore((s) => s.saveStatus)
  const session = useVaultStore((s) => s.session)

  return (
    <header className="app-drag-region flex h-12 items-center justify-between border-b border-warm-200/80 bg-ivory-50/60 px-6 backdrop-blur-sm">
      <div className="app-no-drag pl-16 text-sm text-warm-500">
        {session ? session.metadata.name : 'Everkeep'}
      </div>
      <div className="app-no-drag flex items-center gap-4 text-xs text-warm-500">
        <Link to="/settings" className="rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-forest-500">Settings</Link>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
            saveStatus === 'saving' && 'bg-warm-100 text-warm-500',
            saveStatus === 'saved' && 'bg-forest-700/10 text-forest-700',
            saveStatus === 'error' && 'bg-red-50 text-red-800',
            saveStatus === 'idle' && 'text-warm-400'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              saveStatus === 'saving' && 'animate-pulse bg-brass-500',
              saveStatus === 'saved' && 'bg-forest-600',
              saveStatus === 'error' && 'bg-red-700',
              saveStatus === 'idle' && 'bg-warm-300'
            )}
          />
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
          {saveStatus === 'idle' && 'Ready'}
        </span>
      </div>
    </header>
  )
}

import { useJourneyProgress } from '@renderer/hooks/useJourneyProgress'
import { Link, useLocation } from 'react-router-dom'
import { JOURNEY_GROUPS, groupForPath, groupPath, groupProgress } from '@shared/sections/journey'
import { EverkeepMark } from '@renderer/components/brand/EverkeepMark'
import { useVaultStore } from '@renderer/state/vaultStore'
import { cn } from '@renderer/lib/utils'

export function Sidebar() {
  const { pathname } = useLocation()
  const session = useVaultStore(s => s.session)
  const { statuses } = useJourneyProgress()
  const activeGroup = groupForPath(pathname)
  const finish = ['/finish', '/review', '/start-here', '/backup', '/export'].includes(pathname)
  const itemClass = (active: boolean) => cn('block rounded-lg px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500', active ? 'bg-forest-700 text-ivory-50' : 'text-charcoal-700 hover:bg-warm-100')
  return <aside className="flex h-full w-[224px] shrink-0 flex-col border-r border-warm-200 bg-ivory-50">
    <div className="app-drag-region px-6 pb-9 pt-12"><EverkeepMark size="sm" /><p className="mt-2 truncate text-xs text-warm-500">{session?.metadata.householdName || session?.metadata.name || 'Your vault'}</p></div>
    <nav aria-label="Plan sections" className="flex-1 space-y-2 overflow-y-auto px-3">
      <Link to="/" className={itemClass(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>Your plan</Link>
      <p className="px-4 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-widest text-warm-500">Your walkthrough</p>
      {JOURNEY_GROUPS.map((group, index) => {
        const progress = groupProgress(group, statuses)
        const active = activeGroup?.id === group.id
        return <Link key={group.id} to={groupPath(group.id)} className={itemClass(active)} aria-current={active ? 'page' : undefined}>
          <span className="block font-medium">{index + 1}. {group.title}</span>
          <span className={cn('mt-1 block text-xs', active ? 'text-ivory-200' : 'text-warm-500')}>{progress.status} · {progress.complete}/{group.steps.length}</span><progress aria-label={`${group.title}: ${progress.complete} of ${group.steps.length} complete`} value={progress.complete} max={group.steps.length} className="mt-2 h-1 w-full appearance-none overflow-hidden rounded [&::-webkit-progress-bar]:bg-warm-200 [&::-webkit-progress-value]:bg-brass-400 [&::-moz-progress-bar]:bg-brass-400" />
        </Link>
      })}
      <Link to="/finish" className={itemClass(finish)} aria-current={finish ? 'page' : undefined}>5. Review & share</Link>
    </nav>
    <p className="px-7 py-6 text-xs leading-relaxed text-warm-500">Go at your own pace.<br />You can revisit any section.</p>
  </aside>
}

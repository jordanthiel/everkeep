import { cn } from '@renderer/lib/utils'

export function StatusBadge({ label }: { label: string }) {
  return <span className={cn('inline-flex shrink-0 items-center rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
    label === 'Complete' ? 'bg-forest-700 text-white' :
    label === 'In progress' ? 'bg-blue-100 text-blue-900' :
    ['Needs attention', 'Need to find', 'Ask someone'].includes(label) ? 'bg-amber-100 text-amber-900' :
    'bg-warm-100 text-charcoal-700')}>{label}</span>
}

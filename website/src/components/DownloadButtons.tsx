import { useMemo } from 'react'
import { cn } from '../lib/utils'
import { detectPreferredPlatform, type Downloads } from '../config/downloads'

interface DownloadButtonsProps {
  downloads: Downloads
  className?: string
  size?: 'md' | 'lg'
}

export function DownloadButtons({ downloads, className, size = 'lg' }: DownloadButtonsProps) {
  const preferred = useMemo(() => detectPreferredPlatform(), [])
  const primaryHref = preferred === 'mac' ? downloads.mac : downloads.win
  const secondaryHref = preferred === 'mac' ? downloads.win : downloads.mac
  const primaryLabel = preferred === 'mac' ? 'Mac · Apple Silicon' : 'Download for Windows'
  const secondaryLabel = preferred === 'mac' ? 'Download for Windows' : 'Mac · Apple Silicon'

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <a
        href={primaryHref}
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-forest-700 font-medium text-ivory-50 transition hover:bg-forest-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400',
          size === 'lg' ? 'px-6 py-3.5 text-base' : 'px-5 py-2.5 text-sm'
        )}
      >
        {primaryLabel}
      </a>
      <a
        href={secondaryHref}
        className={cn(
          'inline-flex items-center justify-center rounded-md border border-charcoal-900/15 bg-ivory-50/80 font-medium text-charcoal-800 transition hover:border-charcoal-900/25 hover:bg-ivory-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400',
          size === 'lg' ? 'px-6 py-3.5 text-base' : 'px-5 py-2.5 text-sm'
        )}
      >
        {secondaryLabel}
      </a>
      <a href={downloads.macIntel} className="text-sm text-charcoal-700 underline underline-offset-4 hover:text-forest-700">
        Mac · Intel
      </a>
    </div>
  )
}

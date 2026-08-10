import { cn } from '@renderer/lib/utils'

interface EverkeepMarkProps {
  className?: string
  showWordmark?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function EverkeepMark({ className, showWordmark = true, size = 'md' }: EverkeepMarkProps) {
  const markSize = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9'
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl'

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'relative flex items-center justify-center rounded-md bg-forest-700 text-ivory-50 shadow-soft',
          markSize
        )}
        aria-hidden
      >
        <svg viewBox="0 0 32 32" className="h-[62%] w-[62%]" fill="none">
          <path
            d="M8 22V10.5C8 9.1 9.1 8 10.5 8H21.5C22.9 8 24 9.1 24 10.5V22"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M11 14.5H21M11 18H18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M16 24V20.5"
            stroke="#C4A574"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showWordmark && (
        <span className={cn('font-display font-medium tracking-tight text-charcoal-900', textSize)}>
          Everkeep
        </span>
      )}
    </div>
  )
}

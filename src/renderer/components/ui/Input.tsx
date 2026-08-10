import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 py-2 text-sm text-charcoal-900',
          'placeholder:text-warm-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500/30 focus-visible:border-forest-500',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

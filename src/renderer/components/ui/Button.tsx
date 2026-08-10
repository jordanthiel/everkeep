import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary:
    'bg-forest-600 text-ivory-50 hover:bg-forest-700 shadow-soft disabled:bg-warm-300',
  secondary:
    'bg-ivory-50 text-charcoal-800 border border-warm-300 hover:bg-ivory-100 hover:border-warm-400',
  ghost: 'bg-transparent text-charcoal-800 hover:bg-warm-100',
  danger: 'bg-red-800/90 text-white hover:bg-red-900'
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500/40',
          'disabled:cursor-not-allowed disabled:opacity-60',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

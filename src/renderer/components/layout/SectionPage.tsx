import type { ReactNode } from 'react'

interface SectionPageProps {
  title: string
  description: string
  badge?: string
  children?: ReactNode
  actions?: ReactNode
}

export function SectionPage({ title, description, badge, children, actions }: SectionPageProps) {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          {badge && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brass-500">
              {badge}
            </p>
          )}
          <h1 className="font-display text-3xl font-medium tracking-tight text-charcoal-900">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-warm-500">{description}</p>
        </div>
        {actions}
      </div>
      {children ?? (
        <div className="rounded-xl border border-dashed border-warm-300 bg-ivory-50/70 px-6 py-16 text-center">
          <p className="font-display text-lg text-charcoal-800">This section is ready for records</p>
          <p className="mt-2 text-sm text-warm-500">
            Structured fields for this area arrive in the next milestones. The vault and navigation
            are already in place.
          </p>
        </div>
      )}
    </div>
  )
}

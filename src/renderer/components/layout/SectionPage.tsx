import { JOURNEY_STEPS } from '@shared/sections/journey'
import { useEffect, type ReactNode } from 'react'
import { useBlocker, useLocation } from 'react-router-dom'
import { Button } from '@renderer/components/ui/Button'
import { useVaultStore } from '@renderer/state/vaultStore'
import { JourneyNavigation, JourneyPrompt } from './Journey'

interface SectionPageProps {
  title: string
  description: string
  badge?: string
  children?: ReactNode
  actions?: ReactNode
  journeyBlocked?: boolean
}

export function SectionPage({ title, description, badge, children, actions, journeyBlocked }: SectionPageProps) {
  const { pathname } = useLocation()
  const topic = JOURNEY_STEPS.find(step => step.path === pathname)
  const session = useVaultStore((s) => s.session)
  const saving = useVaultStore((s) => s.saveStatus) === 'saving'
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    Boolean(journeyBlocked && session && !session.isLocked &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  )
  useEffect(() => {
    if (!journeyBlocked) return
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [journeyBlocked])
  return (
    <div className="animate-in fade-in duration-300">
      {blocker.state === 'blocked' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/40 p-6" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" onKeyDown={(event) => { if (event.key === 'Escape') blocker.reset() }}>
        <div className="max-w-md rounded-xl bg-ivory-50 p-6 shadow-soft">
          <h2 id="unsaved-title" className="font-display text-2xl">{saving ? 'Saving your record' : 'You have an unfinished record'}</h2>
          <p id="unsaved-description" className="my-4 text-sm text-warm-500">{saving ? 'Please wait until saving finishes before leaving this topic.' : 'Stay here to save it, or discard these changes and leave.'}</p>
          <div className="flex gap-3" onKeyDown={(event) => {
            if (event.key === 'Tab') {
              const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
              const first = buttons[0], last = buttons[buttons.length - 1]
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
            }
          }}>
            <Button autoFocus onClick={() => blocker.reset()}>Keep editing</Button>
            <Button variant="secondary" disabled={saving} onClick={() => blocker.proceed()}>Discard and leave</Button>
          </div>
        </div>
      </div>}
      <JourneyPrompt />
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          {(topic?.title || badge) && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brass-500">
              {topic?.title || badge}
            </p>
          )}
          <h1 className="font-display text-3xl font-medium tracking-tight text-charcoal-900">
            {topic?.prompt || title}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-warm-500">{topic?.help || description}</p>
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
      <JourneyNavigation blocked={journeyBlocked} />
    </div>
  )
}

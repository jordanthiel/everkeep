import { StatusBadge } from './StatusBadge'
import { useJourneyProgress } from '@renderer/hooks/useJourneyProgress'
import { TOPIC_CONTENT } from '@shared/sections/topicContent'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { JOURNEY_GROUPS, JOURNEY_STEPS, nextSectionHome, nextTopicPath, groupPath, groupProgress, topicPath, STEP_STATUS_LABELS, type StepStatus } from '@shared/sections/journey'
import { useJourneyStore } from '@renderer/state/journeyStore'
import { useVaultStore } from '@renderer/state/vaultStore'
import { Button } from '@renderer/components/ui/Button'

export function JourneyOverview({ reviewing = false }: { reviewing?: boolean }) {
  const { statuses } = useJourneyProgress()
  const started = Object.keys(statuses).length > 0
  const considered = JOURNEY_STEPS.filter(step => ['reviewed', 'not-applicable'].includes(statuses[step.id])).length
  const followups = JOURNEY_STEPS.filter(step => ['skipped','need-to-find','ask-someone'].includes(statuses[step.id])).length
  const navigate = useNavigate()
  return <section className="space-y-7">
    {!reviewing && <div className="rounded-2xl bg-forest-700 p-7 text-ivory-50 sm:p-8">
      <p className="text-sm text-ivory-200">A little at a time. All in one place.</p>
      <h2 className="mt-3 max-w-xl font-display text-3xl">{started ? 'Let’s pick up where you left off.' : 'We’ll help you build your plan, step by step.'}</h2>
      <p className="mt-4 max-w-xl leading-relaxed text-ivory-200">We’ll explain each section, guide you through the topics that matter to you, then help you prepare a useful plan for your family.</p>
      <Button size="lg" className="mt-6 bg-ivory-50 text-forest-700 hover:bg-white" onClick={() => navigate(nextSectionHome(statuses))}>{!started ? 'Let’s get started' : considered === JOURNEY_STEPS.length ? 'Review & share my plan' : 'Continue my plan'}</Button>
      <p className="mt-5 text-xs text-ivory-200">{considered} of {JOURNEY_STEPS.length} topics complete{followups ? ` · ${followups} to revisit` : ''}. Skipped topics remain open until you finish them. Your progress stays on this device.</p>
    </div>}
    <div><h2 className="mb-4 font-display text-2xl">{reviewing ? 'Check each section' : 'Your plan, in five sections'}</h2>
      <div className="space-y-3">{JOURNEY_GROUPS.map((group,index) => {
        const progress = groupProgress(group,statuses)
        return <Link key={group.id} to={groupPath(group.id)} className="flex items-start gap-5 rounded-xl border border-warm-200 bg-ivory-50 p-5 transition-colors hover:border-forest-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500">
          <span className="pt-1 text-sm text-warm-400">0{index+1}</span><div className="flex-1"><h3 className="font-display text-xl">{group.title}</h3><p className="mt-1 text-sm text-warm-500">{group.description}</p><p className="mt-2 text-xs text-warm-500">{progress.complete} of {group.steps.length} topics complete{progress.followups.length ? ` · ${progress.followups.length} need attention` : ''}</p><div className="mt-3"><StatusBadge label={progress.status} /></div></div><span className="pt-1 text-sm font-medium text-forest-700">{progress.status === 'Not started' ? 'Start' : progress.status === 'Complete' ? 'Edit' : 'Continue'}</span>
        </Link>
      })}
      <Link to="/finish" className="flex items-start gap-5 rounded-xl border border-warm-200 bg-ivory-50 p-5 hover:border-forest-500 focus-visible:ring-2 focus-visible:ring-forest-500"><span className="pt-1 text-sm text-warm-400">05</span><div className="flex-1"><h3 className="font-display text-xl">Review & share</h3><p className="mt-1 text-sm text-warm-500">Check your plan, prepare a family handoff, and test that it can be opened.</p></div><span className="pt-1 text-sm font-medium text-forest-700">Open section</span></Link>
      </div>
    </div>
  </section>
}

export function JourneyPrompt() {
  const { statuses } = useJourneyProgress()
  const { pathname } = useLocation()
  const step = JOURNEY_STEPS.find(step => step.path === pathname)
  if (!step) return ['/review','/start-here','/backup','/export'].includes(pathname) ? <Link to="/finish" className="mb-6 inline-block text-sm text-forest-700 underline underline-offset-4">Review & share home</Link> : null
  const group = JOURNEY_GROUPS.find(group => group.id === step.groupId)!
  return <nav aria-label="Topic location" className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
    <Link to={groupPath(step.groupId)} className="text-forest-700 underline underline-offset-4">{step.group} home</Link>
    <div className="flex flex-wrap items-center gap-3"><span className="text-warm-500">Topic {group.steps.findIndex(topic => topic.id === step.id)+1} of {group.steps.length} · {step.title}</span><StatusBadge label={statuses[step.id] ? STEP_STATUS_LABELS[statuses[step.id]] : 'Not started'} /></div>
  </nav>
}

export function JourneyNavigation({ blocked = false }: { blocked?: boolean }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const vaultId = useVaultStore(s => s.session?.metadata.id)
  const mark = useJourneyStore(s => s.mark)
  const { statuses } = useJourneyProgress()
  const step = JOURNEY_STEPS.find(step => step.path === pathname)
  if (!step) return null
  const nextPath = nextTopicPath(step.id, statuses)
  function advance(status: StepStatus) {
    if (!vaultId || blocked) return
    mark(vaultId, step!.id, status)
    navigate(nextPath)
  }
  return <footer className="mt-8 border-t border-warm-200 bg-ivory-50/90 pb-2 pt-6">
    <p className="mb-4 text-sm text-warm-500" role="status">{blocked ? `Save your ${TOPIC_CONTENT[step.id].noun} or cancel your changes before moving on.` : `Add anything else your family should know about ${step.title.toLowerCase()}, then mark this topic complete when you’re ready.`}</p>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" disabled={blocked} onClick={() => navigate(topicPath(step.id))}>Back</Button>
      <div className="flex flex-wrap gap-3">
        <select aria-label="Defer this topic" className="h-10 rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm disabled:opacity-50" disabled={blocked} value="" onChange={e => advance(e.target.value as StepStatus)}><option value="" disabled>Save for later…</option><option value="skipped">Skip for now</option><option value="not-applicable">Not applicable</option><option value="need-to-find">Need to find information</option><option value="ask-someone">Need to ask someone</option></select>
        <Button disabled={blocked} onClick={() => advance('reviewed')}>Mark complete &amp; continue</Button>
      </div>
    </div>
  </footer>
}

import { StatusBadge } from '@renderer/components/layout/StatusBadge'
import { useJourneyProgress } from '@renderer/hooks/useJourneyProgress'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { JOURNEY_GROUPS, groupPath, groupProgress, topicPath, topicAction, STEP_STATUS_LABELS } from '@shared/sections/journey'
import { Button } from '@renderer/components/ui/Button'

export function SectionHomePage() {
  const { groupId } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { statuses, counts } = useJourneyProgress()
  const index = JOURNEY_GROUPS.findIndex(group => group.id === groupId)
  const group = JOURNEY_GROUPS[index]
  if (!group) return <Navigate to="/" replace />
  const progress = groupProgress(group, statuses)
  const next = JOURNEY_GROUPS[index + 1]
  const summary = search.get('summary') === '1'
  const allConsidered = progress.pending.length === 0
  const nextTopic = progress.pending[0]
  return <div className="space-y-7">
    <header>
      <Link to="/" className="text-sm text-forest-700 underline underline-offset-4">Your plan</Link>
      <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-widest text-brass-500">Section {index + 1} of 5 · {group.title}</p>
      <h1 className="max-w-3xl font-display text-4xl leading-tight text-charcoal-900">{summary ? `Let’s look over ${group.title.toLowerCase()}.` : group.headline}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-warm-500">{summary ? (allConsidered ? 'You’ve considered each topic in this section. Take a moment to check your answers and anything you want to revisit.' : 'Here’s where this section stands. You can pick up the remaining topics or revisit an earlier answer.') : group.introduction}</p>
    </header>
    <section className="rounded-2xl border border-warm-200 bg-ivory-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><div className="mb-3"><StatusBadge label={progress.status} /></div><h2 className="font-display text-xl">{allConsidered ? 'Your section summary' : progress.considered ? 'Pick up where you left off' : 'We’ll take it one topic at a time'}</h2><p className="mt-2 text-sm text-warm-500">{progress.complete} of {group.steps.length} topics complete · {progress.followups.length} {progress.followups.length === 1 ? 'topic needs' : 'topics need'} attention</p></div>
        {nextTopic ? <Button size="lg" onClick={() => navigate(topicPath(nextTopic.id))}>{progress.status === 'Not started' ? 'Start section' : 'Continue section'}</Button> : <Button size="lg" onClick={() => navigate(next ? groupPath(next.id) : '/finish')}>Continue to {next?.title ?? 'Review & share'}</Button>}
      </div>
      <progress aria-label={`${group.title} topics complete`} className="mt-5 h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-warm-100 [&::-webkit-progress-value]:bg-forest-600 [&::-moz-progress-bar]:bg-forest-600" value={progress.complete} max={group.steps.length} />
      {progress.followups.length > 0 && <p className="mt-3 text-sm text-warm-500">Your follow-ups stay listed below, even when you continue to the next section.</p>}
    </section>
    {!summary && progress.status === 'Not started' && <aside className="border-l-2 border-brass-400 pl-5"><h2 className="font-medium text-charcoal-800">Helpful to have nearby</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-warm-500">{group.prepare} It’s okay if you don’t have everything yet.</p></aside>}
    <section aria-label="Section topics">
      <p className="mb-4 text-sm text-warm-500">Save records as you go. Choose “Mark complete &amp; continue” when you’ve finished a topic. Topics that don’t apply also count as complete.</p><h2 className="mb-4 font-display text-2xl">{summary ? 'Your topics' : 'What we’ll cover'}</h2>
      <div className="divide-y divide-warm-200 overflow-hidden rounded-xl border border-warm-200 bg-ivory-50">
        {group.steps.map(step => {
          const status = statuses[step.id]
          const action = topicAction(status)
          return <article key={step.id} className="grid items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto_104px]">
            <div className="min-w-0"><h3 className="font-medium text-charcoal-900">{step.title}</h3><p className="mt-1 text-sm leading-relaxed text-warm-500">{step.prompt}</p>{counts[step.id] > 0 && <p className="mt-2 text-xs text-warm-500">{counts[step.id]} saved {counts[step.id] === 1 ? 'record' : 'records'}</p>}</div>
            <div><StatusBadge label={status ? STEP_STATUS_LABELS[status] : 'Not started'} /></div>
            <Link aria-label={`${action} ${step.title}`} to={!status || status === 'not-applicable' ? topicPath(step.id) : `/${step.id}`} className={`rounded-md border border-forest-700 px-4 py-2 text-center text-sm font-semibold focus-visible:ring-2 focus-visible:ring-forest-500 ${!status || status === 'in-progress' ? 'bg-forest-700 text-white' : 'text-forest-700 hover:bg-forest-700/5'}`}>{action}</Link>
          </article>
        })}
      </div>
    </section>
    <footer className="flex flex-wrap justify-between gap-4 border-t border-warm-200 pt-5"><Link className="text-sm text-forest-700 underline underline-offset-4" to={index ? groupPath(JOURNEY_GROUPS[index - 1].id) : '/'}>Back to {index ? JOURNEY_GROUPS[index - 1].title : 'your plan'}</Link><Link className="text-sm text-warm-500 underline underline-offset-4" to="/">Return to your plan</Link></footer>
  </div>
}

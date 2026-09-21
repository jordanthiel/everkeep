import { useJourneyProgress } from '@renderer/hooks/useJourneyProgress'
import { TOPIC_CONTENT } from '@shared/sections/topicContent'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { JOURNEY_GROUPS, JOURNEY_STEPS, groupPath, nextTopicPath, STEP_STATUS_LABELS, type StepStatus } from '@shared/sections/journey'
import { useJourneyStore } from '@renderer/state/journeyStore'
import { useVaultStore } from '@renderer/state/vaultStore'
import { Button } from '@renderer/components/ui/Button'

export function TopicIntroPage() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const vaultId = useVaultStore(s => s.session?.metadata.id) ?? ''
  const mark = useJourneyStore(s => s.mark)
  const { statuses } = useJourneyProgress()
  const step = JOURNEY_STEPS.find(step => step.id === topicId)
  if (!step) return <Navigate to="/" replace />
  const content = TOPIC_CONTENT[step.id]
  const group = JOURNEY_GROUPS.find(group => group.id === step.groupId)!
  const index = group.steps.findIndex(topic => topic.id === step.id)
  function defer(status: StepStatus) {
    mark(vaultId, step!.id, status)
    navigate(nextTopicPath(step!.id, {...statuses, [step!.id]: status}))
  }
  return <div className="mx-auto max-w-3xl">
    <Link to={groupPath(group.id)} className="text-sm text-forest-700 underline underline-offset-4">{group.title} home</Link>
    <p className="mt-9 text-xs font-semibold uppercase tracking-widest text-brass-500">{step.title} · Topic {index + 1} of {group.steps.length}</p>
    <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight">{step.prompt}</h1>
    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-warm-500">{step.help}</p>
    <section className="mt-8 rounded-2xl border border-warm-200 bg-ivory-50 p-6 sm:p-8">
      <h2 className="font-display text-2xl">{content.heading}</h2>
      <p className="mb-6 mt-3 text-sm leading-relaxed text-warm-500">{content.guidance}</p>
      <ul className="mb-6 space-y-2 border-l-2 border-brass-400 pl-4 text-sm text-warm-500" aria-label="Examples">{content.examples.map(example => <li key={example}>{example}</li>)}</ul>
      {statuses[step.id] && <p className="mb-5 rounded-lg bg-warm-100 px-4 py-3 text-sm">Your previous choice: <strong>{STEP_STATUS_LABELS[statuses[step.id]]}</strong>. Your saved records are still available.</p>}
      <Button size="lg" onClick={() => navigate(step.path)}>{content.action}</Button>
      <div className="mt-7 border-t border-warm-200 pt-5">
        <p className="mb-3 text-sm font-medium">Not ready to add details?</p>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => defer('not-applicable')}>This doesn’t apply to me</Button><Button variant="ghost" onClick={() => defer('need-to-find')}>I need to find information</Button><Button variant="ghost" onClick={() => defer('ask-someone')}>I need to ask someone</Button></div>
        <p className="mt-4 text-xs leading-relaxed text-warm-500">These choices only change your walkthrough progress. They never remove saved records.</p>
      </div>
    </section>
    <div className="mt-7 flex justify-between"><Link to={groupPath(group.id)} className="text-sm text-forest-700 underline underline-offset-4">Back to section home</Link><button className="rounded text-sm text-warm-500 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-forest-500" onClick={() => defer('skipped')}>Skip for now</button></div>
  </div>
}

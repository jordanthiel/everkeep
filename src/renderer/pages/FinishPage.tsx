import { useJourneyProgress } from '@renderer/hooks/useJourneyProgress'
import { Link } from 'react-router-dom'
import { JOURNEY_STEPS, nextSectionHome } from '@shared/sections/journey'

const tasks = [
  {path:'/review',title:'Review your plan',description:'Revisit anything you skipped and check that saved details are still accurate.',action:'Review my answers'},
  {path:'/start-here',title:'Give your family a starting point',description:'Choose whom to call, what needs attention, and where someone can find the plan.',action:'Prepare the family handoff'},
  {path:'/backup',title:'Make sure the plan can be opened',description:'Create a separate backup, test it, and practice access with someone you trust.',action:'Back up and test access'},
  {path:'/export',title:'Prepare a copy for the right person',description:'Choose a recipient, select their information, and preview the packet before exporting.',action:'Prepare a packet'}
]
export function FinishPage() {
  const { statuses } = useJourneyProgress()
  const pending = JOURNEY_STEPS.filter(step => (!statuses[step.id] || statuses[step.id] === 'in-progress')).length
  const followups = JOURNEY_STEPS.filter(step => ['skipped','need-to-find','ask-someone'].includes(statuses[step.id])).length
  return <div>
    <p className="text-xs font-semibold uppercase tracking-widest text-brass-500">Section 5 of 5 · Review & share</p>
    <h1 className="mt-4 font-display text-4xl">Let’s make your plan ready to use.</h1>
    <p className="mt-4 max-w-2xl text-lg leading-relaxed text-warm-500">Bring everything together, leave clear next steps, and make sure the people you trust can find what they need.</p>
    {(pending > 0 || followups > 0) && <p className="mt-6 rounded-xl border border-warm-200 bg-warm-100 p-4 text-sm">You have {pending} topics unfinished and {followups} to revisit. You can still prepare a packet now. <Link to={pending ? nextSectionHome(statuses) : '/review'} className="text-forest-700 underline underline-offset-4">Return to your topics</Link></p>}
    <div className="mt-8 space-y-4">{tasks.map((task,index) => <section key={task.path} className="flex gap-5 rounded-xl border border-warm-200 bg-ivory-50 p-6"><span className="text-sm text-warm-400">0{index+1}</span><div><h2 className="font-display text-2xl">{task.title}</h2><p className="mb-4 mt-2 max-w-2xl text-sm leading-relaxed text-warm-500">{task.description}</p><Link to={task.path} className="rounded text-sm font-medium text-forest-700 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-forest-500">{task.action}</Link></div></section>)}</div>
    <p className="mt-6 text-xs text-warm-500">This walkthrough organizes information. It does not replace signed documents or professional advice.</p>
  </div>
}

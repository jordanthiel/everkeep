export const JOURNEY_GROUPS = [
  { id: 'essentials', headline: 'Let’s start with the people who matter.', introduction: 'A few names and document locations give your family a place to begin. We’ll help you connect each person to the information they may need.', prepare: 'Names and contact details, plus the locations of IDs and signed legal documents.', title: 'People & essentials', description: 'Start with the people you trust and the documents they may need.', steps: [
    { id: 'people', title: 'Contacts', prompt: 'Who should your family know to contact?', help: 'Add yourself, family members, and trusted helpers. You can select these people in later steps.' },
    { id: 'identity', title: 'Identity', prompt: 'Where can your family find important IDs?', help: 'Choose a person, then add an ID or its location. Add another record for each document.' },
    { id: 'legal', title: 'Legal & Estate', prompt: 'What legal arrangements are already in place?', help: 'Record existing documents, who is responsible, and where the originals are kept.' }
  ] },
  { id: 'money', headline: 'Give your family a clear financial picture.', introduction: 'We’ll work through accounts, bills, coverage, and belongings one topic at a time. You can start with the provider and where to find the paperwork.', prepare: 'An account statement, insurance information, and a list of regular payments. Exact balances can wait.', title: 'Money & property', description: 'Give your family a map of accounts, coverage, and assets.', steps: [
    { id: 'financial', title: 'Financial accounts', prompt: 'Which accounts should someone know about?', help: 'Start with your main bank, then add savings, investments, and retirement accounts. We’ll cover bills and debts next.' },
    { id: 'debts', title: 'Bills & Debts', prompt: 'Which payments and obligations need attention?', help: 'Record who is named on the account, when payments are due, and whom to ask before making changes.' },
    { id: 'insurance', title: 'Insurance', prompt: 'Which insurance policies protect your household?', help: 'Add one policy at a time. A provider and policy location are a useful starting point.' },
    { id: 'property', title: 'Property', prompt: 'What homes or vehicles would need attention?', help: 'Record ownership, loans, and where to find titles or keys for each property.' },
    { id: 'income', title: 'Income & Employment', prompt: 'Where does household income come from?', help: 'Include employers, pensions, benefits, and other recurring income.' },
    { id: 'taxes', title: 'Taxes', prompt: 'Who handles your taxes, and where are the records?', help: 'Add your preparer and the location of past returns. No tax calculations are needed.' }
  ] },
  { id: 'care', headline: 'Help someone keep everyday life running.', introduction: 'Think about a day when someone else needs to step in. We’ll cover the people and pets who rely on you, your own care, and practical access.', prepare: 'Care routines, healthcare contacts, and instructions for household and digital access.', title: 'Care & everyday life', description: 'Capture the practical details that keep life running.', steps: [
    { id: 'dependents', title: 'Children, Dependents & Pets', prompt: 'Who depends on you every day?', help: 'Leave a practical care profile for each child, dependent adult, or pet.' },
    { id: 'healthcare', title: 'Healthcare', prompt: 'What would someone need to help with your care?', help: 'Add care contacts, medications, and preferences you want to share.' },
    { id: 'digital', title: 'Digital Life', prompt: 'How can an authorized person access your digital life?', help: 'Start with your password manager and main email account. Record recovery instructions.' },
    { id: 'household', title: 'Household', prompt: 'What keeps your household running?', help: 'Think about bills, subscriptions, services, and practical instructions.' }
  ] },
  { id: 'wishes', headline: 'Leave guidance in your own words.', introduction: 'We’ll make room for meaningful belongings, personal wishes, messages, and other important papers. Share only what you feel ready to record.', prepare: 'Any notes about your wishes and the locations of important documents. You can write messages as you go.', title: 'Wishes & documents', description: 'Leave personal guidance and make important papers easy to find.', steps: [
    { id: 'personal-property', title: 'Personal Property', prompt: 'Which belongings have a story or intended recipient?', help: 'Add meaningful items and the guidance you would like to leave about them.' },
    { id: 'final-wishes', title: 'Final Wishes', prompt: 'What preferences would you like your family to know?', help: 'Share as much as you feel ready to. You can skip this section and return later.' },
    { id: 'letters', title: 'Letters & Instructions', prompt: 'Is there anything you want to say in your own words?', help: 'Write a message or practical instructions for someone you trust.' },
    { id: 'documents', title: 'Documents', prompt: 'Are there other important papers to make easy to find?', help: 'Add locations or copies of documents. You do not need to duplicate records already added.' }
  ] }
] as const

export const JOURNEY_STEPS = JOURNEY_GROUPS.flatMap((group) =>
  group.steps.map((step) => ({ ...step, group: group.title, groupId: group.id, path: `/${step.id}` }))
)
export type StepStatus = 'in-progress' | 'reviewed' | 'skipped' | 'not-applicable' | 'need-to-find' | 'ask-someone'
export const STEP_STATUS_LABELS: Record<StepStatus, string> = { 'in-progress': 'In progress', reviewed: 'Complete', skipped: 'Needs attention', 'not-applicable': 'Not applicable', 'need-to-find': 'Need to find', 'ask-someone': 'Ask someone' }
export function nextJourneyPath(statuses: Record<string, StepStatus>): string {
  return JOURNEY_STEPS.find((step) => (!statuses[step.id] || statuses[step.id] === 'in-progress'))?.path ?? '/review'
}

export type JourneyGroup = typeof JOURNEY_GROUPS[number]
export type JourneyStatuses = Record<string, StepStatus>
export const groupPath = (id: string) => `/sections/${id}`
export const topicPath = (id: string) => `/guide/${id}`
export function groupForPath(path: string) {
  return JOURNEY_GROUPS.find(group => path === groupPath(group.id) || group.steps.some(step => path === `/${step.id}` || path === topicPath(step.id)))
}
export function groupProgress(group: JourneyGroup, statuses: JourneyStatuses) {
  const pending = group.steps.filter(step => (!statuses[step.id] || statuses[step.id] === 'in-progress'))
  const followups = group.steps.filter(step => ['skipped', 'need-to-find', 'ask-someone'].includes(statuses[step.id]))
  const reviewed = group.steps.filter(step => statuses[step.id] === 'reviewed').length
  const notApplicable = group.steps.filter(step => statuses[step.id] === 'not-applicable').length
  const complete = reviewed + notApplicable
  const started = group.steps.some(step => Boolean(statuses[step.id]))
  const status = complete === group.steps.length ? 'Complete' : followups.length ? 'Needs attention' : started ? 'In progress' : 'Not started'
  return { status, complete, pending, followups, reviewed, notApplicable, considered: group.steps.length - pending.length }
}
export function nextSectionHome(statuses: JourneyStatuses) {
  const group = JOURNEY_GROUPS.find(group => groupProgress(group, statuses).pending.length > 0)
  return group ? groupPath(group.id) : '/finish'
}
export function nextTopicPath(stepId: string, statuses: JourneyStatuses) {
  const group = JOURNEY_GROUPS.find(group => group.steps.some(step => step.id === stepId))!
  const index = group.steps.findIndex(step => step.id === stepId)
  const next = group.steps.slice(index + 1).find(step => (!statuses[step.id] || statuses[step.id] === 'in-progress'))
  return next ? topicPath(next.id) : `${groupPath(group.id)}?summary=1`
}

export function topicAction(status?: StepStatus) {
  return !status ? 'Start' : status === 'in-progress' ? 'Continue' : status === 'reviewed' || status === 'not-applicable' ? 'Edit' : 'Review'
}
export function withSavedTopics(statuses: JourneyStatuses, counts: Record<string, number> = {}): JourneyStatuses {
  const result = { ...statuses }
  for (const [id, count] of Object.entries(counts)) if (count > 0 && !result[id]) result[id] = 'in-progress'
  return result
}

export interface DashboardAction {
  id: string
  title: string
  description: string
  path: string
  cta: string
  done: boolean
  priority: number
}

export interface DashboardSummary {
  topicCounts: Record<string, number>
  overallPercent: number
  peopleCount: number
  contactsCount: number
  accountsCount: number
  hasExecutor: boolean
  hasPasswordManagerHint: boolean
  actions: DashboardAction[]
  importantPeople: Array<{ role: string; name: string | null }>
  recentlyUpdated: Array<{
    entity: string
    title: string
    updatedAt: string
    path: string
  }>
}

import { SectionPage } from '@renderer/components/layout/SectionPage'

interface PlaceholderSectionPageProps {
  title: string
  description: string
  badge?: string
}

export function PlaceholderSectionPage({ title, description, badge }: PlaceholderSectionPageProps) {
  return <SectionPage title={title} description={description} badge={badge} />
}

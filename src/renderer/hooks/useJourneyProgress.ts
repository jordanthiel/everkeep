import { useQuery } from '@tanstack/react-query'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { useJourneyStore } from '@renderer/state/journeyStore'
import { withSavedTopics } from '@shared/sections/journey'

export function useJourneyProgress() {
  const session = useVaultStore(s => s.session)
  const vaults = useJourneyStore(s => s.vaults)
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => unwrap(getEverkeepApi().vault.getDashboard()), enabled: Boolean(session && !session.isLocked) })
  return { statuses: withSavedTopics(vaults[session?.metadata.id ?? ''] ?? {}, query.data?.topicCounts), counts: query.data?.topicCounts ?? {} }
}

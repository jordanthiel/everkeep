import { useQuery } from '@tanstack/react-query'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { useJourneyStore } from '@renderer/state/journeyStore'
import { withSavedTopics } from '@shared/sections/journey'

export function useJourneyProgress() {
  const session = useVaultStore(s => s.session)
  const vaults = useJourneyStore(s => s.vaults)
  const query = useQuery({ queryKey: ['dashboard', session?.metadata.id], queryFn: () => unwrap(getEverkeepApi().vault.getDashboard()), enabled: Boolean(session && !session.isLocked) })
  // Contacts created during setup do not mean the user has started the walkthrough.
  const metadata = session?.metadata
  const initialPeople = Number(Boolean(metadata?.ownerFirstName || metadata?.ownerLastName))
    + Number(Boolean(metadata?.spousePartnerName?.trim()))
  return { statuses: withSavedTopics(vaults[session?.metadata.id ?? ''] ?? {}, query.data?.topicCounts, { people: initialPeople }), counts: query.data?.topicCounts ?? {} }
}

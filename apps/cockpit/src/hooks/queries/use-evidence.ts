import { useQuery } from '@tanstack/react-query'
import type { EvidenceEntry } from '@portarium/cockpit-types'

async function fetchEvidence(wsId: string): Promise<{ items: EvidenceEntry[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/evidence`)
  if (!res.ok) throw new Error('Failed to fetch evidence')
  return res.json()
}

export function useEvidence(wsId: string) {
  return useQuery({
    queryKey: ['evidence', wsId],
    queryFn: () => fetchEvidence(wsId),
    enabled: Boolean(wsId),
  })
}

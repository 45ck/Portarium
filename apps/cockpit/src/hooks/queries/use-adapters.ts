import { useQuery } from '@tanstack/react-query'
import type { AdapterSummary } from '@portarium/cockpit-types'

async function fetchAdapters(wsId: string): Promise<{ items: AdapterSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/adapters`)
  if (!res.ok) throw new Error('Failed to fetch adapters')
  return res.json()
}

export function useAdapters(wsId: string) {
  return useQuery({
    queryKey: ['adapters', wsId],
    queryFn: () => fetchAdapters(wsId),
    enabled: Boolean(wsId),
  })
}

import { useQuery } from '@tanstack/react-query'
import type { GatewaySummary } from '@portarium/cockpit-types'

async function fetchGateways(wsId: string): Promise<{ items: GatewaySummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/gateways`)
  if (!res.ok) throw new Error('Failed to fetch gateways')
  return res.json()
}

export function useGateways(wsId: string) {
  return useQuery({
    queryKey: ['gateways', wsId],
    queryFn: () => fetchGateways(wsId),
    enabled: Boolean(wsId),
  })
}

import { useQuery } from '@tanstack/react-query'
import type { AgentV1 } from '@portarium/cockpit-types'

async function fetchAgents(wsId: string): Promise<{ items: AgentV1[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/agents`)
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json()
}

export function useAgents(wsId: string) {
  return useQuery({ queryKey: ['agents', wsId], queryFn: () => fetchAgents(wsId) })
}

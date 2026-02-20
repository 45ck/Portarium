import { useQuery } from '@tanstack/react-query'
import type { MissionSummary } from '@/types/robotics'

async function fetchMissions(wsId: string): Promise<{ items: MissionSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/missions`)
  if (!res.ok) throw new Error('Failed to fetch missions')
  return res.json()
}

export function useMissions(wsId: string) {
  return useQuery({ queryKey: ['missions', wsId], queryFn: () => fetchMissions(wsId) })
}

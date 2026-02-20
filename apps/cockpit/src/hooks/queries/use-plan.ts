import { useQuery } from '@tanstack/react-query'
import type { Plan } from '@portarium/cockpit-types'

async function fetchPlan(wsId: string, planId: string): Promise<Plan> {
  const res = await fetch(`/v1/workspaces/${wsId}/plans/${planId}`)
  if (!res.ok) throw new Error('Plan not found')
  return res.json()
}

export function usePlan(wsId: string, planId: string | undefined) {
  return useQuery({
    queryKey: ['plans', wsId, planId],
    queryFn: () => fetchPlan(wsId, planId!),
    enabled: Boolean(planId),
  })
}

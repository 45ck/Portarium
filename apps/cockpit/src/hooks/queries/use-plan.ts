import { useQuery } from '@tanstack/react-query';
import type { Plan } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

async function fetchPlan(wsId: string, planId: string): Promise<Plan> {
  return controlPlaneClient.getPlan(wsId, planId);
}

export function usePlan(wsId: string, planId: string | undefined) {
  return useQuery({
    queryKey: ['plans', wsId, planId],
    queryFn: () => fetchPlan(wsId, planId!),
    enabled: Boolean(wsId) && Boolean(planId),
  });
}

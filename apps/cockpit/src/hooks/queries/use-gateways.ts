import type { GatewaySummary } from '@portarium/cockpit-types';
import { fetchJson } from '@/lib/fetch-json';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';
import { shouldEnableRoboticsQuery } from '@/lib/robotics-runtime';

interface RoboticsQueryOptions {
  enabled?: boolean;
}

async function fetchGateways(wsId: string): Promise<{ items: GatewaySummary[] }> {
  return fetchJson(
    `/v1/workspaces/${wsId}/robotics/gateways`,
    undefined,
    'Failed to fetch gateways',
  );
}

export function useGateways(wsId: string, options: RoboticsQueryOptions = {}) {
  return useOfflineQuery({
    queryKey: ['gateways', wsId],
    cacheKey: `gateways:${wsId}`,
    queryFn: () => fetchGateways(wsId),
    enabled: shouldEnableRoboticsQuery(wsId, options.enabled),
  });
}

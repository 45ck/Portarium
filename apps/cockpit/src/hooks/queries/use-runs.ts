import type { RunSummary } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

async function fetchRuns(wsId: string): Promise<{ items: RunSummary[] }> {
  return controlPlaneClient.listRuns(wsId);
}

async function fetchRun(wsId: string, runId: string): Promise<RunSummary> {
  return controlPlaneClient.getRun(wsId, runId);
}

export function useRuns(wsId: string) {
  return useOfflineQuery({
    queryKey: ['runs', wsId],
    cacheKey: `runs:${wsId}`,
    queryFn: () => fetchRuns(wsId),
    enabled: Boolean(wsId),
  });
}

export function useRun(wsId: string, runId: string) {
  return useOfflineQuery({
    queryKey: ['runs', wsId, runId],
    cacheKey: `runs:${wsId}:${runId}`,
    queryFn: () => fetchRun(wsId, runId),
    enabled: Boolean(wsId) && Boolean(runId),
  });
}

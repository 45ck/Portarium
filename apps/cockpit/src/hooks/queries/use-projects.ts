import type { ProjectSummary } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

async function fetchProjects(wsId: string): Promise<{ items: ProjectSummary[] }> {
  return controlPlaneClient.listProjects(wsId);
}

export function useProjects(wsId: string) {
  return useOfflineQuery({
    queryKey: ['projects', wsId],
    cacheKey: `projects:${wsId}`,
    queryFn: () => fetchProjects(wsId),
    enabled: Boolean(wsId),
  });
}

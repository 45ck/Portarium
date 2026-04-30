import type { WorkforceMemberSummary, WorkforceQueueSummary } from '@portarium/cockpit-types';
import { fetchJson } from '@/lib/fetch-json';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

async function fetchWorkforceMembers(wsId: string): Promise<{ items: WorkforceMemberSummary[] }> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/workforce`,
    undefined,
    'Failed to fetch workforce members',
  );
}

async function fetchWorkforceQueues(wsId: string): Promise<{ items: WorkforceQueueSummary[] }> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/workforce/queues`,
    undefined,
    'Failed to fetch workforce queues',
  );
}

export function useWorkforceMembers(wsId: string) {
  return useOfflineQuery({
    queryKey: ['workforce-members', wsId],
    cacheKey: `workforce-members:${wsId}`,
    queryFn: () => fetchWorkforceMembers(wsId),
    enabled: Boolean(wsId),
  });
}

export function useWorkforceQueues(wsId: string) {
  return useOfflineQuery({
    queryKey: ['workforce-queues', wsId],
    cacheKey: `workforce-queues:${wsId}`,
    queryFn: () => fetchWorkforceQueues(wsId),
    enabled: Boolean(wsId),
  });
}

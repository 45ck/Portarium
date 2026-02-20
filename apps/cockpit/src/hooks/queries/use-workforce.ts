import { useQuery } from '@tanstack/react-query';
import type { WorkforceMemberSummary, WorkforceQueueSummary } from '@portarium/cockpit-types';

async function fetchWorkforceMembers(wsId: string): Promise<{ items: WorkforceMemberSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/workforce/members`);
  if (!res.ok) throw new Error('Failed to fetch workforce members');
  return res.json();
}

async function fetchWorkforceQueues(wsId: string): Promise<{ items: WorkforceQueueSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/workforce/queues`);
  if (!res.ok) throw new Error('Failed to fetch workforce queues');
  return res.json();
}

export function useWorkforceMembers(wsId: string) {
  return useQuery({
    queryKey: ['workforce-members', wsId],
    queryFn: () => fetchWorkforceMembers(wsId),
  });
}

export function useWorkforceQueues(wsId: string) {
  return useQuery({
    queryKey: ['workforce-queues', wsId],
    queryFn: () => fetchWorkforceQueues(wsId),
  });
}

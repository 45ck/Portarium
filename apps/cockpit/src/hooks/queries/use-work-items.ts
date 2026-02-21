import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkItemSummary, UpdateWorkItemCommand } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

async function fetchWorkItems(wsId: string): Promise<{ items: WorkItemSummary[] }> {
  return controlPlaneClient.listWorkItems(wsId);
}

async function fetchWorkItem(wsId: string, wiId: string): Promise<WorkItemSummary> {
  return controlPlaneClient.getWorkItem(wsId, wiId);
}

async function patchWorkItem(
  wsId: string,
  wiId: string,
  body: UpdateWorkItemCommand,
): Promise<WorkItemSummary> {
  return controlPlaneClient.updateWorkItem(wsId, wiId, body);
}

export function useWorkItems(wsId: string) {
  return useQuery({ queryKey: ['work-items', wsId], queryFn: () => fetchWorkItems(wsId) });
}

export function useWorkItem(wsId: string, wiId: string) {
  return useQuery({
    queryKey: ['work-items', wsId, wiId],
    queryFn: () => fetchWorkItem(wsId, wiId),
  });
}

export function useUpdateWorkItem(wsId: string, wiId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorkItemCommand) => patchWorkItem(wsId, wiId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-items', wsId] });
      qc.invalidateQueries({ queryKey: ['work-items', wsId, wiId] });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalSummary, ApprovalDecisionRequest } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

async function fetchApprovals(wsId: string): Promise<{ items: ApprovalSummary[] }> {
  return controlPlaneClient.listApprovals(wsId);
}

async function fetchApproval(wsId: string, id: string): Promise<ApprovalSummary> {
  return controlPlaneClient.getApproval(wsId, id);
}

async function postApprovalDecision(
  wsId: string,
  id: string,
  body: ApprovalDecisionRequest,
): Promise<ApprovalSummary> {
  return controlPlaneClient.decideApproval(wsId, id, body);
}

export function useApprovals(wsId: string) {
  return useOfflineQuery({
    queryKey: ['approvals', wsId],
    cacheKey: `approvals:${wsId}`,
    queryFn: () => fetchApprovals(wsId),
    enabled: Boolean(wsId),
  });
}

export function useApproval(wsId: string, id: string) {
  return useOfflineQuery({
    queryKey: ['approvals', wsId, id],
    cacheKey: `approvals:${wsId}:${id}`,
    queryFn: () => fetchApproval(wsId, id),
    enabled: Boolean(wsId) && Boolean(id),
  });
}

export function useApprovalDecision(wsId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApprovalDecisionRequest) => postApprovalDecision(wsId, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals', wsId] });
    },
  });
}

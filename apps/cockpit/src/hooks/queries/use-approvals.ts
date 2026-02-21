import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalSummary, ApprovalDecisionRequest } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

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
  return useQuery({ queryKey: ['approvals', wsId], queryFn: () => fetchApprovals(wsId) });
}

export function useApproval(wsId: string, id: string) {
  return useQuery({ queryKey: ['approvals', wsId, id], queryFn: () => fetchApproval(wsId, id) });
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

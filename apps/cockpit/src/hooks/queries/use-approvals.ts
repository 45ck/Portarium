import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApprovalSummary, ApprovalDecisionRequest } from '@portarium/cockpit-types';

async function fetchApprovals(wsId: string): Promise<{ items: ApprovalSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/approvals`);
  if (!res.ok) throw new Error('Failed to fetch approvals');
  return res.json();
}

async function fetchApproval(wsId: string, id: string): Promise<ApprovalSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/approvals/${id}`);
  if (!res.ok) throw new Error('Approval not found');
  return res.json();
}

async function postApprovalDecision(
  wsId: string,
  id: string,
  body: ApprovalDecisionRequest,
): Promise<ApprovalSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/approvals/${id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to submit decision');
  return res.json();
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

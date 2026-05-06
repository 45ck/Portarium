import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ApprovalSummary,
  ApprovalDecisionRequest,
  CreateApprovalRequest,
} from '@portarium/cockpit-types';
import {
  controlPlaneClient,
  type ProposeAgentActionRequest,
  type ProposeAgentActionResponse,
} from '@/lib/control-plane-client';
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

async function postApproval(wsId: string, body: CreateApprovalRequest): Promise<ApprovalSummary> {
  return controlPlaneClient.createApproval(wsId, body);
}

async function postAgentActionProposal(
  wsId: string,
  body: ProposeAgentActionRequest,
): Promise<ProposeAgentActionResponse> {
  return controlPlaneClient.proposeAgentAction(wsId, body);
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

export function useCreateApproval(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateApprovalRequest) => postApproval(wsId, body),
    onSuccess: (approval) => {
      qc.invalidateQueries({ queryKey: ['approvals', wsId] });
      qc.setQueryData(['approvals', wsId, approval.approvalId], approval);
    },
  });
}

export function useProposeAgentAction(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposeAgentActionRequest) => postAgentActionProposal(wsId, body),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['approvals', wsId] });
      if (result.approvalId) {
        qc.invalidateQueries({ queryKey: ['approvals', wsId, result.approvalId] });
      }
      qc.invalidateQueries({ queryKey: ['evidence', wsId] });
    },
  });
}

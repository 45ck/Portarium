import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  controlPlaneClient,
  type ApprovePolicyChangeRequest,
  type PolicyChangeOutput,
  type PolicyChangeRecord,
  type ProposePolicyChangeRequest,
} from '@/lib/control-plane-client';

async function fetchPolicyChanges(
  wsId: string,
  policyId: string,
): Promise<{ items: PolicyChangeRecord[] }> {
  return controlPlaneClient.listPolicyChanges(wsId, { policyId, limit: 10 });
}

async function postPolicyChangeProposal(
  wsId: string,
  body: ProposePolicyChangeRequest,
): Promise<PolicyChangeOutput> {
  return controlPlaneClient.proposePolicyChange(wsId, body, {
    idempotencyKey: `policy-change-${body.policyId}-${Date.now()}`,
  });
}

async function postPolicyChangeApproval(
  wsId: string,
  policyChangeId: string,
  body: ApprovePolicyChangeRequest,
): Promise<PolicyChangeOutput> {
  return controlPlaneClient.approvePolicyChange(wsId, policyChangeId, body);
}

export function usePolicyChanges(wsId: string, policyId: string) {
  return useQuery({
    queryKey: ['policy-changes', wsId, policyId],
    queryFn: () => fetchPolicyChanges(wsId, policyId),
    enabled: Boolean(wsId) && Boolean(policyId),
  });
}

export function useProposePolicyChange(wsId: string, policyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposePolicyChangeRequest) => postPolicyChangeProposal(wsId, body),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['policy-changes', wsId, policyId] });
      qc.setQueryData(['policy-changes', wsId, policyId, result.policyChangeId], result);
      qc.invalidateQueries({ queryKey: ['evidence', wsId] });
      if (result.status === 'Applied') {
        qc.invalidateQueries({ queryKey: ['policies', wsId] });
      }
    },
  });
}

export function useApprovePolicyChange(wsId: string, policyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      policyChangeId,
      body,
    }: {
      policyChangeId: string;
      body: ApprovePolicyChangeRequest;
    }) => postPolicyChangeApproval(wsId, policyChangeId, body),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['policy-changes', wsId, policyId] });
      qc.setQueryData(['policy-changes', wsId, policyId, result.policyChangeId], result);
      qc.invalidateQueries({ queryKey: ['policies', wsId] });
      qc.invalidateQueries({ queryKey: ['evidence', wsId] });
    },
  });
}

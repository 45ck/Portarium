import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ApprovalCoverageRosterSummary,
  CreateApprovalCoverageWindowRequest,
  CreateApprovalDelegationRequest,
  UpsertApprovalSpecialistRoutingRuleRequest,
  WorkforceMemberSummary,
  WorkforceQueueSummary,
} from '@portarium/cockpit-types';
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

async function fetchApprovalCoverageRoster(wsId: string): Promise<ApprovalCoverageRosterSummary> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/workforce/approval-coverage`,
    undefined,
    'Failed to fetch approval coverage roster',
  );
}

async function postApprovalCoverageWindow(
  wsId: string,
  body: CreateApprovalCoverageWindowRequest,
): Promise<ApprovalCoverageRosterSummary> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/workforce/approval-coverage/windows`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Failed to save approval coverage window',
  );
}

async function postApprovalDelegation(
  wsId: string,
  body: CreateApprovalDelegationRequest,
): Promise<ApprovalCoverageRosterSummary> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/workforce/approval-coverage/delegations`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Failed to save approval delegation',
  );
}

async function postApprovalSpecialistRoute(
  wsId: string,
  body: UpsertApprovalSpecialistRoutingRuleRequest,
): Promise<ApprovalCoverageRosterSummary> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/workforce/approval-coverage/specialist-routes`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Failed to save specialist routing rule',
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

export function useApprovalCoverageRoster(wsId: string) {
  return useOfflineQuery({
    queryKey: ['approval-coverage-roster', wsId],
    cacheKey: `approval-coverage-roster:${wsId}`,
    queryFn: () => fetchApprovalCoverageRoster(wsId),
    enabled: Boolean(wsId),
  });
}

export function useApprovalCoverageMutations(wsId: string) {
  const queryClient = useQueryClient();

  function onSuccess(data: ApprovalCoverageRosterSummary) {
    queryClient.setQueryData(['approval-coverage-roster', wsId], data);
    queryClient.invalidateQueries({ queryKey: ['approval-coverage-roster', wsId] });
  }

  return {
    createWindow: useMutation({
      mutationFn: (body: CreateApprovalCoverageWindowRequest) =>
        postApprovalCoverageWindow(wsId, body),
      onSuccess,
    }),
    createDelegation: useMutation({
      mutationFn: (body: CreateApprovalDelegationRequest) => postApprovalDelegation(wsId, body),
      onSuccess,
    }),
    upsertSpecialistRoute: useMutation({
      mutationFn: (body: UpsertApprovalSpecialistRoutingRuleRequest) =>
        postApprovalSpecialistRoute(wsId, body),
      onSuccess,
    }),
  };
}

export function useWorkforceQueues(wsId: string) {
  return useOfflineQuery({
    queryKey: ['workforce-queues', wsId],
    cacheKey: `workforce-queues:${wsId}`,
    queryFn: () => fetchWorkforceQueues(wsId),
    enabled: Boolean(wsId),
  });
}

import { useQuery } from '@tanstack/react-query';
import type { PolicySummary, SodConstraint } from '@portarium/cockpit-types';
import { fetchJson } from '@/lib/fetch-json';

type PolicyV1 = Readonly<{
  policyId: string;
  name: string;
  description?: string;
  active: boolean;
  rules?: readonly { ruleId: string; condition: string; effect: 'Allow' | 'Deny' }[];
}>;

type PolicyRecord = PolicyV1 | PolicySummary;

function toPolicySummary(policy: PolicyRecord): PolicySummary {
  if ('status' in policy && 'ruleText' in policy && 'conditions' in policy) return policy;
  const rules = policy.rules ?? [];
  return {
    policyId: policy.policyId,
    name: policy.name,
    description: policy.description ?? '',
    status: policy.active ? 'Active' : 'Archived',
    ruleCount: rules.length,
    ruleText: rules.map((rule) => `${rule.effect.toUpperCase()} WHEN ${rule.condition}`).join('\n'),
    conditions: [],
  };
}

async function fetchPolicies(wsId: string): Promise<{ items: PolicySummary[] }> {
  const body = await fetchJson<{ items: PolicyRecord[] }>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/policies`,
    undefined,
    'Failed to fetch policies',
  );
  return { ...body, items: body.items.map(toPolicySummary) };
}

async function fetchPolicy(wsId: string, policyId: string): Promise<PolicySummary> {
  const policy = await fetchJson<PolicyRecord>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/policies/${encodeURIComponent(policyId)}`,
    undefined,
    'Policy not found',
  );
  return toPolicySummary(policy);
}

async function fetchSodConstraints(wsId: string): Promise<{ items: SodConstraint[] }> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/sod-constraints`,
    undefined,
    'Failed to fetch SoD constraints',
  );
}

export function usePolicies(wsId: string) {
  return useQuery({
    queryKey: ['policies', wsId],
    queryFn: () => fetchPolicies(wsId),
    enabled: Boolean(wsId),
  });
}

export function usePolicy(wsId: string, policyId: string) {
  return useQuery({
    queryKey: ['policies', wsId, policyId],
    queryFn: () => fetchPolicy(wsId, policyId),
    enabled: !!policyId,
  });
}

export function useSodConstraints(wsId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['sod-constraints', wsId],
    queryFn: () => fetchSodConstraints(wsId),
    enabled: Boolean(wsId) && (options.enabled ?? true),
  });
}

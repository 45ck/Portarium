import { useQuery } from '@tanstack/react-query';
import type { PolicySummary, SodConstraint } from '@portarium/cockpit-types';

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
  const res = await fetch(`/v1/workspaces/${wsId}/policies`);
  if (!res.ok) throw new Error('Failed to fetch policies');
  const body = (await res.json()) as { items: PolicyRecord[] };
  return { ...body, items: body.items.map(toPolicySummary) };
}

async function fetchPolicy(wsId: string, policyId: string): Promise<PolicySummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/policies/${policyId}`);
  if (!res.ok) throw new Error('Policy not found');
  return toPolicySummary((await res.json()) as PolicyRecord);
}

async function fetchSodConstraints(wsId: string): Promise<{ items: SodConstraint[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/policies`);
  if (!res.ok) throw new Error('Failed to fetch SoD constraints');
  return { items: [] };
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

export function useSodConstraints(wsId: string) {
  return useQuery({
    queryKey: ['sod-constraints', wsId],
    queryFn: () => fetchSodConstraints(wsId),
    enabled: Boolean(wsId),
  });
}

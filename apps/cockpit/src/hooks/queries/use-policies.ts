import { useQuery } from '@tanstack/react-query'
import type { PolicySummary, SodConstraint } from '@portarium/cockpit-types'

async function fetchPolicies(wsId: string): Promise<{ items: PolicySummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/policies`)
  if (!res.ok) throw new Error('Failed to fetch policies')
  return res.json()
}

async function fetchPolicy(wsId: string, policyId: string): Promise<PolicySummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/policies/${policyId}`)
  if (!res.ok) throw new Error('Policy not found')
  return res.json()
}

async function fetchSodConstraints(wsId: string): Promise<{ items: SodConstraint[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/sod-constraints`)
  if (!res.ok) throw new Error('Failed to fetch SoD constraints')
  return res.json()
}

export function usePolicies(wsId: string) {
  return useQuery({
    queryKey: ['policies', wsId],
    queryFn: () => fetchPolicies(wsId),
    enabled: Boolean(wsId),
  })
}

export function usePolicy(wsId: string, policyId: string) {
  return useQuery({
    queryKey: ['policies', wsId, policyId],
    queryFn: () => fetchPolicy(wsId, policyId),
    enabled: !!policyId,
  })
}

export function useSodConstraints(wsId: string) {
  return useQuery({
    queryKey: ['sod-constraints', wsId],
    queryFn: () => fetchSodConstraints(wsId),
    enabled: Boolean(wsId),
  })
}

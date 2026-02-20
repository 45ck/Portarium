import { useQuery } from '@tanstack/react-query';
import type { SafetyConstraint, ApprovalThreshold, EStopAuditEntry } from '@/types/robotics';

async function fetchConstraints(wsId: string): Promise<{ items: SafetyConstraint[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/safety/constraints`);
  if (!res.ok) throw new Error('Failed to fetch constraints');
  return res.json();
}

async function fetchThresholds(wsId: string): Promise<{ items: ApprovalThreshold[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/safety/thresholds`);
  if (!res.ok) throw new Error('Failed to fetch thresholds');
  return res.json();
}

async function fetchEStopLog(wsId: string): Promise<{ items: EStopAuditEntry[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/safety/estop-log`);
  if (!res.ok) throw new Error('Failed to fetch E-Stop log');
  return res.json();
}

export function useSafetyConstraints(wsId: string) {
  return useQuery({
    queryKey: ['safety-constraints', wsId],
    queryFn: () => fetchConstraints(wsId),
  });
}

export function useApprovalThresholds(wsId: string) {
  return useQuery({
    queryKey: ['approval-thresholds', wsId],
    queryFn: () => fetchThresholds(wsId),
  });
}

export function useEStopLog(wsId: string) {
  return useQuery({ queryKey: ['estop-log', wsId], queryFn: () => fetchEStopLog(wsId) });
}

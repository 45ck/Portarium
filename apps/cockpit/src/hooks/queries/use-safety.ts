import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

async function fetchEstopStatus(wsId: string): Promise<{ active: boolean }> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/safety/estop`);
  if (!res.ok) throw new Error('Failed to fetch E-Stop status');
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

export function useGlobalEstopStatus(wsId: string) {
  return useQuery({
    queryKey: ['estop-status', wsId],
    queryFn: () => fetchEstopStatus(wsId),
    enabled: Boolean(wsId),
  });
}

export function useSetEstop(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (actor: string) => {
      const res = await fetch(`/v1/workspaces/${wsId}/robotics/safety/estop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor }),
      });
      if (!res.ok) throw new Error('Failed to activate E-Stop');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estop-status', wsId] });
      qc.invalidateQueries({ queryKey: ['estop-log', wsId] });
    },
  });
}

export function useClearEstop(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ actor, rationale }: { actor: string; rationale: string }) => {
      const res = await fetch(`/v1/workspaces/${wsId}/robotics/safety/estop`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor, rationale }),
      });
      if (!res.ok) throw new Error('Failed to clear E-Stop');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estop-status', wsId] });
      qc.invalidateQueries({ queryKey: ['estop-log', wsId] });
    },
  });
}

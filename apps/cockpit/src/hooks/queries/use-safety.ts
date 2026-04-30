import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SafetyConstraint, ApprovalThreshold, EStopAuditEntry } from '@/types/robotics';
import { fetchJson } from '@/lib/fetch-json';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

async function fetchConstraints(wsId: string): Promise<{ items: SafetyConstraint[] }> {
  return fetchJson(
    `/v1/workspaces/${wsId}/robotics/safety/constraints`,
    undefined,
    'Failed to fetch constraints',
  );
}

async function fetchThresholds(wsId: string): Promise<{ items: ApprovalThreshold[] }> {
  return fetchJson(
    `/v1/workspaces/${wsId}/robotics/safety/thresholds`,
    undefined,
    'Failed to fetch thresholds',
  );
}

async function fetchEStopLog(wsId: string): Promise<{ items: EStopAuditEntry[] }> {
  return fetchJson(
    `/v1/workspaces/${wsId}/robotics/safety/estop-log`,
    undefined,
    'Failed to fetch E-Stop log',
  );
}

async function fetchEstopStatus(wsId: string): Promise<{ active: boolean }> {
  return fetchJson(
    `/v1/workspaces/${wsId}/robotics/safety/estop`,
    undefined,
    'Failed to fetch E-Stop status',
  );
}

export function useSafetyConstraints(wsId: string) {
  return useOfflineQuery({
    queryKey: ['safety-constraints', wsId],
    cacheKey: `safety-constraints:${wsId}`,
    queryFn: () => fetchConstraints(wsId),
    enabled: Boolean(wsId),
  });
}

export function useApprovalThresholds(wsId: string) {
  return useOfflineQuery({
    queryKey: ['approval-thresholds', wsId],
    cacheKey: `approval-thresholds:${wsId}`,
    queryFn: () => fetchThresholds(wsId),
    enabled: Boolean(wsId),
  });
}

export function useEStopLog(wsId: string) {
  return useOfflineQuery({
    queryKey: ['estop-log', wsId],
    cacheKey: `estop-log:${wsId}`,
    queryFn: () => fetchEStopLog(wsId),
    enabled: Boolean(wsId),
  });
}

export function useGlobalEstopStatus(wsId: string) {
  return useOfflineQuery({
    queryKey: ['estop-status', wsId],
    cacheKey: `estop-status:${wsId}`,
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

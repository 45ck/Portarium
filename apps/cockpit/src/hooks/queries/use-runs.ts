import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RunSummary, StartRunRequest } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

async function fetchRuns(wsId: string): Promise<{ items: RunSummary[] }> {
  return controlPlaneClient.listRuns(wsId);
}

async function fetchRun(wsId: string, runId: string): Promise<RunSummary> {
  return controlPlaneClient.getRun(wsId, runId);
}

async function postRun(wsId: string, body: StartRunRequest): Promise<RunSummary> {
  return controlPlaneClient.startRun(wsId, body);
}

async function postRunCancellation(wsId: string, runId: string): Promise<RunSummary> {
  return controlPlaneClient.cancelRun(wsId, runId);
}

export function useRuns(wsId: string) {
  return useOfflineQuery({
    queryKey: ['runs', wsId],
    cacheKey: `runs:${wsId}`,
    queryFn: () => fetchRuns(wsId),
    enabled: Boolean(wsId),
  });
}

export function useRun(wsId: string, runId: string) {
  return useOfflineQuery({
    queryKey: ['runs', wsId, runId],
    cacheKey: `runs:${wsId}:${runId}`,
    queryFn: () => fetchRun(wsId, runId),
    enabled: Boolean(wsId) && Boolean(runId),
  });
}

export function useStartRun(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartRunRequest) => postRun(wsId, body),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['runs', wsId] });
      qc.setQueryData(['runs', wsId, run.runId], run);
    },
  });
}

export function useCancelRun(wsId: string, runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postRunCancellation(wsId, runId),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['runs', wsId] });
      qc.setQueryData(['runs', wsId, runId], run);
    },
  });
}

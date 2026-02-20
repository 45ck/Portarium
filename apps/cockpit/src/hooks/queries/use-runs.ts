import { useQuery } from '@tanstack/react-query';
import type { RunSummary } from '@portarium/cockpit-types';

async function fetchRuns(wsId: string): Promise<{ items: RunSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/runs`);
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json();
}

async function fetchRun(wsId: string, runId: string): Promise<RunSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/runs/${runId}`);
  if (!res.ok) throw new Error('Run not found');
  return res.json();
}

export function useRuns(wsId: string) {
  return useQuery({
    queryKey: ['runs', wsId],
    queryFn: () => fetchRuns(wsId),
    enabled: Boolean(wsId),
  });
}

export function useRun(wsId: string, runId: string) {
  return useQuery({
    queryKey: ['runs', wsId, runId],
    queryFn: () => fetchRun(wsId, runId),
    enabled: Boolean(wsId) && Boolean(runId),
  });
}

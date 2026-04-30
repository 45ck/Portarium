import type {
  CursorPaginationRequest,
  EvidenceEntry,
  ListEvidenceRequest,
} from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

async function fetchEvidence(
  wsId: string,
  request: ListEvidenceRequest = {},
): Promise<{ items: EvidenceEntry[] }> {
  return controlPlaneClient.listEvidence(wsId, request);
}

async function fetchRunEvidence(
  wsId: string,
  runId: string,
  request: CursorPaginationRequest = {},
): Promise<{ items: EvidenceEntry[] }> {
  return controlPlaneClient.listRunEvidence(wsId, runId, request);
}

export function useEvidence(wsId: string, request: ListEvidenceRequest = {}) {
  const cacheKey = `evidence:${wsId}:${JSON.stringify(request)}`;
  return useOfflineQuery({
    queryKey: ['evidence', wsId, request],
    cacheKey,
    queryFn: () => fetchEvidence(wsId, request),
    enabled: Boolean(wsId),
  });
}

export function useRunEvidence(
  wsId: string,
  runId: string | undefined,
  request: CursorPaginationRequest = {},
) {
  const cacheKey = `run-evidence:${wsId}:${runId ?? 'none'}:${JSON.stringify(request)}`;
  return useOfflineQuery({
    queryKey: ['run-evidence', wsId, runId, request],
    cacheKey,
    queryFn: () => fetchRunEvidence(wsId, runId!, request),
    enabled: Boolean(wsId) && Boolean(runId),
  });
}

import { useQuery } from '@tanstack/react-query';
import type {
  CursorPaginationRequest,
  EvidenceEntry,
  ListEvidenceRequest,
} from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

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
  return useQuery({
    queryKey: ['evidence', wsId, request],
    queryFn: () => fetchEvidence(wsId, request),
    enabled: Boolean(wsId),
  });
}

export function useRunEvidence(
  wsId: string,
  runId: string | undefined,
  request: CursorPaginationRequest = {},
) {
  return useQuery({
    queryKey: ['run-evidence', wsId, runId, request],
    queryFn: () => fetchRunEvidence(wsId, runId!, request),
    enabled: Boolean(wsId) && Boolean(runId),
  });
}

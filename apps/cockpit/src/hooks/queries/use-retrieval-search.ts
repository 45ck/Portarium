import { useMutation } from '@tanstack/react-query';
import type { RetrievalSearchRequest, RetrievalSearchResponse } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

export function useRetrievalSearch(workspaceId: string) {
  return useMutation<RetrievalSearchResponse, Error, RetrievalSearchRequest>({
    mutationFn: (request) => controlPlaneClient.searchRetrieval(workspaceId, request),
  });
}

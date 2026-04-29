import { useQuery } from '@tanstack/react-query';
import type { DiffHunk } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

export function useBeadDiff(workspaceId: string, beadId: string) {
  return useQuery({
    queryKey: ['bead-diff', workspaceId, beadId],
    queryFn: () => controlPlaneClient.getBeadDiff(workspaceId, beadId),
    enabled: Boolean(workspaceId) && Boolean(beadId),
  });
}

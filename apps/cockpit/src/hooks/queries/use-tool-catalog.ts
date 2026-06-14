import { useQuery } from '@tanstack/react-query';
import type { ToolCatalogResponse } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

async function fetchToolCatalog(wsId: string): Promise<ToolCatalogResponse> {
  return controlPlaneClient.listToolCatalog(wsId);
}

export function useToolCatalog(wsId: string) {
  return useQuery({
    queryKey: ['tool-catalog', wsId],
    queryFn: () => fetchToolCatalog(wsId),
    enabled: Boolean(wsId),
  });
}

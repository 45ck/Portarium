import { useQuery } from '@tanstack/react-query';
import type { CockpitExtensionContextResponse } from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

async function fetchCockpitExtensionContext(
  wsId: string,
): Promise<CockpitExtensionContextResponse> {
  return controlPlaneClient.getCockpitExtensionContext(wsId);
}

export function useCockpitExtensionContext(wsId: string) {
  return useQuery({
    queryKey: ['cockpit-extension-context', wsId],
    queryFn: () => fetchCockpitExtensionContext(wsId),
    enabled: Boolean(wsId),
  });
}

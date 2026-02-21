import { useQuery } from '@tanstack/react-query';
import type { WorkspacePackUiRuntime } from '@/lib/packs/types';

async function fetchPackUiRuntime(wsId: string): Promise<WorkspacePackUiRuntime> {
  const res = await fetch(`/v1/workspaces/${wsId}/pack-ui-runtime`);
  if (!res.ok) throw new Error('Failed to fetch pack UI runtime');
  return res.json();
}

export function usePackUiRuntime(wsId: string) {
  return useQuery({
    queryKey: ['pack-ui-runtime', wsId],
    queryFn: () => fetchPackUiRuntime(wsId),
    enabled: Boolean(wsId),
  });
}

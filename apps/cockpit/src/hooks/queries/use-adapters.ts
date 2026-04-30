import type { AdapterSummary } from '@portarium/cockpit-types';
import { fetchJson } from '@/lib/fetch-json';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

type AdapterRegistration = Readonly<{
  adapterId: string;
  name?: string;
  sorFamily?: string;
  status?: AdapterSummary['status'];
  lastSyncIso?: string;
  providerSlug: string;
  portFamily: string;
  enabled: boolean;
}>;

function toAdapterSummary(adapter: AdapterRegistration): AdapterSummary {
  if (adapter.name && adapter.sorFamily && adapter.status && adapter.lastSyncIso) {
    return adapter as AdapterSummary;
  }
  return {
    adapterId: adapter.adapterId,
    name: adapter.providerSlug,
    sorFamily: adapter.portFamily,
    status: adapter.enabled ? 'healthy' : 'unhealthy',
    lastSyncIso: new Date(0).toISOString(),
  };
}

async function fetchAdapters(wsId: string): Promise<{ items: AdapterSummary[] }> {
  const body = await fetchJson<{ items: AdapterRegistration[] }>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/adapter-registrations`,
    undefined,
    'Failed to fetch adapters',
  );
  return { ...body, items: body.items.map(toAdapterSummary) };
}

export function useAdapters(wsId: string) {
  return useOfflineQuery({
    queryKey: ['adapters', wsId],
    cacheKey: `adapters:${wsId}`,
    queryFn: () => fetchAdapters(wsId),
    enabled: Boolean(wsId),
  });
}

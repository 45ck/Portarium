import { useQuery } from '@tanstack/react-query';
import type { AdapterSummary } from '@portarium/cockpit-types';

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
  const res = await fetch(`/v1/workspaces/${wsId}/adapter-registrations`);
  if (!res.ok) throw new Error('Failed to fetch adapters');
  const body = (await res.json()) as { items: AdapterRegistration[] };
  return { ...body, items: body.items.map(toAdapterSummary) };
}

export function useAdapters(wsId: string) {
  return useQuery({
    queryKey: ['adapters', wsId],
    queryFn: () => fetchAdapters(wsId),
    enabled: Boolean(wsId),
  });
}

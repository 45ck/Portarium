import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline';
import type { EvidenceEntry } from '@portarium/cockpit-types';

function ExploreEventsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['evidence', wsId],
    queryFn: async () => {
      const r = await fetch(`/v1/workspaces/${wsId}/evidence`);
      if (!r.ok) throw new Error('Failed to fetch evidence');
      return r.json() as Promise<{ items: EvidenceEntry[] }>;
    },
    refetchInterval: 5000,
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Events"
        description="Live event stream — refreshes every 5 seconds"
        icon={<EntityIcon entityType="event" size="md" decorative />}
      />

      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <span className="text-xs font-medium text-green-600">LIVE</span>
        {dataUpdatedAt > 0 && (
          <span className="text-xs text-muted-foreground">
            Last updated {Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago
          </span>
        )}
      </div>

      <EvidenceTimeline entries={data?.items ?? []} loading={isLoading} />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/events',
  component: ExploreEventsPage,
});

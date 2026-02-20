import { useMemo, lazy, Suspense } from 'react';
import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { Skeleton } from '@/components/ui/skeleton';

const ObservabilityChart = lazy(() =>
  import('./observability-chart').then((m) => ({ default: m.ObservabilityChart })),
);

interface ObservabilityData {
  runsOverTime: {
    date: string;
    succeeded: number;
    failed: number;
    waitingForApproval: number;
  }[];
  successRate: number;
  avgSlaDays: number;
}

function ExploreObservabilityPage() {
  const { activeWorkspaceId: wsId } = useUIStore();

  const { data, isLoading, isError } = useQuery<ObservabilityData>({
    queryKey: ['observability', wsId],
    queryFn: async () => {
      const r = await fetch(`/v1/workspaces/${wsId}/observability`);
      if (!r.ok) throw new Error('Failed to fetch observability data');
      return r.json();
    },
  });

  const totalRuns = useMemo(() => {
    if (!data?.runsOverTime) return 0;
    return data.runsOverTime.reduce(
      (sum, d) => sum + d.succeeded + d.failed + d.waitingForApproval,
      0,
    );
  }, [data]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Observability"
        description="Run metrics and performance trends"
        icon={<EntityIcon entityType="run" size="md" decorative />}
      />

      {isLoading ? (
        <Skeleton className="h-4 w-1/2" />
      ) : isError ? (
        <div className="text-xs text-destructive">Failed to load observability data.</div>
      ) : data ? (
        <>
          <KpiRow
            stats={[
              { label: 'Success Rate', value: `${data.successRate}%` },
              { label: 'Avg SLA', value: `${data.avgSlaDays} days` },
              { label: 'Total Runs (7d)', value: totalRuns },
            ]}
          />

          <Suspense fallback={<Skeleton className="h-64" />}>
            <ObservabilityChart runsOverTime={data.runsOverTime} />
          </Suspense>
        </>
      ) : null}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/observability',
  component: ExploreObservabilityPage,
});

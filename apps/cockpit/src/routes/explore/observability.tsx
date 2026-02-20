import { useMemo } from 'react';
import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  const { data, isLoading } = useQuery<ObservabilityData>({
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
        <div className="text-xs text-muted-foreground">Loading...</div>
      ) : data ? (
        <>
          <KpiRow
            stats={[
              { label: 'Success Rate', value: `${data.successRate}%` },
              { label: 'Avg SLA', value: `${data.avgSlaDays} days` },
              { label: 'Total Runs (7d)', value: totalRuns },
            ]}
          />

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Runs Over Time (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.runsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="succeeded"
                    stackId="1"
                    stroke="var(--color-chart-1)"
                    fill="var(--color-chart-1)"
                    fillOpacity={0.6}
                    name="Succeeded"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stackId="1"
                    stroke="var(--color-chart-2)"
                    fill="var(--color-chart-2)"
                    fillOpacity={0.6}
                    name="Failed"
                  />
                  <Area
                    type="monotone"
                    dataKey="waitingForApproval"
                    stackId="1"
                    stroke="var(--color-chart-3)"
                    fill="var(--color-chart-3)"
                    fillOpacity={0.6}
                    name="Waiting"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
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

import { createRoute, Link, useNavigate } from '@tanstack/react-router';
import { format, differenceInMinutes } from 'date-fns';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useRuns } from '@/hooks/queries/use-runs';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { FilterBar } from '@/components/cockpit/filter-bar';
import { DataTable } from '@/components/cockpit/data-table';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RunSummary } from '@portarium/cockpit-types';

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Running', value: 'Running' },
  { label: 'Waiting for Approval', value: 'WaitingForApproval' },
  { label: 'Paused', value: 'Paused' },
  { label: 'Succeeded', value: 'Succeeded' },
  { label: 'Failed', value: 'Failed' },
  { label: 'Cancelled', value: 'Cancelled' },
];

const TIER_OPTIONS = [
  { label: 'Auto', value: 'Auto' },
  { label: 'Assisted', value: 'Assisted' },
  { label: 'Human Approve', value: 'HumanApprove' },
  { label: 'Manual Only', value: 'ManualOnly' },
];

function formatDuration(startedAtIso?: string, endedAtIso?: string): string {
  if (!startedAtIso || !endedAtIso) return '-';
  const mins = differenceInMinutes(new Date(endedAtIso), new Date(startedAtIso));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

interface RunsSearch {
  status?: string;
  tier?: string;
}

function RunsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();
  const search = Route.useSearch() as RunsSearch;
  const filterValues: Record<string, string> = {
    status: search.status ?? 'all',
    tier: search.tier ?? 'all',
  };

  const { data, isLoading, isError, refetch } = useRuns(wsId);
  const items = data?.items ?? [];

  const filtered = items.filter((run) => {
    if (filterValues.status && filterValues.status !== 'all' && run.status !== filterValues.status)
      return false;
    if (filterValues.tier && filterValues.tier !== 'all' && run.executionTier !== filterValues.tier)
      return false;
    return true;
  });

  const columns = [
    {
      key: 'runId',
      header: 'Run ID',
      width: '120px',
      render: (row: RunSummary) => (
        <span className="font-mono" title={row.runId}>
          {row.runId.slice(0, 12)}
        </span>
      ),
    },
    {
      key: 'workflowId',
      header: 'Workflow',
      render: (row: RunSummary) => (
        <Link
          to={'/workflows/$workflowId' as string}
          params={{ workflowId: row.workflowId }}
          className="font-mono text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.workflowId}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row: RunSummary) => <RunStatusBadge status={row.status} />,
    },
    {
      key: 'executionTier',
      header: 'Tier',
      width: '140px',
      render: (row: RunSummary) => <ExecutionTierBadge tier={row.executionTier} />,
    },
    {
      key: 'startedAtIso',
      header: 'Started',
      width: '140px',
      render: (row: RunSummary) =>
        row.startedAtIso ? format(new Date(row.startedAtIso), 'MMM d, HH:mm') : '-',
    },
    {
      key: 'duration',
      header: 'Duration',
      width: '100px',
      render: (row: RunSummary) => formatDuration(row.startedAtIso, row.endedAtIso),
    },
  ];

  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Runs" icon={<EntityIcon entityType="run" size="md" decorative />} />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load runs</p>
            <p className="text-xs text-muted-foreground">An error occurred while fetching data.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Runs" icon={<EntityIcon entityType="run" size="md" decorative />} />

      <FilterBar
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          { key: 'tier', label: 'Tier', options: TIER_OPTIONS },
        ]}
        values={filterValues}
        onChange={(key, value) =>
          navigate({
            to: '.' as string,
            search: { ...search, [key]: value === 'all' ? undefined : value } as RunsSearch,
            replace: true,
          })
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        getRowKey={(row) => row.runId}
        onRowClick={(row) =>
          navigate({ to: '/runs/$runId' as string, params: { runId: row.runId } })
        }
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: RunsPage,
  validateSearch: (search: Record<string, unknown>): RunsSearch => ({
    status: typeof search.status === 'string' ? search.status : undefined,
    tier: typeof search.tier === 'string' ? search.tier : undefined,
  }),
});

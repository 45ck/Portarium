import { createRoute, Link, useNavigate } from '@tanstack/react-router';
import { format, differenceInMinutes } from 'date-fns';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { EntityListShell } from '@/components/cockpit/entity-list-shell';
import { EntityIcon } from '@/components/domain/entity-icon';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { useEntityList } from '@/hooks/queries/use-entity-list';
import { useListSearchParams } from '@/hooks/use-list-search-params';
import type { Column } from '@/components/cockpit/data-table';
import type { FilterFieldConfig } from '@/components/cockpit/filter-toolbar';
import type { RunSummary } from '@portarium/cockpit-types';

// ---------------------------------------------------------------------------
// Filter & column config
// ---------------------------------------------------------------------------

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

const FILTER_CONFIG: FilterFieldConfig[] = [
  { key: 'status', label: 'Status', options: STATUS_OPTIONS },
  { key: 'tier', label: 'Tier', options: TIER_OPTIONS },
];

function formatDuration(startedAtIso?: string, endedAtIso?: string): string {
  if (!startedAtIso || !endedAtIso) return '-';
  const mins = differenceInMinutes(new Date(endedAtIso), new Date(startedAtIso));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

const RUN_COLUMNS: Column<RunSummary>[] = [
  {
    key: 'runId',
    header: 'Run ID',
    width: '120px',
    sortable: true,
    render: (row) => (
      <span className="font-mono" title={row.runId}>
        {row.runId.slice(0, 12)}
      </span>
    ),
  },
  {
    key: 'workflowId',
    header: 'Workflow',
    render: (row) => (
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
    sortable: true,
    render: (row) => <RunStatusBadge status={row.status} />,
  },
  {
    key: 'executionTier',
    header: 'Tier',
    width: '140px',
    render: (row) => <ExecutionTierBadge tier={row.executionTier} />,
  },
  {
    key: 'createdAtIso',
    header: 'Created',
    width: '140px',
    sortable: true,
    render: (row) => (row.createdAtIso ? format(new Date(row.createdAtIso), 'MMM d, HH:mm') : '-'),
  },
  {
    key: 'startedAtIso',
    header: 'Started',
    width: '140px',
    sortable: true,
    render: (row) => (row.startedAtIso ? format(new Date(row.startedAtIso), 'MMM d, HH:mm') : '-'),
  },
  {
    key: 'duration',
    header: 'Duration',
    width: '100px',
    render: (row) => formatDuration(row.startedAtIso, row.endedAtIso),
  },
];

// ---------------------------------------------------------------------------
// Search params shape
// ---------------------------------------------------------------------------

interface RunsSearch {
  status?: string;
  tier?: string;
  q?: string;
  sort?: string;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function RunsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();

  const searchParams = useListSearchParams({
    filterKeys: ['status', 'tier'],
    route: Route,
  });

  const list = useEntityList<RunSummary, Record<string, string | undefined>>({
    entityKey: 'runs',
    workspaceId: wsId,
    basePath: `/v1/workspaces/${wsId}/runs`,
    filters: searchParams.filters,
    search: searchParams.search,
    sort: searchParams.sort,
    pageSize: 20,
  });

  return (
    <EntityListShell
      title="Runs"
      icon={<EntityIcon entityType="run" size="md" decorative />}
      columns={RUN_COLUMNS}
      data={list.data}
      isLoading={list.isLoading}
      isError={list.isError}
      onRetry={list.refetch}
      getRowKey={(r) => r.runId}
      onRowClick={(r) => navigate({ to: '/runs/$runId' as string, params: { runId: r.runId } })}
      filterConfig={FILTER_CONFIG}
      filterValues={searchParams.filters}
      onFilterChange={searchParams.setFilter}
      searchValue={searchParams.search}
      onSearchChange={searchParams.setSearch}
      searchPlaceholder="Search runs..."
      sort={searchParams.sort}
      onSortChange={searchParams.setSort}
      serverPagination={{
        pageSize: list.pageSize,
        hasNextPage: list.hasNextPage,
        hasPreviousPage: list.hasPreviousPage,
        onNextPage: list.goToNextPage,
        onPreviousPage: list.goToPreviousPage,
        onPageSizeChange: list.setPageSize,
        totalLabel: list.totalLabel,
      }}
      onClearAll={searchParams.clearAll}
      hasActiveFilters={searchParams.hasActiveFilters}
      hideableColumns={['executionTier', 'startedAtIso', 'duration']}
      emptyTitle="No runs"
      emptyDescription="No workflow runs match your filters."
    />
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: RunsPage,
  validateSearch: (search: Record<string, unknown>): RunsSearch => ({
    status: typeof search.status === 'string' ? search.status : undefined,
    tier: typeof search.tier === 'string' ? search.tier : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
    sort: typeof search.sort === 'string' ? search.sort : undefined,
  }),
});

import { createRoute, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useWorkItems } from '@/hooks/queries/use-work-items';
import { useUsers } from '@/hooks/queries/use-users';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { FilterBar } from '@/components/cockpit/filter-bar';
import { DataTable } from '@/components/cockpit/data-table';
import { OfflineSyncBanner } from '@/components/cockpit/offline-sync-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw } from 'lucide-react';
import type { WorkItemSummary } from '@portarium/cockpit-types';

const STATUS_FILTERS = [
  { label: 'Open', value: 'Open' },
  { label: 'Closed', value: 'Closed' },
];

interface WorkItemsSearch {
  status?: string;
  owner?: string;
}

function WorkItemsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();
  const search = Route.useSearch() as WorkItemsSearch;
  const filterValues: Record<string, string> = {
    status: search.status ?? 'all',
    owner: search.owner ?? 'all',
  };

  const { data, isLoading, isError, refetch, offlineMeta } = useWorkItems(wsId);
  const users = useUsers(wsId);
  const items = data?.items ?? [];
  const userItems = users.data?.items ?? [];

  const ownerFilters = Array.from(
    new Map(
      userItems.map((user) => {
        const label = user.name || user.email || user.userId;
        return [user.userId, { label, value: user.userId }] as const;
      }),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const filtered = items.filter((item) => {
    if (filterValues.status && filterValues.status !== 'all' && item.status !== filterValues.status)
      return false;
    if (
      filterValues.owner &&
      filterValues.owner !== 'all' &&
      item.ownerUserId !== filterValues.owner
    )
      return false;
    return true;
  });

  const columns = [
    {
      key: 'workItemId',
      header: 'ID',
      width: '120px',
      render: (row: WorkItemSummary) => (
        <span className="font-mono" title={row.workItemId}>
          {row.workItemId.slice(0, 12)}
        </span>
      ),
    },
    { key: 'title', header: 'Title' },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row: WorkItemSummary) => (
        <Badge variant={row.status === 'Open' ? 'default' : 'secondary'} className="text-[10px]">
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'ownerUserId',
      header: 'Owner',
      width: '120px',
      render: (row: WorkItemSummary) => row.ownerUserId ?? '-',
    },
    {
      key: 'sla',
      header: 'SLA',
      width: '140px',
      render: (row: WorkItemSummary) =>
        row.sla?.dueAtIso ? format(new Date(row.sla.dueAtIso), 'MMM d, yyyy') : '-',
    },
    {
      key: 'links',
      header: 'Links',
      width: '80px',
      render: (row: WorkItemSummary) => {
        const count =
          (row.links?.runIds?.length ?? 0) +
          (row.links?.approvalIds?.length ?? 0) +
          (row.links?.evidenceIds?.length ?? 0) +
          (row.links?.externalRefs?.length ?? 0);
        return count > 0 ? count : '-';
      },
    },
  ];

  if (isError && filtered.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Work Items"
          icon={<EntityIcon entityType="work-item" size="md" decorative />}
        />
        <OfflineSyncBanner
          isOffline={offlineMeta.isOffline}
          isStaleData={offlineMeta.isStaleData}
          lastSyncAtIso={offlineMeta.lastSyncAtIso}
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load work items</p>
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
      <PageHeader
        title="Work Items"
        icon={<EntityIcon entityType="work-item" size="md" decorative />}
      />
      <OfflineSyncBanner
        isOffline={offlineMeta.isOffline}
        isStaleData={offlineMeta.isStaleData}
        lastSyncAtIso={offlineMeta.lastSyncAtIso}
      />

      <FilterBar
        filters={[
          { key: 'status', label: 'Status', options: STATUS_FILTERS },
          { key: 'owner', label: 'Owner', options: ownerFilters },
        ]}
        values={filterValues}
        onChange={(key, value) =>
          navigate({
            to: '.' as string,
            search: { ...search, [key]: value === 'all' ? undefined : value } as WorkItemsSearch,
            replace: true,
          })
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        getRowKey={(row) => row.workItemId}
        onRowClick={(row) =>
          navigate({
            to: '/work-items/$workItemId' as string,
            params: { workItemId: row.workItemId },
          })
        }
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work-items',
  component: WorkItemsPage,
  validateSearch: (search: Record<string, unknown>): WorkItemsSearch => ({
    status: typeof search.status === 'string' ? search.status : undefined,
    owner: typeof search.owner === 'string' ? search.owner : undefined,
  }),
});

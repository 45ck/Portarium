import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface AdapterRecord {
  adapterId: string;
  name: string;
  sorFamily: string;
  status: 'healthy' | 'degraded' | 'offline';
  lastSyncIso: string;
}

type AdaptersResponse = AdapterRecord[] | { items: AdapterRecord[] };

const statusColor: Record<string, string> = {
  healthy: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  degraded: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950',
  offline: 'text-muted-foreground bg-muted',
};

function AdaptersPage() {
  const { activeWorkspaceId: wsId } = useUIStore();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['adapters', wsId],
    queryFn: async () => {
      const res = await fetch(`/v1/workspaces/${wsId}/adapters`);
      if (!res.ok) throw new Error('Failed to fetch adapters');
      const payload = (await res.json()) as AdaptersResponse;
      return Array.isArray(payload) ? payload : payload.items;
    },
  });

  const adapters = data ?? [];

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: AdapterRecord) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'adapterId',
      header: 'Adapter ID',
      render: (row: AdapterRecord) => (
        <span className="text-muted-foreground text-[11px]">{row.adapterId}</span>
      ),
    },
    {
      key: 'sorFamily',
      header: 'SoR Family',
      width: '120px',
      render: (row: AdapterRecord) => <Badge variant="secondary">{row.sorFamily}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row: AdapterRecord) => (
        <Badge variant="secondary" className={statusColor[row.status]}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'lastSyncIso',
      header: 'Last Sync',
      width: '140px',
      render: (row: AdapterRecord) => (
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(row.lastSyncIso))} ago
        </span>
      ),
    },
  ];

  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Adapters" description="System of Record adapters" icon={<EntityIcon entityType="adapter" size="md" decorative />} />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load adapters</p>
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
        title="Adapters"
        description="System of Record adapters"
        icon={<EntityIcon entityType="adapter" size="md" decorative />}
      />

      <DataTable
        columns={columns}
        data={adapters}
        loading={isLoading}
        getRowKey={(row) => row.adapterId}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/adapters',
  component: AdaptersPage,
});

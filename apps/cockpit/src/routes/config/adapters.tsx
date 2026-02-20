import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { Badge } from '@/components/ui/badge';

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

  const { data, isLoading } = useQuery({
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
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/adapters',
  component: AdaptersPage,
});

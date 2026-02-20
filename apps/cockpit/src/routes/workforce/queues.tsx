import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useWorkforceQueues } from '@/hooks/queries/use-workforce';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw } from 'lucide-react';
import type { WorkforceQueueSummary } from '@portarium/cockpit-types';

const strategyVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  'round-robin': 'default',
  'least-busy': 'secondary',
  manual: 'outline',
};

function WorkforceQueuesPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: queuesData, isLoading: queuesLoading, isError, refetch } = useWorkforceQueues(wsId);

  const queues = queuesData?.items ?? [];

  const columns = [
    {
      key: 'name',
      header: 'Queue Name',
      render: (row: WorkforceQueueSummary) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'workforceQueueId',
      header: 'Queue ID',
      render: (row: WorkforceQueueSummary) => (
        <span className="text-muted-foreground text-[11px]">{row.workforceQueueId}</span>
      ),
    },
    {
      key: 'routingStrategy',
      header: 'Routing Strategy',
      width: '150px',
      render: (row: WorkforceQueueSummary) => (
        <Badge variant={strategyVariant[row.routingStrategy] ?? 'default'}>
          {row.routingStrategy}
        </Badge>
      ),
    },
    {
      key: 'requiredCapabilities',
      header: 'Required Capabilities',
      render: (row: WorkforceQueueSummary) => (
        <div className="flex flex-wrap gap-1">
          {row.requiredCapabilities.map((cap) => (
            <Badge key={cap} variant="secondary" className="text-[10px]">
              {cap.split('.').pop()}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'members',
      header: 'Members',
      width: '80px',
      render: (row: WorkforceQueueSummary) => <span>{row.memberIds.length}</span>,
    },
  ];

  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Queues"
          description="Workforce routing queues"
          icon={<EntityIcon entityType="queue" size="md" decorative />}
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load queues</p>
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
        title="Queues"
        description="Workforce routing queues"
        icon={<EntityIcon entityType="queue" size="md" decorative />}
      />

      <DataTable
        columns={columns}
        data={queues}
        loading={queuesLoading}
        getRowKey={(row) => row.workforceQueueId}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workforce/queues',
  component: WorkforceQueuesPage,
});

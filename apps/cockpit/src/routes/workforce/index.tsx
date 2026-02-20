import { createRoute, useNavigate } from '@tanstack/react-router';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useWorkforceMembers, useWorkforceQueues } from '@/hooks/queries/use-workforce';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { DataTable } from '@/components/cockpit/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WorkforceMemberSummary } from '@portarium/cockpit-types';

const statusColor: Record<string, string> = {
  available: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  busy: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950',
  offline: 'text-muted-foreground bg-muted',
};

function WorkforcePage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();
  const { data: membersData, isLoading: membersLoading, isError: membersError, refetch: refetchMembers } = useWorkforceMembers(wsId);
  const { data: queuesData, isLoading: queuesLoading } = useWorkforceQueues(wsId);

  const members = membersData?.items ?? [];
  const queues = queuesData?.items ?? [];

  const columns = [
    {
      key: 'displayName',
      header: 'Member',
      render: (row: WorkforceMemberSummary) => (
        <span className="font-medium">{row.displayName}</span>
      ),
    },
    {
      key: 'linkedUserId',
      header: 'User ID',
      render: (row: WorkforceMemberSummary) => (
        <span className="text-muted-foreground text-[11px]">{row.linkedUserId}</span>
      ),
    },
    {
      key: 'availabilityStatus',
      header: 'Status',
      width: '120px',
      render: (row: WorkforceMemberSummary) => (
        <Badge variant="secondary" className={statusColor[row.availabilityStatus]}>
          {row.availabilityStatus}
        </Badge>
      ),
    },
    {
      key: 'capabilities',
      header: 'Capabilities',
      render: (row: WorkforceMemberSummary) => (
        <div className="flex flex-wrap gap-1">
          {row.capabilities.map((cap) => (
            <Badge key={cap} variant="secondary" className="text-[10px]">
              {cap.split('.').pop()}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'queues',
      header: 'Queues',
      width: '80px',
      render: (row: WorkforceMemberSummary) => <span>{row.queueMemberships.length}</span>,
    },
  ];

  if (membersError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Workforce" description="Human operators and their capabilities" icon={<EntityIcon entityType="workforce" size="md" decorative />} />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load workforce members</p>
            <p className="text-xs text-muted-foreground">An error occurred while fetching data.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchMembers()}>
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
        title="Workforce"
        description="Human operators and their capabilities"
        icon={<EntityIcon entityType="workforce" size="md" decorative />}
      />

      <KpiRow
        stats={[
          { label: 'Total Members', value: members.length },
          {
            label: 'Online',
            value: members.filter((m) => m.availabilityStatus !== 'offline').length,
          },
          {
            label: 'Available',
            value: members.filter((m) => m.availabilityStatus === 'available').length,
          },
          { label: 'Total Queues', value: queues.length },
        ]}
      />

      <DataTable
        columns={columns}
        data={members}
        loading={membersLoading || queuesLoading}
        getRowKey={(row) => row.workforceMemberId}
        onRowClick={(row) =>
          navigate({
            to: '/workforce/$memberId' as string,
            params: { memberId: row.workforceMemberId },
          })
        }
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workforce',
  component: WorkforcePage,
});

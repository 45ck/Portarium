import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useWorkforceQueues, useWorkforceMembers } from '@/hooks/queries/use-workforce'
import { PageHeader } from '@/components/cockpit/page-header'
import { EntityIcon } from '@/components/domain/entity-icon'
import { DataTable } from '@/components/cockpit/data-table'
import { Badge } from '@/components/ui/badge'
import type { WorkforceQueueSummary } from '@portarium/cockpit-types'

const strategyVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  'round-robin': 'default',
  'least-busy': 'secondary',
  manual: 'outline',
}

function WorkforceQueuesPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const { data: queuesData, isLoading: queuesLoading } = useWorkforceQueues(wsId)
  const { data: membersData, isLoading: membersLoading } = useWorkforceMembers(wsId)

  const queues = queuesData?.items ?? []

  const columns = [
    {
      key: 'name',
      header: 'Queue Name',
      render: (row: WorkforceQueueSummary) => (
        <span className="font-medium">{row.name}</span>
      ),
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
      render: (row: WorkforceQueueSummary) => (
        <span>{row.memberIds.length}</span>
      ),
    },
  ]

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
        loading={queuesLoading || membersLoading}
        getRowKey={(row) => row.workforceQueueId}
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workforce/queues',
  component: WorkforceQueuesPage,
})

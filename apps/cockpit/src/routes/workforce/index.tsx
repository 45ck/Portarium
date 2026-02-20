import { createRoute, useNavigate } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useWorkforceMembers, useWorkforceQueues } from '@/hooks/queries/use-workforce'
import { PageHeader } from '@/components/cockpit/page-header'
import { KpiRow } from '@/components/cockpit/kpi-row'
import { DataTable } from '@/components/cockpit/data-table'
import { Badge } from '@/components/ui/badge'
import type { WorkforceMemberSummary } from '@portarium/cockpit-types'

const statusColor: Record<string, string> = {
  available: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  busy: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950',
  offline: 'text-muted-foreground bg-muted',
}

function WorkforcePage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const navigate = useNavigate()
  const { data: membersData, isLoading: membersLoading } = useWorkforceMembers(wsId)
  const { data: queuesData, isLoading: queuesLoading } = useWorkforceQueues(wsId)

  const members = membersData?.items ?? []
  const queues = queuesData?.items ?? []

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
      render: (row: WorkforceMemberSummary) => (
        <span>{row.queueMemberships.length}</span>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Workforce"
        description="Human operators and their capabilities"
      />

      <KpiRow
        stats={[
          { label: 'Total Members', value: members.length },
          { label: 'Online', value: members.filter((m) => m.availabilityStatus !== 'offline').length },
          { label: 'Available', value: members.filter((m) => m.availabilityStatus === 'available').length },
          { label: 'Total Queues', value: queues.length },
        ]}
      />

      <DataTable
        columns={columns}
        data={members}
        loading={membersLoading || queuesLoading}
        getRowKey={(row) => row.workforceMemberId}
        onRowClick={(row) =>
          navigate({ to: '/workforce/$memberId' as string, params: { memberId: row.workforceMemberId } })
        }
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workforce',
  component: WorkforcePage,
})

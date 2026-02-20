import { useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useApprovals } from '@/hooks/queries/use-approvals'
import { PageHeader } from '@/components/cockpit/page-header'
import { DataTable } from '@/components/cockpit/data-table'
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { ApprovalSummary } from '@portarium/cockpit-types'

function ApprovalsPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const navigate = useNavigate()
  const { data, isLoading } = useApprovals(wsId)
  const items = data?.items ?? []

  const pendingItems = items.filter((a) => a.status === 'Pending')

  const columns = [
    {
      key: 'approvalId',
      header: 'ID',
      width: '120px',
      render: (row: ApprovalSummary) => (
        <span className="font-mono">{row.approvalId.slice(0, 12)}</span>
      ),
    },
    {
      key: 'runId',
      header: 'Run',
      width: '120px',
      render: (row: ApprovalSummary) => (
        <span className="font-mono">{row.runId.slice(0, 12)}</span>
      ),
    },
    {
      key: 'prompt',
      header: 'Prompt',
      render: (row: ApprovalSummary) => (
        <span className="truncate block max-w-[300px]">
          {row.prompt.length > 60 ? `${row.prompt.slice(0, 60)}...` : row.prompt}
        </span>
      ),
    },
    {
      key: 'assigneeUserId',
      header: 'Assignee',
      width: '120px',
      render: (row: ApprovalSummary) => row.assigneeUserId ?? 'Unassigned',
    },
    {
      key: 'dueAtIso',
      header: 'Due',
      width: '140px',
      render: (row: ApprovalSummary) =>
        row.dueAtIso
          ? format(new Date(row.dueAtIso), 'MMM d, yyyy HH:mm')
          : '\u2014',
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row: ApprovalSummary) => (
        <ApprovalStatusBadge status={row.status} />
      ),
    },
  ]

  const handleRowClick = (row: ApprovalSummary) => {
    navigate({
      to: '/approvals/$approvalId' as string,
      params: { approvalId: row.approvalId },
    })
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Approvals" />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <DataTable
            columns={columns}
            data={pendingItems}
            loading={isLoading}
            getRowKey={(row) => row.approvalId}
            onRowClick={handleRowClick}
          />
        </TabsContent>

        <TabsContent value="all">
          <DataTable
            columns={columns}
            data={items}
            loading={isLoading}
            getRowKey={(row) => row.approvalId}
            onRowClick={handleRowClick}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/approvals',
  component: ApprovalsPage,
})

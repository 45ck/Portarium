import { useState } from 'react'
import { createRoute, Link } from '@tanstack/react-router'
import { format, isAfter, isBefore, addHours, startOfDay, endOfDay } from 'date-fns'
import { Route as rootRoute } from './__root'
import { useUIStore } from '@/stores/ui-store'
import { useRuns } from '@/hooks/queries/use-runs'
import { useApprovals } from '@/hooks/queries/use-approvals'
import { useWorkItems } from '@/hooks/queries/use-work-items'
import { useEvidence } from '@/hooks/queries/use-evidence'
import { PageHeader } from '@/components/cockpit/page-header'
import { EntityIcon } from '@/components/domain/entity-icon'
import { SystemStateBanner } from '@/components/cockpit/system-state-banner'
import { KpiRow } from '@/components/cockpit/kpi-row'
import { DataTable } from '@/components/cockpit/data-table'
import { RunStatusBadge } from '@/components/cockpit/run-status-badge'
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { WorkItemSummary, ApprovalSummary } from '@portarium/cockpit-types'

function DashboardPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const runs = useRuns(wsId)
  const approvals = useApprovals(wsId)
  const workItems = useWorkItems(wsId)
  const evidence = useEvidence(wsId)

  const runsList = runs.data?.items ?? []
  const approvalsList = approvals.data?.items ?? []
  const workItemsList = workItems.data?.items ?? []

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const next24h = addHours(now, 24)

  const activeRuns = runsList.filter(
    (r) => r.status === 'Running' || r.status === 'WaitingForApproval',
  ).length

  const pendingApprovals = approvalsList.filter((a) => a.status === 'Pending').length

  const completedToday = runsList.filter(
    (r) =>
      r.status === 'Succeeded' &&
      r.endedAtIso &&
      isAfter(new Date(r.endedAtIso), todayStart) &&
      isBefore(new Date(r.endedAtIso), todayEnd),
  ).length

  const slaAtRisk = workItemsList.filter((wi) => {
    if (!wi.sla?.dueAtIso) return false
    const due = new Date(wi.sla.dueAtIso)
    return isAfter(due, now) && isBefore(due, next24h)
  }).length

  const recentWorkItems = workItemsList.slice(0, 5)
  const pendingApprovalsList = approvalsList.filter((a) => a.status === 'Pending')

  const workItemColumns = [
    { key: 'title', header: 'Title' },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
    },
    {
      key: 'sla',
      header: 'SLA',
      width: '140px',
      render: (row: WorkItemSummary) =>
        row.sla?.dueAtIso
          ? format(new Date(row.sla.dueAtIso), 'MMM d, yyyy')
          : '-',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        icon={<EntityIcon entityType="workflow" size="md" decorative />}
        action={<Button size="sm">New Run</Button>}
      />

      <SystemStateBanner state="healthy" />

      <KpiRow
        stats={[
          { label: 'Active Runs', value: activeRuns },
          { label: 'Pending Approvals', value: pendingApprovals },
          { label: 'Completed Today', value: completedToday },
          { label: 'SLA at Risk', value: slaAtRisk },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Recent Work Items</CardTitle>
              <Link
                to={'/work-items' as string}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={workItemColumns}
              data={recentWorkItems}
              loading={workItems.isLoading}
              getRowKey={(row) => row.workItemId}
            />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Pending Approvals</CardTitle>
              <Link
                to={'/approvals' as string}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {approvals.isLoading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : pendingApprovalsList.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No pending approvals
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovalsList.slice(0, 5).map((a) => (
                  <div
                    key={a.approvalId}
                    className="flex items-start justify-between gap-2 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate">{a.prompt}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.dueAtIso
                          ? `Due: ${format(new Date(a.dueAtIso), 'MMM d, yyyy HH:mm')}`
                          : 'No due date'}
                      </p>
                    </div>
                    <ApprovalStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})

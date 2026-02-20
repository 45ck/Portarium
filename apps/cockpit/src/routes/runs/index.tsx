import { useState } from 'react'
import { createRoute, useNavigate } from '@tanstack/react-router'
import { format, differenceInMinutes } from 'date-fns'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useRuns } from '@/hooks/queries/use-runs'
import { PageHeader } from '@/components/cockpit/page-header'
import { FilterBar } from '@/components/cockpit/filter-bar'
import { DataTable } from '@/components/cockpit/data-table'
import { RunStatusBadge } from '@/components/cockpit/run-status-badge'
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge'
import type { RunSummary } from '@portarium/cockpit-types'

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Running', value: 'Running' },
  { label: 'Waiting for Approval', value: 'WaitingForApproval' },
  { label: 'Paused', value: 'Paused' },
  { label: 'Succeeded', value: 'Succeeded' },
  { label: 'Failed', value: 'Failed' },
  { label: 'Cancelled', value: 'Cancelled' },
]

const TIER_OPTIONS = [
  { label: 'Auto', value: 'Auto' },
  { label: 'Assisted', value: 'Assisted' },
  { label: 'Human Approve', value: 'HumanApprove' },
  { label: 'Manual Only', value: 'ManualOnly' },
]

function formatDuration(startedAtIso?: string, endedAtIso?: string): string {
  if (!startedAtIso || !endedAtIso) return '-'
  const mins = differenceInMinutes(new Date(endedAtIso), new Date(startedAtIso))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}h ${remainingMins}m`
}

function RunsPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const navigate = useNavigate()
  const [filterValues, setFilterValues] = useState<Record<string, string>>({
    status: 'all',
    tier: 'all',
  })

  const { data, isLoading } = useRuns(wsId)
  const items = data?.items ?? []

  const filtered = items.filter((run) => {
    if (filterValues.status && filterValues.status !== 'all' && run.status !== filterValues.status)
      return false
    if (filterValues.tier && filterValues.tier !== 'all' && run.executionTier !== filterValues.tier)
      return false
    return true
  })

  const columns = [
    {
      key: 'runId',
      header: 'Run ID',
      width: '120px',
      render: (row: RunSummary) => (
        <span className="font-mono">{row.runId.slice(0, 12)}</span>
      ),
    },
    {
      key: 'workflowId',
      header: 'Workflow',
      render: (row: RunSummary) => (
        <span className="font-mono text-muted-foreground">{row.workflowId}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row: RunSummary) => <RunStatusBadge status={row.status} />,
    },
    {
      key: 'executionTier',
      header: 'Tier',
      width: '140px',
      render: (row: RunSummary) => <ExecutionTierBadge tier={row.executionTier} />,
    },
    {
      key: 'startedAtIso',
      header: 'Started',
      width: '140px',
      render: (row: RunSummary) =>
        row.startedAtIso
          ? format(new Date(row.startedAtIso), 'MMM d, HH:mm')
          : '-',
    },
    {
      key: 'duration',
      header: 'Duration',
      width: '100px',
      render: (row: RunSummary) =>
        formatDuration(row.startedAtIso, row.endedAtIso),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Runs" />

      <FilterBar
        filters={[
          { key: 'status', label: 'Status', options: STATUS_OPTIONS },
          { key: 'tier', label: 'Tier', options: TIER_OPTIONS },
        ]}
        values={filterValues}
        onChange={(key, value) =>
          setFilterValues((prev) => ({ ...prev, [key]: value }))
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        getRowKey={(row) => row.runId}
        onRowClick={(row) =>
          navigate({ to: '/runs/$runId' as string, params: { runId: row.runId } })
        }
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: RunsPage,
})

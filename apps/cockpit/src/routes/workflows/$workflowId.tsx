import { createRoute, Link } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useWorkflow } from '@/hooks/queries/use-workflows'
import { useRuns } from '@/hooks/queries/use-runs'
import { PageHeader } from '@/components/cockpit/page-header'
import { EntityIcon } from '@/components/domain/entity-icon'
import { DataTable } from '@/components/cockpit/data-table'
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { RunSummary, WorkflowActionSummary } from '@portarium/cockpit-types'

function WorkflowDetailPage() {
  const { workflowId } = Route.useParams()
  const { activeWorkspaceId: wsId } = useUIStore()

  const workflow = useWorkflow(wsId, workflowId)
  const runs = useRuns(wsId)

  if (workflow.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!workflow.data) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title={`Workflow: ${workflowId}`}
          icon={<EntityIcon entityType="workflow" size="md" decorative />}
          breadcrumb={[{ label: 'Workflows', to: '/workflows' }, { label: workflowId }]}
        />
        <Card className="shadow-none">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Workflow not found.
          </CardContent>
        </Card>
      </div>
    )
  }

  const workflowRuns = (runs.data?.items ?? []).filter((run) => run.workflowId === workflowId)
  const versionHistory = [workflow.data.version, Math.max(1, workflow.data.version - 1)].filter(
    (value, index, all) => all.indexOf(value) === index,
  )

  const actionColumns = [
    {
      key: 'order',
      header: '#',
      width: '60px',
      render: (row: WorkflowActionSummary) => <span>{row.order}</span>,
    },
    {
      key: 'operation',
      header: 'Operation',
      render: (row: WorkflowActionSummary) => (
        <span className="font-mono text-[11px]">{row.operation}</span>
      ),
    },
    {
      key: 'portFamily',
      header: 'Port Family',
      width: '150px',
      render: (row: WorkflowActionSummary) => <span>{row.portFamily}</span>,
    },
    {
      key: 'kind',
      header: 'Type',
      width: '120px',
      render: (row: WorkflowActionSummary) => (
        <Badge variant="secondary">{deriveActionType(row.operation)}</Badge>
      ),
    },
    {
      key: 'binding',
      header: 'Binding',
      render: (row: WorkflowActionSummary) => (
        <span className="text-muted-foreground">{deriveBinding(row.operation)}</span>
      ),
    },
  ]

  const runColumns = [
    {
      key: 'runId',
      header: 'Run',
      width: '140px',
      render: (row: RunSummary) => (
        <Link
          to={'/runs/$runId' as string}
          params={{ runId: row.runId }}
          className="font-mono text-[11px] text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.runId}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (row: RunSummary) => <Badge variant="outline">{row.status}</Badge>,
    },
    {
      key: 'executionTier',
      header: 'Tier',
      width: '130px',
      render: (row: RunSummary) => <ExecutionTierBadge tier={row.executionTier} />,
    },
    {
      key: 'createdAtIso',
      header: 'Created',
      render: (row: RunSummary) => <span>{new Date(row.createdAtIso).toLocaleString()}</span>,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Workflow: ${workflow.data.workflowId}`}
        description={workflow.data.name}
        icon={<EntityIcon entityType="workflow" size="md" decorative />}
        breadcrumb={[{ label: 'Workflows', to: '/workflows' }, { label: workflow.data.workflowId }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Version History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {versionHistory.map((version) => (
              <div key={version} className="flex items-center justify-between">
                <span>v{version}</span>
                <Badge variant={version === workflow.data.version ? 'default' : 'secondary'}>
                  {version === workflow.data.version ? 'Current' : 'Previous'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trigger Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Trigger Kind</span>
              <Badge variant="secondary">{workflow.data.triggerKind ?? 'Manual'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Workflow Status</span>
              <Badge variant={workflow.data.active ? 'default' : 'secondary'}>
                {workflow.data.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Execution Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Tier</span>
              <ExecutionTierBadge tier={workflow.data.executionTier} />
            </div>
            <div className="flex items-center justify-between">
              <span>Timeout</span>
              <span>{workflow.data.timeoutMs ?? 300000} ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Retry Attempts</span>
              <span>{workflow.data.retryPolicy?.maxAttempts ?? 3}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Compensation</span>
              <Badge variant="outline">{workflow.data.compensationMode ?? 'best-effort'}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Action Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={actionColumns}
            data={workflow.data.actions}
            getRowKey={(row) => row.actionId}
            pagination={{ pageSize: 10 }}
          />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Linked Runs</CardTitle>
            <Badge variant="secondary">{workflowRuns.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={runColumns}
            data={workflowRuns}
            loading={runs.isLoading}
            getRowKey={(row) => row.runId}
            pagination={{ pageSize: 10 }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function deriveActionType(operation: string): string {
  if (operation.startsWith('agent:')) return 'Agent Task'
  if (operation.includes('tool') || operation.includes('invoke')) return 'Tool'
  if (operation.startsWith('workflow:')) return 'Workflow'
  return 'Action'
}

function deriveBinding(operation: string): string {
  if (operation.startsWith('agent:task')) return 'agent-runtime'
  const [resource] = operation.split(':')
  return resource ?? 'n/a'
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows/$workflowId',
  component: WorkflowDetailPage,
})

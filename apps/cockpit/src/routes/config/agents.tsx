import { createRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Route as rootRoute } from '../__root'
import { useUIStore } from '@/stores/ui-store'
import { useAgents } from '@/hooks/queries/use-agents'
import { PageHeader } from '@/components/cockpit/page-header'
import { EntityIcon } from '@/components/domain/entity-icon'
import { DataTable } from '@/components/cockpit/data-table'
import { AgentCapabilityBadge } from '@/components/cockpit/agent-capability-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AgentV1 } from '@portarium/cockpit-types'

function AgentsPage() {
  const { activeWorkspaceId: wsId } = useUIStore()
  const { data, isLoading } = useAgents(wsId)

  const agents = data?.items ?? []

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: AgentV1) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      key: 'agentId',
      header: 'Agent ID',
      render: (row: AgentV1) => (
        <span className="text-muted-foreground font-mono text-[11px]">{row.agentId}</span>
      ),
    },
    {
      key: 'modelId',
      header: 'Model',
      width: '120px',
      render: (row: AgentV1) => (
        <span>{row.modelId ?? '\u2014'}</span>
      ),
    },
    {
      key: 'endpoint',
      header: 'Endpoint',
      render: (row: AgentV1) => (
        <span className="font-mono text-[11px]" title={row.endpoint}>
          {row.endpoint.length > 40 ? `${row.endpoint.slice(0, 40)}...` : row.endpoint}
        </span>
      ),
    },
    {
      key: 'capabilities',
      header: 'Capabilities',
      render: (row: AgentV1) => (
        <div className="flex flex-wrap gap-1">
          {row.allowedCapabilities.map((cap) => (
            <AgentCapabilityBadge key={cap} capability={cap} />
          ))}
        </div>
      ),
    },
    {
      key: 'workflows',
      header: 'Workflows',
      width: '100px',
      render: (row: AgentV1) => (
        <Badge variant="secondary">{row.usedByWorkflowIds?.length ?? 0}</Badge>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Agents"
        description="AI agents registered in this workspace"
        icon={<EntityIcon entityType="agent" size="md" decorative />}
        action={
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Register Agent
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={agents}
        loading={isLoading}
        getRowKey={(row) => row.agentId}
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/agents',
  component: AgentsPage,
})

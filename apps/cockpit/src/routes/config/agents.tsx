import { useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Plus, AlertCircle, RotateCcw, Bot, Brain, Code2 } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useAgents } from '@/hooks/queries/use-agents';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { AgentCapabilityBadge } from '@/components/cockpit/agent-capability-badge';
import { RegisterAgentDialog } from '@/components/cockpit/register-agent-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AgentV1 } from '@portarium/cockpit-types';

function agentKind(agent: AgentV1): 'openclaw' | 'code' | 'llm' {
  if (agent.allowedCapabilities.includes('machine:invoke')) return 'openclaw';
  if (agent.allowedCapabilities.includes('execute-code')) return 'code';
  return 'llm';
}

const KIND_ICON = {
  openclaw: { Icon: Bot, cls: 'text-orange-500' },
  code: { Icon: Code2, cls: 'text-violet-500' },
  llm: { Icon: Brain, cls: 'text-blue-500' },
} as const;

function AgentsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading, isError, refetch } = useAgents(wsId);
  const navigate = useNavigate();
  const [registerOpen, setRegisterOpen] = useState(false);

  const agents = data?.items ?? [];

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: AgentV1) => {
        const { Icon, cls } = KIND_ICON[agentKind(row)];
        return (
          <span className="flex items-center gap-2">
            <Icon className={`h-4 w-4 shrink-0 ${cls}`} aria-hidden="true" />
            <span className="font-medium">{row.name}</span>
          </span>
        );
      },
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
      render: (row: AgentV1) => <span>{row.modelId ?? '\u2014'}</span>,
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
  ];

  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Agents"
          description="AI agents registered in this workspace"
          icon={<EntityIcon entityType="agent" size="md" decorative />}
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load agents</p>
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
        title="Agents"
        description="AI agents registered in this workspace"
        icon={<EntityIcon entityType="agent" size="md" decorative />}
        action={
          <Button variant="outline" size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Register Agent
          </Button>
        }
      />

      <RegisterAgentDialog open={registerOpen} onOpenChange={setRegisterOpen} />

      <DataTable
        columns={columns}
        data={agents}
        loading={isLoading}
        getRowKey={(row) => row.agentId}
        pagination={{ pageSize: 20 }}
        onRowClick={(row) =>
          navigate({ to: '/config/agents/$agentId' as string, params: { agentId: row.agentId } })
        }
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/agents',
  component: AgentsPage,
});

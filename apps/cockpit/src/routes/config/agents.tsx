import { useMemo, useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Plus, AlertCircle, RotateCcw, Bot, Brain, Code2, Wifi, Activity } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useAgents } from '@/hooks/queries/use-agents';
import { useMachines } from '@/hooks/queries/use-machines';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { EmptyState } from '@/components/cockpit/empty-state';
import { AgentCapabilityBadge } from '@/components/cockpit/agent-capability-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { RegisterAgentDialog } from '@/components/cockpit/register-agent-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AgentV1, MachineStatus, MachineV1 } from '@portarium/cockpit-types';

function agentKind(agent: AgentV1): 'machine' | 'code' | 'llm' {
  const caps = agent.allowedCapabilities ?? [];
  if (caps.includes('machine:invoke')) return 'machine';
  if (caps.includes('execute-code')) return 'code';
  return 'llm';
}

const KIND_ICON = {
  machine: { Icon: Bot, cls: 'text-orange-500' },
  code: { Icon: Code2, cls: 'text-violet-500' },
  llm: { Icon: Brain, cls: 'text-blue-500' },
} as const;

function isLiveOperatorAgent(agent: AgentV1, machinesById: ReadonlyMap<string, MachineV1>): boolean {
  if (!agent.machineId) return false;
  if (!agent.operatorUi || agent.operatorUi.status === 'disabled') return false;

  const machine = machinesById.get(agent.machineId);
  return Boolean(machine && machine.status !== 'Offline');
}

function statusVariant(status: MachineStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Online':
      return 'default';
    case 'Degraded':
      return 'secondary';
    case 'Offline':
      return 'destructive';
  }
}

function StatusIcon({ status }: { status: MachineStatus }) {
  switch (status) {
    case 'Online':
      return <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" aria-hidden="true" />;
    case 'Degraded':
      return <Activity className="h-3.5 w-3.5 text-yellow-500 shrink-0" aria-hidden="true" />;
    case 'Offline':
      return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" aria-hidden="true" />;
  }
}

function AgentsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading, isError, refetch } = useAgents(wsId);
  const {
    data: machinesData,
    isLoading: machinesLoading,
    isError: machinesError,
    refetch: refetchMachines,
  } = useMachines(wsId);
  const navigate = useNavigate();
  const [registerOpen, setRegisterOpen] = useState(false);

  const machinesById = useMemo(
    () => new Map((machinesData?.items ?? []).map((machine) => [machine.machineId, machine])),
    [machinesData?.items],
  );
  const agents = useMemo(
    () => (data?.items ?? []).filter((agent) => isLiveOperatorAgent(agent, machinesById)),
    [data?.items, machinesById],
  );
  const loading = isLoading || machinesLoading;
  const hasLoadError = isError || machinesError;

  const refetchLiveAgents = () => {
    void refetch();
    void refetchMachines();
  };

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
      key: 'machine',
      header: 'Machine',
      render: (row: AgentV1) => {
        const machine = row.machineId ? machinesById.get(row.machineId) : undefined;
        if (!machine) return <span className="text-muted-foreground">—</span>;

        return (
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px]" title={machine.machineId}>
              {machine.hostname}
            </span>
            <span className="flex items-center gap-1.5">
              <StatusIcon status={machine.status} />
              <Badge variant={statusVariant(machine.status)} className="text-xs">
                {machine.status}
              </Badge>
            </span>
          </span>
        );
      },
    },
    {
      key: 'endpoint',
      header: 'Endpoint',
      render: (row: AgentV1) => {
        const ep = row.endpoint ?? '\u2014';
        return (
          <span className="font-mono text-[11px]" title={ep}>
            {ep.length > 40 ? `${ep.slice(0, 40)}...` : ep}
          </span>
        );
      },
    },
    {
      key: 'capabilities',
      header: 'Capabilities',
      render: (row: AgentV1) => (
        <div className="flex flex-wrap gap-1">
          {(row.allowedCapabilities ?? []).map((cap) => (
            <AgentCapabilityBadge key={cap} capability={cap} />
          ))}
        </div>
      ),
    },
    {
      key: 'policyTier',
      header: 'Policy Tier',
      width: '150px',
      render: (row: AgentV1) =>
        row.policyTier ? (
          <ExecutionTierBadge tier={row.policyTier} />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
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

  if (hasLoadError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Live Agents"
          description="Machine-backed operator agents currently reachable in this workspace"
          icon={<EntityIcon entityType="agent" size="md" decorative />}
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load live agents</p>
            <p className="text-xs text-muted-foreground">An error occurred while fetching data.</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetchLiveAgents}>
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
        title="Live Agents"
        description="Machine-backed operator agents currently reachable in this workspace"
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
        loading={loading}
        empty={
          <EmptyState
            title="No live agents"
            description="Connected Machine-backed operator agents will appear here when their Machine is online."
          />
        }
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

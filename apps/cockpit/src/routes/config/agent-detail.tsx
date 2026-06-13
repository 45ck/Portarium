import { createRoute, Link } from '@tanstack/react-router';
import { Bot, Brain, Code2, ExternalLink, Eye, Monitor, Server, ShieldCheck } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useAgents } from '@/hooks/queries/use-agents';
import { useRuns } from '@/hooks/queries/use-runs';
import { useMachines } from '@/hooks/queries/use-machines';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { EmptyState } from '@/components/cockpit/empty-state';
import type { AgentV1 } from '@portarium/cockpit-types';
import { AgentCapabilityBadge } from '@/components/cockpit/agent-capability-badge';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

type AgentOperatorUi = NonNullable<AgentV1['operatorUi']>;

const OPERATOR_STATUS_VARIANT = {
  available: 'success',
  degraded: 'warning',
  disabled: 'secondary',
} as const;

const OPERATOR_ACCESS_LABEL = {
  mediated: 'Mediated',
  'direct-tunnel': 'Direct tunnel',
  external: 'External',
} as const;

function AgentOperatorUiPanel({ agent }: { agent: AgentV1 }) {
  const operatorUi = agent.operatorUi;

  if (!operatorUi) return null;

  const launchUrl = operatorUi.externalUrl ?? operatorUi.embedUrl;
  const canEmbed =
    operatorUi.mode === 'embedded' &&
    operatorUi.status !== 'disabled' &&
    typeof operatorUi.embedUrl === 'string';

  return (
    <Card className="shadow-none overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {operatorUi.label}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{operatorUi.sourceSystem}</span>
              {operatorUi.sourceRef && <span className="break-all">{operatorUi.sourceRef}</span>}
              {operatorUi.freshness && <span>{operatorUi.freshness}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={OPERATOR_STATUS_VARIANT[operatorUi.status]}>{operatorUi.status}</Badge>
            <Badge variant={operatorUi.readOnly ? 'outline' : 'warning'}>
              <Eye className="h-3 w-3" aria-hidden="true" />
              {operatorUi.readOnly ? 'Read-only' : 'Mutation-capable'}
            </Badge>
            <Badge variant="secondary">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {OPERATOR_ACCESS_LABEL[operatorUi.accessMode]}
            </Badge>
            {launchUrl && (
              <Button asChild variant="outline" size="xs">
                <a href={launchUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Open
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEmbed ? (
          <div className="h-[min(68vh,680px)] min-h-[420px] overflow-hidden rounded-md border bg-muted/20">
            <iframe
              title={`${agent.name} operator UI`}
              src={operatorUi.embedUrl}
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
              referrerPolicy="no-referrer"
              loading="lazy"
              className="h-full w-full border-0"
            />
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
            Operator surface unavailable for embedded display.
          </div>
        )}

        <div className="grid gap-3 text-xs md:grid-cols-2">
          <OperatorList title="Boundary" items={operatorUi.boundary} />
          <OperatorList title="Denied Operations" items={operatorUi.deniedOperations} />
        </div>
      </CardContent>
    </Card>
  );
}

function OperatorList({ title, items }: { title: string; items: AgentOperatorUi['boundary'] }) {
  if (items.length === 0) {
    return (
      <div className="space-y-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-muted-foreground">No entries declared.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="font-medium">{title}</h3>
      <ul className="space-y-1 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgentDetailPage() {
  const { agentId } = Route.useParams();
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: agentsData, isLoading: agentsLoading } = useAgents(wsId);
  const { data: runsData } = useRuns(wsId);
  const { data: machinesData } = useMachines(wsId);

  if (agentsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const agent = (agentsData?.items ?? []).find((a) => a.agentId === agentId);

  if (!agent) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Agent Not Found"
          icon={<EntityIcon entityType="agent" size="md" decorative />}
          breadcrumb={[{ label: 'Agents', to: '/config/agents' }]}
        />
        <EmptyState
          title="Agent not found"
          description="The agent you are looking for does not exist or has been removed."
        />
      </div>
    );
  }

  const recentRuns = (runsData?.items ?? []).filter((r) => r.agentIds?.includes(agentId));
  const connectedMachine = agent?.machineId
    ? (machinesData?.items ?? []).find((m) => m.machineId === agent.machineId)
    : undefined;

  const maskedEndpoint =
    agent.endpoint.length > 30 ? `${agent.endpoint.slice(0, 30)}...` : agent.endpoint;

  const { Icon: KindIcon, cls: kindCls } = KIND_ICON[agentKind(agent)];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={agent.name}
        icon={<KindIcon className={`h-5 w-5 ${kindCls}`} aria-hidden="true" />}
        breadcrumb={[{ label: 'Agents', to: '/config/agents' }, { label: agent.name }]}
      />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Agent Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agent ID</span>
              <span className="font-mono">{agent.agentId}</span>
            </div>
            {agent.modelId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span>{agent.modelId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Endpoint</span>
              <span className="font-mono" title={agent.endpoint}>
                {maskedEndpoint}
              </span>
            </div>
            {agent.policyTier && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Policy Tier</span>
                <ExecutionTierBadge tier={agent.policyTier} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {connectedMachine && (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Connected Machine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to={'/config/machines' as string}>
              <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors text-xs">
                <EntityIcon entityType="machine" size="sm" decorative />
                <span className="font-mono font-medium">{connectedMachine.hostname}</span>
                <span className="text-muted-foreground ml-auto">{connectedMachine.status}</span>
              </div>
            </Link>
          </CardContent>
        </Card>
      )}

      <AgentOperatorUiPanel agent={agent} />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Capabilities</h3>
        <div className="flex flex-wrap gap-1.5">
          {agent.allowedCapabilities.map((cap) => (
            <AgentCapabilityBadge key={cap} capability={cap} />
          ))}
        </div>
      </div>

      {(agent.usedByWorkflowIds?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Used by Workflows</h3>
          <div className="flex flex-wrap gap-1.5">
            {agent.usedByWorkflowIds!.map((wfId) => (
              <Link
                key={wfId}
                to={'/workflows/$workflowId' as string}
                params={{ workflowId: wfId }}
              >
                <Badge
                  variant="outline"
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  {wfId}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No runs found for this agent</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((r) => (
                <Link
                  key={r.runId}
                  to={'/runs/$runId' as string}
                  params={{ runId: r.runId }}
                  className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors text-xs"
                >
                  <span className="font-mono">{r.runId.slice(0, 12)}</span>
                  <span className="text-muted-foreground">{r.workflowId}</span>
                  <RunStatusBadge status={r.status} />
                  <ExecutionTierBadge tier={r.executionTier} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/agents/$agentId',
  component: AgentDetailPage,
});

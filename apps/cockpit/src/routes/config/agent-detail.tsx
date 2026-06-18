import { useState } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  Bot,
  Brain,
  Code2,
  ExternalLink,
  Eye,
  Info,
  Monitor,
  PanelsTopLeft,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useAgents } from '@/hooks/queries/use-agents';
import { useRuns } from '@/hooks/queries/use-runs';
import { useMachines } from '@/hooks/queries/use-machines';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { EmptyState } from '@/components/cockpit/empty-state';
import type { AgentV1, MachineV1, RunSummary } from '@portarium/cockpit-types';
import { AgentCapabilityBadge } from '@/components/cockpit/agent-capability-badge';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function resolveLoopbackUrlForCurrentHost(rawUrl: string | undefined): string | undefined {
  if (!rawUrl || typeof window === 'undefined') return rawUrl;

  try {
    const url = new URL(rawUrl, window.location.href);
    if (isLoopbackHostname(url.hostname) && isLoopbackHostname(window.location.hostname)) {
      url.hostname = window.location.hostname;
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function AgentOperatorFocusView({
  agent,
  connectedMachine,
  maskedEndpoint,
  recentRuns,
}: {
  agent: AgentV1;
  connectedMachine?: MachineV1;
  maskedEndpoint: string;
  recentRuns: RunSummary[];
}) {
  const operatorUi = agent.operatorUi;
  const [iframeReloadKey, setIframeReloadKey] = useState(0);

  if (!operatorUi) return null;

  const { Icon: KindIcon, cls: kindCls } = KIND_ICON[agentKind(agent)];
  const embedUrl = resolveLoopbackUrlForCurrentHost(operatorUi.embedUrl);
  const launchUrl = resolveLoopbackUrlForCurrentHost(operatorUi.externalUrl ?? operatorUi.embedUrl);
  const canEmbed =
    operatorUi.mode === 'embedded' &&
    operatorUi.status !== 'disabled' &&
    typeof embedUrl === 'string';
  const iframeSandbox =
    operatorUi.accessMode === 'direct-tunnel'
      ? undefined
      : 'allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts';

  return (
    <section
      aria-labelledby="operator-ui-heading"
      className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col overflow-hidden rounded-lg border bg-background shadow-sm"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b bg-muted/30 px-3 py-2 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-xs" aria-label="Back to agents">
            <Link to="/config/agents">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
          <KindIcon className={`h-4 w-4 ${kindCls}`} aria-hidden="true" />
          <div className="min-w-0">
            <h1 id="operator-ui-heading" className="truncate text-sm font-semibold leading-5">
              {agent.name}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{operatorUi.label}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <Badge variant={OPERATOR_STATUS_VARIANT[operatorUi.status]}>{operatorUi.status}</Badge>
          <Badge variant={operatorUi.readOnly ? 'outline' : 'warning'}>
            <Eye className="h-3 w-3" aria-hidden="true" />
            {operatorUi.readOnly ? 'Read-only' : 'Mutation-capable'}
          </Badge>
          <Badge variant="secondary">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            {OPERATOR_ACCESS_LABEL[operatorUi.accessMode]}
          </Badge>
          {canEmbed && (
            <Button
              variant="outline"
              size="xs"
              type="button"
              onClick={() => setIframeReloadKey((current) => current + 1)}
              aria-label={`Reload ${operatorUi.label}`}
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Reload
            </Button>
          )}
          {launchUrl && (
            <Button asChild variant="outline" size="xs">
              <a href={launchUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Open
              </a>
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="xs" type="button">
                <Info className="h-3 w-3" aria-hidden="true" />
                Details
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[min(92vw,480px)] overflow-y-auto sm:max-w-[480px]">
              <SheetHeader>
                <SheetTitle>{agent.name}</SheetTitle>
                <SheetDescription>
                  Operator surface context, routing metadata, and guardrails.
                </SheetDescription>
              </SheetHeader>
              <AgentDetailsDrawerContent
                agent={agent}
                connectedMachine={connectedMachine}
                maskedEndpoint={maskedEndpoint}
                recentRuns={recentRuns}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-background">
        {canEmbed ? (
          <iframe
            key={`${embedUrl}:${iframeReloadKey}`}
            title={`${agent.name} operator UI`}
            src={embedUrl}
            allow="clipboard-read; clipboard-write; fullscreen"
            sandbox={iframeSandbox}
            referrerPolicy="no-referrer"
            loading="eager"
            className="h-full min-h-[calc(100vh-8rem)] w-full border-0"
            data-testid="operator-ui-frame"
          />
        ) : operatorUi.mode === 'embedded' ? (
          <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center text-xs text-muted-foreground">
            Operator surface unavailable for embedded display.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AgentDetailsDrawerContent({
  agent,
  connectedMachine,
  maskedEndpoint,
  recentRuns,
}: {
  agent: AgentV1;
  connectedMachine?: MachineV1;
  maskedEndpoint: string;
  recentRuns: RunSummary[];
}) {
  const operatorUi = agent.operatorUi;

  return (
    <div className="space-y-6 px-4 pb-6 text-xs">
      {operatorUi && (
        <>
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 font-medium">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Surface
            </h3>
            <dl className="space-y-2 text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Mode</dt>
                <dd className="font-medium text-foreground">{operatorUi.mode}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Access</dt>
                <dd className="font-medium text-foreground">
                  {OPERATOR_ACCESS_LABEL[operatorUi.accessMode]}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Control</dt>
                <dd className="font-medium text-foreground">
                  {operatorUi.readOnly ? 'Read-only' : 'Mutation-capable'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Source</dt>
                <dd className="font-medium text-foreground">{operatorUi.sourceSystem}</dd>
              </div>
              {operatorUi.sourceRef && (
                <div className="flex justify-between gap-3">
                  <dt>Reference</dt>
                  <dd className="break-all font-medium text-foreground">{operatorUi.sourceRef}</dd>
                </div>
              )}
              {operatorUi.freshness && (
                <div className="flex justify-between gap-3">
                  <dt>Freshness</dt>
                  <dd className="font-medium text-foreground">{operatorUi.freshness}</dd>
                </div>
              )}
            </dl>
          </section>
          <OperatorList title="Boundary" items={operatorUi.boundary} />
          <OperatorList title="Denied Operations" items={operatorUi.deniedOperations} />
        </>
      )}

      <section className="space-y-2">
        <h3 className="font-medium">Agent Metadata</h3>
        <dl className="space-y-2 text-muted-foreground">
          <div className="flex justify-between gap-3">
            <dt>Agent ID</dt>
            <dd className="break-all font-mono text-foreground">{agent.agentId}</dd>
          </div>
          {agent.modelId && (
            <div className="flex justify-between gap-3">
              <dt>Model</dt>
              <dd className="text-foreground">{agent.modelId}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt>Endpoint</dt>
            <dd className="break-all font-mono text-foreground" title={agent.endpoint}>
              {maskedEndpoint}
            </dd>
          </div>
          {agent.policyTier && (
            <div className="flex items-center justify-between gap-3">
              <dt>Policy Tier</dt>
              <dd>
                <ExecutionTierBadge tier={agent.policyTier} />
              </dd>
            </div>
          )}
        </dl>
      </section>

      {connectedMachine && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 font-medium">
            <Server className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Connected Machine
          </h3>
          <Link
            to={'/config/machines' as string}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
          >
            <EntityIcon entityType="machine" size="sm" decorative />
            <span className="font-mono font-medium">{connectedMachine.hostname}</span>
            <span className="ml-auto text-muted-foreground">{connectedMachine.status}</span>
          </Link>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-medium">Capabilities</h3>
        <div className="flex flex-wrap gap-1.5">
          {agent.allowedCapabilities.map((cap) => (
            <AgentCapabilityBadge key={cap} capability={cap} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Used by Workflows</h3>
        {(agent.usedByWorkflowIds?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground">No workflows declare this agent.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {agent.usedByWorkflowIds!.map((wfId) => (
              <Link
                key={wfId}
                to={'/workflows/$workflowId' as string}
                params={{ workflowId: wfId }}
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                >
                  {wfId}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Recent Runs</h3>
        {recentRuns.length === 0 ? (
          <p className="text-muted-foreground">No runs found for this agent</p>
        ) : (
          <div className="space-y-2">
            {recentRuns.map((r) => (
              <Link
                key={r.runId}
                to={'/runs/$runId' as string}
                params={{ runId: r.runId }}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
              >
                <span className="font-mono">{r.runId.slice(0, 12)}</span>
                <span className="text-muted-foreground">{r.workflowId}</span>
                <RunStatusBadge status={r.status} />
                <ExecutionTierBadge tier={r.executionTier} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
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

  if (agent.operatorUi) {
    return (
      <div className="flex min-h-[calc(100vh-2rem)] flex-col p-2 sm:p-3">
        <AgentOperatorFocusView
          agent={agent}
          connectedMachine={connectedMachine}
          maskedEndpoint={maskedEndpoint}
          recentRuns={recentRuns}
        />
      </div>
    );
  }

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

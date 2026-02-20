import { createRoute, Link } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useAgents } from '@/hooks/queries/use-agents';
import { useRuns } from '@/hooks/queries/use-runs';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { EmptyState } from '@/components/cockpit/empty-state';
import { AgentCapabilityBadge } from '@/components/cockpit/agent-capability-badge';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function AgentDetailPage() {
  const { agentId } = Route.useParams();
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data: agentsData, isLoading: agentsLoading } = useAgents(wsId);
  const { data: runsData } = useRuns(wsId);

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

  const recentRuns = (runsData?.items ?? []).filter((r) =>
    r.agentIds?.includes(agentId),
  );

  const maskedEndpoint =
    agent.endpoint.length > 30
      ? `${agent.endpoint.slice(0, 30)}...`
      : agent.endpoint;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={agent.name}
        icon={<EntityIcon entityType="agent" size="md" decorative />}
        breadcrumb={[
          { label: 'Agents', to: '/config/agents' },
          { label: agent.name },
        ]}
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
          </div>
        </CardContent>
      </Card>

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
                <Badge variant="outline" className="hover:bg-muted/50 cursor-pointer transition-colors">
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

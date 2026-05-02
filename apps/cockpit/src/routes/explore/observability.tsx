import { useMemo } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { Activity, AlertTriangle, CheckCircle2, Clock, GitBranch, ShieldCheck } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { PageHeader } from '@/components/cockpit/page-header';
import { FreshnessBadge } from '@/components/cockpit/freshness-badge';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { DataTable } from '@/components/cockpit/data-table';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { MissionCard } from '@/components/cockpit/mission-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgents } from '@/hooks/queries/use-agents';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { useHumanTasks } from '@/hooks/queries/use-human-tasks';
import { useMachines } from '@/hooks/queries/use-machines';
import { useRuns } from '@/hooks/queries/use-runs';
import { useWorkItems } from '@/hooks/queries/use-work-items';
import { useWorkforceQueues } from '@/hooks/queries/use-workforce';
import {
  buildAgentObservabilityModel,
  type AgentSessionObservation,
  type EvidenceChainHealth,
} from '@/lib/agent-observability';

function postureBadge(posture: AgentSessionObservation['posture']) {
  switch (posture) {
    case 'active':
      return <Badge variant="success">Active</Badge>;
    case 'waiting':
      return <Badge variant="warning">Waiting</Badge>;
    case 'attention':
      return <Badge variant="destructive">Attention</Badge>;
    case 'idle':
      return <Badge variant="secondary">Idle</Badge>;
  }
}

function ChainHealthBadge({ health }: { health: EvidenceChainHealth }) {
  if (health === 'intact') {
    return (
      <Badge variant="success">
        <ShieldCheck className="h-3 w-3" />
        Chain intact
      </Badge>
    );
  }
  if (health === 'gaps') {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="h-3 w-3" />
        Chain gaps
      </Badge>
    );
  }
  return <Badge variant="secondary">No evidence</Badge>;
}

export function AgentObservabilityBoard({ title = 'Mission Control' }: { title?: string }) {
  const { activeWorkspaceId: wsId } = useUIStore();
  const agents = useAgents(wsId);
  const machines = useMachines(wsId);
  const runs = useRuns(wsId);
  const approvals = useApprovals(wsId);
  const evidence = useEvidence(wsId);
  const workItems = useWorkItems(wsId);
  const queues = useWorkforceQueues(wsId);
  const humanTasks = useHumanTasks(wsId);

  const model = useMemo(
    () =>
      buildAgentObservabilityModel({
        workspaceId: wsId,
        agents: agents.data?.items ?? [],
        machines: machines.data?.items ?? [],
        runs: runs.data?.items ?? [],
        approvals: approvals.data?.items ?? [],
        evidence: evidence.data?.items ?? [],
        humanTasks: humanTasks.data?.items ?? [],
        workItems: workItems.data?.items ?? [],
        queues: queues.data?.items ?? [],
      }),
    [
      agents.data?.items,
      approvals.data?.items,
      evidence.data?.items,
      humanTasks.data?.items,
      machines.data?.items,
      queues.data?.items,
      runs.data?.items,
      workItems.data?.items,
      wsId,
    ],
  );

  const loading =
    agents.isLoading ||
    machines.isLoading ||
    runs.isLoading ||
    approvals.isLoading ||
    evidence.isLoading ||
    workItems.isLoading ||
    queues.isLoading ||
    humanTasks.isLoading;
  const waitingSessions = model.sessions.filter((row) => row.posture === 'waiting').length;
  const attentionSessions = model.sessions.filter((row) => row.posture === 'attention').length;

  const agentColumns = [
    {
      key: 'agent',
      header: 'Agent',
      render: (row: AgentSessionObservation) => (
        <div className="min-w-0">
          <Link
            to={'/config/agents' as string}
            className="font-medium text-primary hover:underline"
          >
            {row.agent.name}
          </Link>
          <p className="truncate text-[11px] text-muted-foreground">
            {row.agent.agentId}
            {row.machine ? ` · ${row.machine.hostname}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'posture',
      header: 'State',
      width: '120px',
      render: (row: AgentSessionObservation) => postureBadge(row.posture),
    },
    {
      key: 'runs',
      header: 'Runs',
      width: '190px',
      render: (row: AgentSessionObservation) =>
        row.activeRuns.length === 0 ? (
          <span className="text-xs text-muted-foreground">None active</span>
        ) : (
          <div className="space-y-1">
            {row.activeRuns.slice(0, 2).map((run) => (
              <div key={run.runId} className="flex items-center gap-2">
                <Link
                  to={'/runs/$runId' as string}
                  params={{ runId: run.runId }}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {run.runId}
                </Link>
                <RunStatusBadge status={run.status} />
              </div>
            ))}
          </div>
        ),
    },
    {
      key: 'approvals',
      header: 'Approvals',
      width: '100px',
      render: (row: AgentSessionObservation) => (
        <span className="text-sm tabular-nums">{row.pendingApprovals.length}</span>
      ),
    },
    {
      key: 'activity',
      header: 'Tool Activity',
      width: '130px',
      render: (row: AgentSessionObservation) => (
        <div>
          <span className="text-sm tabular-nums">{row.toolActivityCount}</span>
          {row.latestToolName ? (
            <p className="truncate text-[11px] text-muted-foreground">{row.latestToolName}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'evidence',
      header: 'Latest Evidence',
      render: (row: AgentSessionObservation) =>
        row.latestEvidence ? (
          <Link
            to={'/evidence' as string}
            className="line-clamp-2 text-xs text-primary hover:underline"
          >
            {row.latestEvidence.summary}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">No linked evidence</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title={title}
        description="Agent sessions, approval waits, run state, queue pressure, and evidence health"
        icon={<Activity className="h-5 w-5" aria-hidden="true" />}
        status={
          <>
            <FreshnessBadge sourceLabel="Runs" offlineMeta={runs.offlineMeta} />
            <FreshnessBadge sourceLabel="Approvals" offlineMeta={approvals.offlineMeta} />
            <FreshnessBadge sourceLabel="Evidence" offlineMeta={evidence.offlineMeta} />
            <FreshnessBadge sourceLabel="Work Items" offlineMeta={workItems.offlineMeta} />
          </>
        }
      />

      <KpiRow
        stats={[
          {
            label: 'Active Agents',
            value: model.sessions.filter((row) => row.posture !== 'idle').length,
          },
          { label: 'Active Runs', value: model.activeRuns.length },
          { label: 'Pending Approvals', value: model.pendingApprovals.length },
          {
            label: 'Queue Items',
            value: model.actionableHumanTasks.length + model.openWorkItems.length,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MissionCard
          eyebrow="Evidence"
          title="Evidence Integrity"
          status={model.evidenceChainHealth === 'intact' ? 'nominal' : 'critical'}
          metric={<>{model.evidenceBreakCount}</>}
          footer="hash-chain breaks"
        >
          <div className="flex items-center justify-between gap-3">
            <ChainHealthBadge health={model.evidenceChainHealth} />
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          </div>
        </MissionCard>
        <MissionCard
          eyebrow="Approval Gates"
          title="Approval Waits"
          status={waitingSessions > 0 ? 'waiting' : 'nominal'}
          metric={<>{waitingSessions}</>}
          footer="agent sessions blocked on human approval"
        >
          <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
        </MissionCard>
        <MissionCard
          eyebrow="Operator Queue"
          title="Needs Attention"
          status={attentionSessions > 0 ? 'critical' : 'active'}
          metric={<>{attentionSessions}</>}
          footer="paused or blocked agent sessions"
        >
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
        </MissionCard>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm">Agent Session Board</CardTitle>
            <span className="text-xs text-muted-foreground">{wsId}</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <DataTable
              columns={agentColumns}
              data={model.sessions}
              getRowKey={(row) => row.sessionId}
              empty={
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No registered agents in this workspace.
                </div>
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {model.pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending approvals.</p>
            ) : (
              <div className="space-y-3">
                {model.pendingApprovals.slice(0, 5).map((approval) => (
                  <div
                    key={approval.approvalId}
                    className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={'/approvals/$approvalId' as string}
                        params={{ approvalId: approval.approvalId }}
                        className="line-clamp-2 text-sm font-medium text-primary hover:underline"
                      >
                        {approval.prompt}
                      </Link>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {approval.agentActionProposal?.agentId ?? approval.requestedByUserId} ·{' '}
                        {approval.runId}
                      </p>
                    </div>
                    <ApprovalStatusBadge status={approval.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Run Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {model.activeRuns.slice(0, 6).map((run) => (
                <div
                  key={run.runId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <Link
                      to={'/runs/$runId' as string}
                      params={{ runId: run.runId }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {run.runId}
                    </Link>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {run.workflowId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ExecutionTierBadge tier={run.executionTier} />
                    <RunStatusBadge status={run.status} />
                  </div>
                </div>
              ))}
              {model.activeRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active runs.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4" aria-hidden="true" />
            Workforce Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(queues.data?.items ?? []).map((queue) => (
              <div key={queue.workforceQueueId} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{queue.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {queue.memberIds.length} members · {queue.routingStrategy}
                </p>
              </div>
            ))}
            {(queues.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No workforce queues configured.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/observability',
  component: () => <AgentObservabilityBoard title="Observability" />,
});

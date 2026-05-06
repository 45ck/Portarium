import { createRoute, redirect } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
  Clock3,
  FileCheck2,
  RadioTower,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { EvidenceCategoryBadge } from '@/components/cockpit/evidence-category-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { FreshnessBadge } from '@/components/cockpit/freshness-badge';
import { MissionCard, MissionStatusIndicator } from '@/components/cockpit/mission-card';
import { PageHeader } from '@/components/cockpit/page-header';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { RuntimeStatusDetails } from '@/components/cockpit/runtime-status-strip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { useHumanTasks } from '@/hooks/queries/use-human-tasks';
import { useRuns } from '@/hooks/queries/use-runs';
import { useWorkItems } from '@/hooks/queries/use-work-items';
import { useWorkforceQueues } from '@/hooks/queries/use-workforce';
import { useUIStore } from '@/stores/ui-store';
import { buildAgentObservabilityModel } from '@/lib/agent-observability';
import { cn } from '@/lib/utils';
import { shouldShowInternalCockpitSurfaces } from '@/lib/shell/navigation';
import type { ApprovalSummary, RunSummary } from '@portarium/cockpit-types';

const ACTIVE_RUN_STATUSES = new Set<RunSummary['status']>([
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
]);

function loadingRows() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function formatRelativeTarget(iso?: string) {
  if (!iso) return 'No due time';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Due time unavailable';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function approvalTone(approval: ApprovalSummary) {
  if (approval.sodEvaluation?.state === 'blocked-self') return 'destructive' as const;
  if (approval.sodEvaluation?.state === 'n-of-m') return 'warning' as const;
  return 'secondary' as const;
}

function MissionControlRoute() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const runs = useRuns(wsId);
  const approvals = useApprovals(wsId);
  const evidence = useEvidence(wsId);
  const workItems = useWorkItems(wsId);
  const queues = useWorkforceQueues(wsId);
  const humanTasks = useHumanTasks(wsId);

  const runItems = runs.data?.items ?? [];
  const approvalItems = approvals.data?.items ?? [];
  const evidenceItems = evidence.data?.items ?? [];
  const workItemItems = workItems.data?.items ?? [];
  const queueItems = queues.data?.items ?? [];
  const humanTaskItems = humanTasks.data?.items ?? [];

  const model = buildAgentObservabilityModel({
    workspaceId: wsId,
    agents: [],
    machines: [],
    runs: runItems,
    approvals: approvalItems,
    evidence: evidenceItems,
    workItems: workItemItems,
    queues: queueItems,
    humanTasks: humanTaskItems,
  });

  const loading =
    runs.isLoading ||
    approvals.isLoading ||
    evidence.isLoading ||
    workItems.isLoading ||
    queues.isLoading ||
    humanTasks.isLoading;
  const activeRuns = runItems.filter((run) => ACTIVE_RUN_STATUSES.has(run.status));
  const pendingApprovals = approvalItems.filter((approval) => approval.status === 'Pending');
  const criticalRuns = runItems.filter((run) => run.status === 'Failed' || run.status === 'Paused');
  const linkedEvidenceCount = evidenceItems.filter(
    (entry) => entry.links?.runId || entry.links?.workItemId || entry.links?.approvalId,
  ).length;
  const openWorkItems = workItemItems.filter((item) => item.status === 'Open');
  const governanceState =
    criticalRuns.length > 0 || model.evidenceChainHealth === 'gaps'
      ? 'critical'
      : pendingApprovals.length > 0
        ? 'waiting'
        : activeRuns.length > 0
          ? 'active'
          : 'nominal';

  return (
    <div className="min-h-full bg-mission-background">
      <div className="space-y-5 p-4 md:p-6">
        <PageHeader
          title="Mission Control"
          description="Control Plane visibility for Runs, Approval Gates, Evidence Log, Work Items, and Workforce Queues."
          icon={<RadioTower className="h-5 w-5" aria-hidden="true" />}
          action={
            <Button asChild size="sm">
              <Link to={'/approvals' as string}>Review Approval Gates</Link>
            </Button>
          }
          status={
            <>
              <MissionStatusIndicator status={governanceState} label="Governance Signal" />
              <FreshnessBadge sourceLabel="Runs" offlineMeta={runs.offlineMeta} />
              <FreshnessBadge sourceLabel="Approvals" offlineMeta={approvals.offlineMeta} />
              <FreshnessBadge sourceLabel="Evidence" offlineMeta={evidence.offlineMeta} />
            </>
          }
        />

        <Card className="border-mission-line bg-mission-panel shadow-none">
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-2">
              <p className="mission-display text-xs uppercase text-muted-foreground">
                Operator Shell
              </p>
              <h2 className="text-lg font-semibold">
                One Cockpit surface, Mission Control density
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                This mode maps mission-control-ui patterns onto Portarium vocabulary: Runs stay the
                execution unit, Approval Gates remain the human decision point, Evidence Log entries
                carry audit state, and Work Items keep operational ownership visible.
              </p>
            </div>
            <RuntimeStatusDetails className="rounded-md border border-mission-line bg-background/50 p-3" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MissionCard
            eyebrow="Runs"
            title="Active Run State"
            status={activeRuns.length > 0 ? 'active' : 'nominal'}
            metric={activeRuns.length}
            footer="Pending, Running, Paused, or WaitingForApproval"
          >
            <Activity className="h-4 w-4 text-mission-cyan" aria-hidden="true" />
          </MissionCard>
          <MissionCard
            eyebrow="Approval Gates"
            title="Human Decisions"
            status={pendingApprovals.length > 0 ? 'waiting' : 'nominal'}
            metric={pendingApprovals.length}
            footer="Pending approval decisions across the workspace"
          >
            <Clock3 className="h-4 w-4 text-mission-amber" aria-hidden="true" />
          </MissionCard>
          <MissionCard
            eyebrow="Evidence Log"
            title="Audit Coverage"
            status={model.evidenceChainHealth === 'gaps' ? 'critical' : 'nominal'}
            metric={linkedEvidenceCount}
            footer={`${model.evidenceBreakCount} hash-chain breaks`}
          >
            <FileCheck2 className="h-4 w-4 text-mission-lime" aria-hidden="true" />
          </MissionCard>
          <MissionCard
            eyebrow="Workforce"
            title="Queue Pressure"
            status={model.actionableHumanTasks.length > 0 ? 'waiting' : 'nominal'}
            metric={model.actionableHumanTasks.length + openWorkItems.length}
            footer={`${queueItems.length} Workforce Queues available`}
          >
            <Users className="h-4 w-4 text-mission-cyan" aria-hidden="true" />
          </MissionCard>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-mission-line bg-mission-panel shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Approval Gate Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                loadingRows()
              ) : pendingApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending Approval Gates.</p>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.slice(0, 5).map((approval) => (
                    <div
                      key={approval.approvalId}
                      className="rounded-md border border-mission-line bg-background/45 p-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <Link
                          to={'/approvals/$approvalId' as string}
                          params={{ approvalId: approval.approvalId }}
                          className="line-clamp-2 text-sm font-medium text-primary hover:underline"
                        >
                          {approval.prompt}
                        </Link>
                        <ApprovalStatusBadge status={approval.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={approvalTone(approval)}>
                          {approval.sodEvaluation?.state ?? 'SoD unchecked'}
                        </Badge>
                        <span>{approval.policyRule?.ruleId ?? approval.planId}</span>
                        <span>Due {formatRelativeTarget(approval.dueAtIso)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-mission-line bg-mission-panel shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Governance Signal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SignalRow
                label="Critical Runs"
                value={criticalRuns.length}
                hot={criticalRuns.length > 0}
              />
              <SignalRow
                label="Evidence Chain"
                value={
                  model.evidenceChainHealth === 'intact' ? 'Intact' : model.evidenceChainHealth
                }
                hot={model.evidenceChainHealth === 'gaps'}
              />
              <SignalRow
                label="Open Work Items"
                value={openWorkItems.length}
                hot={openWorkItems.length > 3}
              />
              <SignalRow
                label="Workforce Queues"
                value={queueItems.length}
                hot={queueItems.length === 0}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="border-mission-line bg-mission-panel shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Run Status Board</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                loadingRows()
              ) : activeRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active Runs.</p>
              ) : (
                <div className="space-y-2">
                  {activeRuns.slice(0, 6).map((run) => (
                    <Link
                      key={run.runId}
                      to={'/runs/$runId' as string}
                      params={{ runId: run.runId }}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-mission-line bg-background/45 p-3 hover:border-primary/70"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-xs text-primary">{run.runId}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {run.workflowId}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <ExecutionTierBadge tier={run.executionTier} />
                        <RunStatusBadge status={run.status} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-mission-line bg-mission-panel shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Evidence Stream</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                loadingRows()
              ) : evidenceItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Evidence Log entries.</p>
              ) : (
                <div className="space-y-2">
                  {evidenceItems.slice(0, 6).map((entry) => (
                    <Link
                      key={entry.evidenceId}
                      to={'/evidence' as string}
                      className="block rounded-md border border-mission-line bg-background/45 p-3 hover:border-primary/70"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <EvidenceCategoryBadge category={entry.category} />
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {entry.evidenceId}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm">{entry.summary}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {entry.links?.runId ?? entry.links?.workItemId ?? 'workspace evidence'}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SignalRow({ label, value, hot }: { label: string; value: number | string; hot: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-mission-line bg-background/45 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-mono text-sm font-semibold',
          hot ? 'text-mission-amber' : 'text-mission-lime',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/mission-control',
  beforeLoad: () => {
    if (!shouldShowInternalCockpitSurfaces()) {
      throw redirect({ to: '/dashboard' as string });
    }
  },
  component: MissionControlRoute,
});

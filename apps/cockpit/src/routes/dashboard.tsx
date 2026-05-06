import { createRoute, Link } from '@tanstack/react-router';
import { format, isAfter, isBefore, addHours, startOfDay, endOfDay } from 'date-fns';
import { Route as rootRoute } from './__root';
import { useUIStore } from '@/stores/ui-store';
import { useRuns } from '@/hooks/queries/use-runs';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useWorkItems } from '@/hooks/queries/use-work-items';
import { useAdapters } from '@/hooks/queries/use-adapters';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { PageHeader } from '@/components/cockpit/page-header';
import { FreshnessBadge } from '@/components/cockpit/freshness-badge';
import { EntityIcon } from '@/components/domain/entity-icon';
import { SystemStateBanner } from '@/components/cockpit/system-state-banner';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { DataTable } from '@/components/cockpit/data-table';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkItemSummary, ApprovalSummary, RunSummary } from '@portarium/cockpit-types';
import {
  buildGrowthStudioDashboardModel,
  type GrowthStudioActivity,
  type GrowthStudioPolicyBreakdown,
} from '@/lib/growth-studio-dashboard';

function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function PolicyBreakdownRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const width = percentage(value, total);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function policyBreakdownTotal(breakdown: GrowthStudioPolicyBreakdown): number {
  return (
    breakdown.autoApproved +
    breakdown.humanApproved +
    breakdown.denied +
    breakdown.requestChanges +
    breakdown.pending
  );
}

function GrowthStudioActivityEntry({ activity }: { activity: GrowthStudioActivity }) {
  return (
    <details className="group rounded-md border bg-background">
      <summary className="grid cursor-pointer grid-cols-1 gap-3 p-3 text-left marker:text-muted-foreground md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">{activity.persona}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{activity.tool}</span>
            <ExecutionTierBadge tier={activity.tier} />
            <ApprovalStatusBadge status={activity.outcome} />
          </div>
          <p className="truncate text-sm">{activity.title}</p>
        </div>
        <time
          className="text-xs text-muted-foreground md:text-right"
          dateTime={activity.timestampIso}
        >
          {format(new Date(activity.timestampIso), 'MMM d, HH:mm')}
        </time>
      </summary>
      <div className="space-y-3 border-t px-3 py-3 text-xs text-muted-foreground">
        <p className="text-foreground">{activity.approval.rationale ?? activity.approval.prompt}</p>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">Approval Gate</dt>
            <dd className="font-mono">{activity.approval.approvalId}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Run</dt>
            <dd className="font-mono">{activity.run?.runId ?? activity.approval.runId}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Work Item</dt>
            <dd>{activity.workItem?.title ?? activity.approval.workItemId ?? 'Unlinked'}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Evidence</dt>
            <dd>{activity.evidence.length} linked entries</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

function DashboardPage() {
  const { activeWorkspaceId: wsId, startRunOpen, setStartRunOpen } = useUIStore();
  const runs = useRuns(wsId);
  const approvals = useApprovals(wsId);
  const workItems = useWorkItems(wsId);
  const adapters = useAdapters(wsId);
  const evidence = useEvidence(wsId);
  const adapterItems = adapters.data?.items ?? [];
  const workspaceState = adapterItems.some((a) => a.status === 'unhealthy')
    ? 'incident'
    : adapterItems.some((a) => a.status === 'degraded')
      ? 'degraded'
      : 'healthy';
  const runsList = runs.data?.items ?? [];
  const approvalsList = approvals.data?.items ?? [];
  const workItemsList = workItems.data?.items ?? [];
  const evidenceList = evidence.data?.items ?? [];
  const growthStudioModel = buildGrowthStudioDashboardModel({
    approvals: approvalsList,
    runs: runsList,
    workItems: workItemsList,
    evidence: evidenceList,
    now: new Date(),
  });
  const growthPolicyBreakdown = growthStudioModel.policyEffectiveness.breakdown;
  const growthPolicyTotal = policyBreakdownTotal(growthPolicyBreakdown);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const next24h = addHours(now, 24);

  const activeRuns = runsList.filter(
    (r) => r.status === 'Running' || r.status === 'WaitingForApproval',
  ).length;

  const pendingApprovals = approvalsList.filter((a) => a.status === 'Pending').length;

  const completedToday = runsList.filter(
    (r) =>
      r.status === 'Succeeded' &&
      r.endedAtIso &&
      isAfter(new Date(r.endedAtIso), todayStart) &&
      isBefore(new Date(r.endedAtIso), todayEnd),
  ).length;

  const slaAtRisk = workItemsList.filter((wi) => {
    if (!wi.sla?.dueAtIso) return false;
    const due = new Date(wi.sla.dueAtIso);
    return isAfter(due, now) && isBefore(due, next24h);
  }).length;

  const recentWorkItems = workItemsList.slice(0, 5);
  const pendingApprovalsList = approvalsList.filter((a) => a.status === 'Pending');

  const workItemColumns = [
    { key: 'title', header: 'Title' },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
    },
    {
      key: 'sla',
      header: 'SLA',
      width: '140px',
      render: (row: WorkItemSummary) =>
        row.sla?.dueAtIso ? format(new Date(row.sla.dueAtIso), 'MMM d, yyyy') : '-',
    },
  ];

  const activeRunRows = runsList
    .filter((run) => run.status === 'Running' || run.status === 'WaitingForApproval')
    .slice(0, 6);

  const activeRunColumns = [
    {
      key: 'runId',
      header: 'Run',
      width: '120px',
      render: (row: RunSummary) => (
        <Link
          to={'/runs/$runId' as string}
          params={{ runId: row.runId }}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.runId}
        </Link>
      ),
    },
    {
      key: 'workflowId',
      header: 'Workflow',
      render: (row: RunSummary) => (
        <Link
          to={'/workflows/$workflowId' as string}
          params={{ workflowId: row.workflowId }}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.workflowId}
        </Link>
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
      width: '130px',
      render: (row: RunSummary) => <ExecutionTierBadge tier={row.executionTier} />,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard"
        icon={<EntityIcon entityType="workflow" size="md" decorative />}
        status={
          <>
            <FreshnessBadge sourceLabel="Runs" offlineMeta={runs.offlineMeta} />
            <FreshnessBadge sourceLabel="Approvals" offlineMeta={approvals.offlineMeta} />
            <FreshnessBadge sourceLabel="Work Items" offlineMeta={workItems.offlineMeta} />
            <FreshnessBadge sourceLabel="Evidence" offlineMeta={evidence.offlineMeta} />
          </>
        }
        action={
          <Button size="sm" onClick={() => setStartRunOpen(true)}>
            New Run
          </Button>
        }
      />

      <SystemStateBanner state={workspaceState} />

      <KpiRow
        stats={[
          { label: 'Active Runs', value: activeRuns },
          { label: 'Pending Approvals', value: pendingApprovals },
          { label: 'Completed Today', value: completedToday },
          { label: 'SLA at Risk', value: slaAtRisk },
        ]}
      />

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle id="growth-studio-dashboard-heading" className="text-sm">
                Growth Studio Experiment
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Experiment funnel, approval policy impact, and recent agent actions.
              </p>
            </div>
            <Link
              to={'/approvals' as string}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Review approvals
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5" aria-labelledby="growth-studio-dashboard-heading">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {growthStudioModel.metrics.map((metric) => (
              <div key={metric.key} className="rounded-md border bg-muted/20 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{metric.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.description}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium">Activity Timeline</h2>
                <span className="text-xs text-muted-foreground">
                  {growthStudioModel.activity.length} events
                </span>
              </div>
              {runs.isLoading ||
              approvals.isLoading ||
              workItems.isLoading ||
              evidence.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading Growth Studio activity...</p>
              ) : growthStudioModel.activity.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No Growth Studio approvals, runs, or evidence found for this workspace.
                </p>
              ) : (
                <div className="space-y-2">
                  {growthStudioModel.activity.slice(0, 8).map((activity) => (
                    <GrowthStudioActivityEntry key={activity.id} activity={activity} />
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-4" aria-label="Growth Studio policy effectiveness">
              <div className="space-y-3">
                <h2 className="text-sm font-medium">Policy Effectiveness</h2>
                <PolicyBreakdownRow
                  label="Auto-approved"
                  value={growthPolicyBreakdown.autoApproved}
                  total={growthPolicyTotal}
                />
                <PolicyBreakdownRow
                  label="Human-approved"
                  value={growthPolicyBreakdown.humanApproved}
                  total={growthPolicyTotal}
                />
                <PolicyBreakdownRow
                  label="Denied"
                  value={growthPolicyBreakdown.denied}
                  total={growthPolicyTotal}
                />
                <PolicyBreakdownRow
                  label="Changes requested"
                  value={growthPolicyBreakdown.requestChanges}
                  total={growthPolicyTotal}
                />
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">SoD Triggers</span>
                  <span className="font-semibold tabular-nums">
                    {growthStudioModel.policyEffectiveness.sodTriggerCount}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Average latency by tier
                  </p>
                  {growthStudioModel.policyEffectiveness.latencyByTier.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No completed approval decisions.
                    </p>
                  ) : (
                    growthStudioModel.policyEffectiveness.latencyByTier.map((latency) => (
                      <div
                        key={latency.tier}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <ExecutionTierBadge tier={latency.tier} />
                        <span className="tabular-nums text-muted-foreground">
                          {latency.label} avg ({latency.sampleCount})
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Recent Work Items</CardTitle>
              <Link
                to={'/work-items' as string}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={workItemColumns}
              data={recentWorkItems}
              loading={workItems.isLoading}
              getRowKey={(row) => row.workItemId}
            />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Pending Approvals</CardTitle>
              <Link
                to={'/approvals' as string}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {approvals.isLoading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : pendingApprovalsList.length === 0 ? (
              <div className="text-xs text-muted-foreground">No pending approvals</div>
            ) : (
              <div className="space-y-3">
                {pendingApprovalsList.slice(0, 5).map((a) => (
                  <div key={a.approvalId} className="flex items-start justify-between gap-2 py-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate">{a.prompt}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.dueAtIso
                          ? `Due: ${format(new Date(a.dueAtIso), 'MMM d, yyyy HH:mm')}`
                          : 'No due date'}
                      </p>
                    </div>
                    <ApprovalStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Active Runs</CardTitle>
            <Link
              to={'/runs' as string}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={activeRunColumns}
            data={activeRunRows}
            loading={runs.isLoading}
            getRowKey={(row) => row.runId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
});

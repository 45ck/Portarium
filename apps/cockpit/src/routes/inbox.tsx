import { useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Route as rootRoute } from './__root';
import { useUIStore } from '@/stores/ui-store';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useRuns } from '@/hooks/queries/use-runs';
import { useHumanTasks, useAssignHumanTask, useCompleteHumanTask, useEscalateHumanTask } from '@/hooks/queries/use-human-tasks';
import { useWorkforceMembers } from '@/hooks/queries/use-workforce';
import { useAdapters } from '@/hooks/queries/use-adapters';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';
import { HumanTaskStatusBadge } from '@/components/cockpit/human-task-status-badge';
import { HumanTaskDrawer } from '@/components/cockpit/human-task-drawer';
import { SystemStateBanner } from '@/components/cockpit/system-state-banner';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ApprovalSummary, RunSummary, HumanTaskSummary } from '@portarium/cockpit-types';
import { CheckSquare, AlertCircle, Clock, ClipboardList, User } from 'lucide-react';

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5 font-medium">
          {count}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending approval rows
// ---------------------------------------------------------------------------
function PendingApprovalRow({
  approval,
  onClick,
}: {
  approval: ApprovalSummary;
  onClick: () => void;
}) {
  const isOverdue = approval.dueAtIso && new Date(approval.dueAtIso) < new Date();
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
    >
      <CheckSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm truncate">{approval.prompt}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{approval.approvalId}</span>
          {approval.assigneeUserId && <span>Assignee: {approval.assigneeUserId}</span>}
          {approval.dueAtIso && (
            <span className={isOverdue ? 'text-red-600 font-medium' : undefined}>
              <Clock className="inline h-3 w-3 mr-0.5" />
              Due {format(new Date(approval.dueAtIso), 'MMM d, HH:mm')}
              {isOverdue ? ' — overdue' : ''}
            </span>
          )}
        </div>
      </div>
      <ApprovalStatusBadge status={approval.status} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Human task row
// ---------------------------------------------------------------------------
function HumanTaskRow({
  task,
  assigneeName,
  onClick,
}: {
  task: HumanTaskSummary;
  assigneeName?: string;
  onClick: () => void;
}) {
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
    >
      <ClipboardList className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm truncate">{task.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {assigneeName ? (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {assigneeName}
            </span>
          ) : (
            <Badge variant="outline" className="text-[9px] h-4">
              Unassigned
            </Badge>
          )}
          <span className="font-mono">{task.runId}</span>
          <span className="font-mono">{task.workItemId}</span>
          {task.dueAt && (
            <span className={isOverdue ? 'text-red-600 font-medium' : undefined}>
              <Clock className="inline h-3 w-3 mr-0.5" />
              Due {format(new Date(task.dueAt), 'MMM d, HH:mm')}
              {isOverdue ? ' — overdue' : ''}
            </span>
          )}
        </div>
      </div>
      <HumanTaskStatusBadge status={task.status} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Failed / blocked run rows
// ---------------------------------------------------------------------------
function BlockedRunRow({ run, onClick }: { run: RunSummary; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
    >
      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm truncate font-mono">{run.runId}</p>
        <p className="text-xs text-muted-foreground">
          Workflow: {run.workflowId} · Tier: {run.executionTier}
          {run.startedAtIso && ` · Started ${format(new Date(run.startedAtIso), 'MMM d, HH:mm')}`}
        </p>
      </div>
      <RunStatusBadge status={run.status} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Policy violations — placeholder for governance/evidence API integration
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inbox page
// ---------------------------------------------------------------------------
function InboxPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const navigate = useNavigate();
  const { data: approvalsData, isLoading: approvalsLoading } = useApprovals(wsId);
  const { data: runsData, isLoading: runsLoading } = useRuns(wsId);
  const { data: humanTasksData, isLoading: humanTasksLoading } = useHumanTasks(wsId);
  const { data: membersData } = useWorkforceMembers(wsId);
  const adapters = useAdapters(wsId);
  const adapterItems = adapters.data?.items ?? [];
  const workspaceState = adapterItems.some((a) => a.status === 'unhealthy')
    ? 'incident'
    : adapterItems.some((a) => a.status === 'degraded')
      ? 'degraded'
      : 'healthy';

  const [selectedTask, setSelectedTask] = useState<HumanTaskSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pendingApprovals = (approvalsData?.items ?? []).filter((a) => a.status === 'Pending');
  const blockedRuns = (runsData?.items ?? []).filter(
    (r) => r.status === 'Failed' || r.status === 'WaitingForApproval' || r.status === 'Paused',
  );
  const actionableHumanTasks = (humanTasksData?.items ?? []).filter(
    (t) => t.status === 'pending' || t.status === 'assigned' || t.status === 'in-progress',
  );
  const workforceMembers = membersData?.items ?? [];

  const totalItems = pendingApprovals.length + blockedRuns.length + actionableHumanTasks.length;

  // Mutation hooks — use the selected task ID or a fallback
  const assignMutation = useAssignHumanTask(wsId, selectedTask?.humanTaskId ?? '');
  const completeMutation = useCompleteHumanTask(wsId, selectedTask?.humanTaskId ?? '');
  const escalateMutation = useEscalateHumanTask(wsId, selectedTask?.humanTaskId ?? '');

  function handleOpenTask(task: HumanTaskSummary) {
    setSelectedTask(task);
    setDrawerOpen(true);
  }

  function getAssigneeName(assigneeId?: string): string | undefined {
    if (!assigneeId) return undefined;
    return workforceMembers.find((m) => m.workforceMemberId === assigneeId)?.displayName;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Inbox"
        description="Your workspace triage surface — approvals, human tasks, blocked runs, and policy alerts"
        icon={<EntityIcon entityType="queue" size="md" decorative />}
      />

      <SystemStateBanner state={workspaceState} />

      <KpiRow
        stats={[
          { label: 'Pending Approvals', value: approvalsLoading ? '—' : pendingApprovals.length },
          { label: 'Human Tasks', value: humanTasksLoading ? '—' : actionableHumanTasks.length },
          { label: 'Blocked Runs', value: runsLoading ? '—' : blockedRuns.length },
          { label: 'Total Actions', value: approvalsLoading || runsLoading || humanTasksLoading ? '—' : totalItems },
        ]}
      />

      {/* Section 1: Pending approval gates */}
      <section>
        <SectionHeader
          icon={<CheckSquare className="h-4 w-4" />}
          title="Pending Approval Gates"
          count={pendingApprovals.length}
        />
        <div className="rounded-md border border-border divide-y divide-border">
          {approvalsLoading ? (
            <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading…</div>
          ) : pendingApprovals.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground italic">
              No pending approvals.
            </div>
          ) : (
            pendingApprovals.map((a) => (
              <PendingApprovalRow
                key={a.approvalId}
                approval={a}
                onClick={() =>
                  navigate({
                    to: '/approvals/$approvalId' as string,
                    params: { approvalId: a.approvalId },
                  })
                }
              />
            ))
          )}
          {pendingApprovals.length > 0 && (
            <div className="px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => navigate({ to: '/approvals' as string })}
              >
                Open triage view →
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Human Tasks */}
      <section>
        <SectionHeader
          icon={<ClipboardList className="h-4 w-4" />}
          title="Human Tasks"
          count={actionableHumanTasks.length}
        />
        <div className="rounded-md border border-border divide-y divide-border">
          {humanTasksLoading ? (
            <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading…</div>
          ) : actionableHumanTasks.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground italic">
              No actionable human tasks.
            </div>
          ) : (
            actionableHumanTasks.map((t) => (
              <HumanTaskRow
                key={t.humanTaskId}
                task={t}
                assigneeName={getAssigneeName(t.assigneeId)}
                onClick={() => handleOpenTask(t)}
              />
            ))
          )}
        </div>
      </section>

      {/* Section 3: Failed / blocked runs */}
      <section>
        <SectionHeader
          icon={<AlertCircle className="h-4 w-4" />}
          title="Failed & Blocked Runs"
          count={blockedRuns.length}
        />
        <div className="rounded-md border border-border divide-y divide-border">
          {runsLoading ? (
            <div className="p-4 text-sm text-muted-foreground animate-pulse">Loading…</div>
          ) : blockedRuns.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground italic">
              No failed or blocked runs.
            </div>
          ) : (
            blockedRuns.map((r) => (
              <BlockedRunRow
                key={r.runId}
                run={r}
                onClick={() =>
                  navigate({
                    to: '/runs/$runId' as string,
                    params: { runId: r.runId },
                  })
                }
              />
            ))
          )}
        </div>
      </section>

      {/* Human Task Detail Drawer */}
      <HumanTaskDrawer
        task={selectedTask}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        workforceMembers={workforceMembers}
        onAssign={(taskId, memberId) =>
          assignMutation.mutate({ workforceMemberId: memberId })
        }
        onComplete={(taskId, note) =>
          completeMutation.mutate({ completionNote: note })
        }
        onEscalate={(taskId, reason) =>
          escalateMutation.mutate({ workforceQueueId: 'queue-escalation', reason })
        }
      />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: InboxPage,
});

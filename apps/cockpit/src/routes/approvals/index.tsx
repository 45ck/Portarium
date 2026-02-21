import { useState, useCallback, useEffect, useRef } from 'react';
import { createRoute } from '@tanstack/react-router';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { usePlan } from '@/hooks/queries/use-plan';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { useRun } from '@/hooks/queries/use-runs';
import { useWorkflow } from '@/hooks/queries/use-workflows';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { type TriageAction } from '@/components/cockpit/approval-triage-card';
import { ApprovalTriageDeck } from '@/components/cockpit/approval-triage-deck';
import {
  TriageCompleteState,
  type TriageSessionStats,
} from '@/components/cockpit/triage-complete-state';
import { EmptyState } from '@/components/cockpit/empty-state';
import { CheckSquare, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApprovalDecisionRequest } from '@portarium/cockpit-types';

const UNDO_DELAY_MS = 5_000;

interface PendingAction {
  approvalId: string;
  action: TriageAction;
  rationale: string;
  toastId: string | number;
  timerId: ReturnType<typeof setTimeout>;
  /** Queue index at time of action — used for actionHistory revert */
  queueIndex: number;
}

function ApprovalsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading, isError, refetch } = useApprovals(wsId);
  const items = data?.items ?? [];
  const pendingItems = items.filter((a) => a.status === 'Pending');

  const [triageSkipped, setTriageSkipped] = useState<Set<string>>(new Set());
  const [actionHistory, setActionHistory] = useState<Record<number, TriageAction>>({});
  const [sessionStats, setSessionStats] = useState<TriageSessionStats>({
    total: 0,
    approved: 0,
    denied: 0,
    changesRequested: 0,
    skipped: 0,
  });

  // Undo mechanism
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  pendingActionRef.current = pendingAction;

  // Get pending items not yet actioned/skipped in this triage session
  const triageQueue = pendingItems.filter((a) => !triageSkipped.has(a.approvalId));
  const currentApproval = triageQueue[0] ?? null;

  // ID-parameterized mutation so deferred commits target the correct approval
  const qc = useQueryClient();
  const { mutate: decideById, isPending: deciding } = useMutation({
    mutationFn: ({ approvalId, body }: { approvalId: string; body: ApprovalDecisionRequest }) =>
      fetch(`/v1/workspaces/${wsId}/approvals/${approvalId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((res) => {
        if (!res.ok) throw new Error('Failed to submit decision');
        return res.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals', wsId] });
    },
  });

  const { data: planData } = usePlan(wsId, currentApproval?.planId);
  const { data: evidenceData } = useEvidence(wsId);
  const filteredEvidence = (evidenceData?.items ?? []).filter(
    (e) => e.links?.runId === currentApproval?.runId,
  );
  const { data: runData } = useRun(wsId, currentApproval?.runId ?? '');
  const { data: workflowData } = useWorkflow(wsId, runData?.workflowId ?? '');

  /** Commit a pending action — fires the actual mutation with the correct approval ID */
  const commitAction = useCallback(
    (pa: PendingAction) => {
      if (pa.action === 'Skip') return; // skips are already instant
      decideById({
        approvalId: pa.approvalId,
        body: {
          decision: pa.action as 'Approved' | 'Denied' | 'RequestChanges',
          rationale: pa.rationale,
        },
      });
    },
    [decideById],
  );

  /** Track the current queue index for actionHistory */
  const currentIndex = pendingItems.length - triageQueue.length;

  function handleTriageAction(approvalId: string, action: TriageAction, rationale: string) {
    // Rapid-fire: immediately commit any previous pending action
    if (pendingActionRef.current) {
      clearTimeout(pendingActionRef.current.timerId);
      toast.dismiss(pendingActionRef.current.toastId);
      commitAction(pendingActionRef.current);
      setPendingAction(null);
    }

    // Record in action history and session stats
    setActionHistory((prev) => ({ ...prev, [currentIndex]: action }));
    setSessionStats((prev) => ({
      total: prev.total + 1,
      approved: prev.approved + (action === 'Approved' ? 1 : 0),
      denied: prev.denied + (action === 'Denied' ? 1 : 0),
      changesRequested: prev.changesRequested + (action === 'RequestChanges' ? 1 : 0),
      skipped: prev.skipped + (action === 'Skip' ? 1 : 0),
    }));

    // Remove from queue immediately (optimistic)
    setTriageSkipped((prev) => new Set([...prev, approvalId]));

    // Skip is instant — no undo, no API call
    if (action === 'Skip') return;

    // Defer actual mutation behind undo window
    const toastId = `undo-${approvalId}`;
    const timerId = setTimeout(() => {
      const current = pendingActionRef.current;
      if (current?.approvalId === approvalId) {
        commitAction(current);
        setPendingAction(null);
        toast.dismiss(toastId);
      }
    }, UNDO_DELAY_MS);

    const pa: PendingAction = {
      approvalId,
      action,
      rationale,
      toastId,
      timerId,
      queueIndex: currentIndex,
    };
    setPendingAction(pa);

    toast('Decision recorded', {
      id: toastId,
      duration: UNDO_DELAY_MS,
      action: {
        label: 'Undo',
        onClick: () => handleUndo(pa),
      },
    });
  }

  function handleUndo(pa?: PendingAction) {
    const target = pa ?? pendingActionRef.current;
    if (!target) return;

    clearTimeout(target.timerId);
    toast.dismiss(target.toastId);
    setPendingAction(null);

    // Revert: remove from skipped set so it re-enters the queue
    setTriageSkipped((prev) => {
      const next = new Set(prev);
      next.delete(target.approvalId);
      return next;
    });

    // Revert action history using the stored queue index
    setActionHistory((prev) => {
      const next = { ...prev };
      delete next[target.queueIndex];
      return next;
    });

    setSessionStats((prev) => ({
      total: Math.max(0, prev.total - 1),
      approved: Math.max(0, prev.approved - (target.action === 'Approved' ? 1 : 0)),
      denied: Math.max(0, prev.denied - (target.action === 'Denied' ? 1 : 0)),
      changesRequested: Math.max(
        0,
        prev.changesRequested - (target.action === 'RequestChanges' ? 1 : 0),
      ),
      skipped: Math.max(0, prev.skipped - (target.action === 'Skip' ? 1 : 0)),
    }));
  }

  // Commit pending action on route unmount (prevent data loss on navigation)
  useEffect(() => {
    return () => {
      const pa = pendingActionRef.current;
      if (pa) {
        clearTimeout(pa.timerId);
        toast.dismiss(pa.toastId);
        commitAction(pa);
      }
    };
  }, [commitAction]);

  // ----- Triage content -----
  const triageContent = isLoading ? (
    <div className="max-w-xl mx-auto h-64 rounded-xl bg-muted/30 animate-pulse" />
  ) : !currentApproval || triageQueue.length === 0 ? (
    sessionStats.total > 0 ? (
      <TriageCompleteState
        stats={sessionStats}
        skippedCount={triageSkipped.size}
        onReviewSkipped={() => {
          setTriageSkipped(new Set());
          setActionHistory({});
          setSessionStats({
            total: 0,
            approved: 0,
            denied: 0,
            changesRequested: 0,
            skipped: 0,
          });
        }}
      />
    ) : (
      <EmptyState
        title="All caught up"
        description="No pending approvals left in the triage queue."
        icon={<CheckSquare className="h-12 w-12" />}
        action={
          triageSkipped.size > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTriageSkipped(new Set());
                setActionHistory({});
              }}
            >
              You skipped {triageSkipped.size} item{triageSkipped.size !== 1 ? 's' : ''} — review
              them?
            </Button>
          ) : undefined
        }
      />
    )
  ) : (
    <AnimatePresence mode="wait">
      <ApprovalTriageDeck
        key={currentApproval.approvalId}
        approval={currentApproval}
        index={currentIndex}
        total={pendingItems.length}
        hasMore={triageQueue.length > 1}
        onAction={handleTriageAction}
        loading={deciding}
        plannedEffects={planData?.plannedEffects}
        evidenceEntries={filteredEvidence}
        run={runData}
        workflow={workflowData}
        actionHistory={actionHistory}
        undoAvailable={pendingAction !== null}
        onUndo={() => handleUndo()}
      />
    </AnimatePresence>
  );

  // ----- Error state -----
  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Approvals"
          icon={<EntityIcon entityType="approval" size="md" decorative />}
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load approvals</p>
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

  // ----- Standard layout (desktop & mobile) -----
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Approvals"
        icon={<EntityIcon entityType="approval" size="md" decorative />}
      />
      {triageContent}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/approvals',
  component: ApprovalsPage,
});

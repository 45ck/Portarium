import { useState, useCallback, useEffect, useRef } from 'react';
import { createRoute } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { usePlan } from '@/hooks/queries/use-plan';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { useRun } from '@/hooks/queries/use-runs';
import { useWorkflow } from '@/hooks/queries/use-workflows';
import { useApprovalDecisionOutbox } from '@/hooks/queries/use-approval-decision-outbox';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { type TriageAction } from '@/components/cockpit/triage-card';
import { ApprovalTriageDeck } from '@/components/cockpit/approval-triage-deck';
import { ApprovalListPanel } from '@/components/cockpit/approval-list-panel';
import {
  TriageCompleteState,
  type TriageSessionStats,
} from '@/components/cockpit/triage-complete-state';
import { EmptyState } from '@/components/cockpit/empty-state';
import { OfflineSyncBanner } from '@/components/cockpit/offline-sync-banner';
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
  queueIndex: number;
}

interface ApprovalsSearch {
  focus?: string;
}

function ApprovalsPage() {
  const search = Route.useSearch();
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading, isError, refetch, offlineMeta } = useApprovals(wsId);
  const { submitDecision, pendingCount, isFlushing } = useApprovalDecisionOutbox(wsId);
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

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  pendingActionRef.current = pendingAction;

  const triageQueue = pendingItems.filter((a) => !triageSkipped.has(a.approvalId));
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(search.focus ?? null);

  const currentApproval =
    (selectedApprovalId
      ? triageQueue.find((approval) => approval.approvalId === selectedApprovalId)
      : null) ??
    triageQueue[0] ??
    null;

  const { data: planData } = usePlan(wsId, currentApproval?.planId);
  const { data: evidenceData } = useEvidence(wsId);
  const filteredEvidence = (evidenceData?.items ?? []).filter(
    (e) => e.links?.runId === currentApproval?.runId,
  );
  const { data: runData } = useRun(wsId, currentApproval?.runId ?? '');
  const { data: workflowData } = useWorkflow(wsId, runData?.workflowId ?? '');

  const commitAction = useCallback(
    (pa: PendingAction) => {
      if (pa.action === 'Skip') return;
      const body: ApprovalDecisionRequest = {
        decision: pa.action as 'Approved' | 'Denied' | 'RequestChanges',
        rationale: pa.rationale,
      };
      void submitDecision(pa.approvalId, body)
        .then((result) => {
          if (result.queued) {
            toast.info('Decision queued for replay when network is available.');
          }
        })
        .catch(() => {
          toast.error('Failed to submit approval decision.');
        });
    },
    [submitDecision],
  );

  useEffect(() => {
    if (triageQueue.length === 0) {
      setSelectedApprovalId(null);
      return;
    }
    if (!selectedApprovalId || !triageQueue.some((a) => a.approvalId === selectedApprovalId)) {
      setSelectedApprovalId(triageQueue[0]!.approvalId);
    }
  }, [triageQueue, selectedApprovalId]);

  const currentIndex = currentApproval
    ? Math.max(
        0,
        pendingItems.findIndex((a) => a.approvalId === currentApproval.approvalId),
      )
    : 0;

  function handleTriageAction(approvalId: string, action: TriageAction, rationale: string) {
    if (pendingActionRef.current) {
      clearTimeout(pendingActionRef.current.timerId);
      toast.dismiss(pendingActionRef.current.toastId);
      commitAction(pendingActionRef.current);
      setPendingAction(null);
    }

    setActionHistory((prev) => ({ ...prev, [currentIndex]: action }));
    setSessionStats((prev) => ({
      total: prev.total + 1,
      approved: prev.approved + (action === 'Approved' ? 1 : 0),
      denied: prev.denied + (action === 'Denied' ? 1 : 0),
      changesRequested: prev.changesRequested + (action === 'RequestChanges' ? 1 : 0),
      skipped: prev.skipped + (action === 'Skip' ? 1 : 0),
    }));

    setTriageSkipped((prev) => new Set([...prev, approvalId]));
    setSelectedApprovalId((prevSelected) => {
      const currentIds = triageQueue.map((item) => item.approvalId);
      const idx = currentIds.indexOf(approvalId);
      const nextId = currentIds[idx + 1] ?? currentIds[idx - 1] ?? null;
      return prevSelected === approvalId ? nextId : prevSelected;
    });

    if (action === 'Skip') return;

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

    setTriageSkipped((prev) => {
      const next = new Set(prev);
      next.delete(target.approvalId);
      return next;
    });
    setSelectedApprovalId(target.approvalId);

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

  let triageChild: React.ReactNode;

  if (isLoading) {
    triageChild = (
      <motion.div
        key="loading"
        className="max-w-xl mx-auto h-64 rounded-xl bg-muted/30 animate-pulse"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
    );
  } else if (!currentApproval || triageQueue.length === 0) {
    triageChild =
      sessionStats.total > 0 ? (
        <motion.div
          key="complete"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
        >
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
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
        >
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
                  You skipped {triageSkipped.size} item{triageSkipped.size !== 1 ? 's' : ''} -
                  review them?
                </Button>
              ) : undefined
            }
          />
        </motion.div>
      );
  } else {
    triageChild = (
      <ApprovalTriageDeck
        key={currentApproval.approvalId}
        approval={currentApproval}
        index={currentIndex}
        total={pendingItems.length}
        hasMore={triageQueue.length > 1}
        onAction={handleTriageAction}
        loading={isFlushing}
        plannedEffects={planData?.plannedEffects}
        evidenceEntries={filteredEvidence}
        run={runData}
        workflow={workflowData}
        actionHistory={actionHistory}
        undoAvailable={pendingAction !== null}
        onUndo={() => handleUndo()}
      />
    );
  }

  const triageContent = <AnimatePresence mode="wait">{triageChild}</AnimatePresence>;

  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Approvals"
          icon={<EntityIcon entityType="approval" size="md" decorative />}
        />
        <OfflineSyncBanner
          isOffline={offlineMeta.isOffline}
          isStaleData={offlineMeta.isStaleData}
          lastSyncAtIso={offlineMeta.lastSyncAtIso}
          pendingOutboxCount={pendingCount}
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

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Approvals"
        icon={<EntityIcon entityType="approval" size="md" decorative />}
      />
      <OfflineSyncBanner
        isOffline={offlineMeta.isOffline}
        isStaleData={offlineMeta.isStaleData}
        lastSyncAtIso={offlineMeta.lastSyncAtIso}
        pendingOutboxCount={pendingCount}
      />
      {currentApproval && triageQueue.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden min-h-[640px]">
            <ApprovalListPanel
              items={triageQueue}
              pendingCount={triageQueue.length}
              selectedId={currentApproval.approvalId}
              onSelect={setSelectedApprovalId}
            />
          </aside>
          <section>{triageContent}</section>
        </div>
      ) : (
        triageContent
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/approvals',
  component: ApprovalsPage,
  validateSearch: (search: Record<string, unknown>): ApprovalsSearch => ({
    focus: typeof search.focus === 'string' ? search.focus : undefined,
  }),
});

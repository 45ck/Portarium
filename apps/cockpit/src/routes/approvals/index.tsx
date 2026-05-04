import { useState, useCallback, useEffect, useRef } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
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
import { FreshnessBadge } from '@/components/cockpit/freshness-badge';
import { NotificationBanner } from '@/components/cockpit/notification-banner';
import { CheckSquare, AlertCircle, RotateCcw, Bell, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApprovalSummary, ApprovalDecisionRequest } from '@portarium/cockpit-types';
import {
  usePolicyUpdates,
  useDemoTriggers,
  type PolicyUpdatePayload,
} from '@/lib/policy-event-bridge';
import {
  fromApprovalReturnSearch,
  type PolicyStudioReturnSearch,
  validatePolicyStudioReturnSearch,
} from '@/lib/policy-studio-search';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';

const UNDO_DELAY_MS = 5_000;

interface PendingAction {
  approvalId: string;
  action: TriageAction;
  rationale: string;
  toastId: string | number;
  timerId: ReturnType<typeof setTimeout>;
  queueIndex: number;
}

interface ApprovalsSearch extends PolicyStudioReturnSearch {
  focus?: string;
  from?: string;
  demo?: boolean;
}

async function loadDemoApproval(approvalIds: readonly string[]): Promise<ApprovalSummary | null> {
  const { findOpenClawApproval } = await import('@/mocks/loaders/openclaw-approvals');
  return findOpenClawApproval(approvalIds);
}

function ApprovalsPage() {
  const search = Route.useSearch();
  const policyLinkedMode = search.from === 'policy-studio';
  const singleCaseApprovalId =
    (search.from === 'notification' || policyLinkedMode) && search.focus ? search.focus : undefined;
  const singleCaseMode = singleCaseApprovalId !== undefined;
  const policyLinkedSingleCaseMode = policyLinkedMode && singleCaseMode;
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading, isError, refetch, offlineMeta } = useApprovals(wsId);
  const { submitDecision, pendingCount, isFlushing } = useApprovalDecisionOutbox(wsId);
  const rawItems = data?.items ?? [];
  const runtime = resolveCockpitRuntime();

  // -- Live-update state (policy event bridge) --
  const [injectedApprovals, setInjectedApprovals] = useState<ApprovalSummary[]>([]);
  const [removedApprovalIds, setRemovedApprovalIds] = useState<Set<string>>(new Set());
  const [relaxFlashId, setRelaxFlashId] = useState<string | null>(null);

  const showDemo = runtime.allowDemoControls && search.demo === true;
  const { triggerTighten, triggerRelax } = useDemoTriggers();

  usePolicyUpdates(
    useCallback(
      (payload: PolicyUpdatePayload) => {
        if (!showDemo) return;
        if (payload.effect === 'tighten') {
          void loadDemoApproval(payload.affectedApprovalIds).then((injected) => {
            if (!injected) return;
            const asNewPending: ApprovalSummary = {
              ...injected,
              status: 'Pending',
              decidedAtIso: undefined,
              decidedByUserId: undefined,
              rationale: undefined,
              requestedAtIso: new Date().toISOString(),
            };
            setInjectedApprovals((prev) => {
              if (prev.some((a) => a.approvalId === asNewPending.approvalId)) return prev;
              return [...prev, asNewPending];
            });
            setRemovedApprovalIds((prev) => {
              if (!prev.has(asNewPending.approvalId)) return prev;
              const next = new Set(prev);
              next.delete(asNewPending.approvalId);
              return next;
            });
          });

          toast(`Policy tightened: ${payload.policyName}`, {
            description: payload.changeDescription,
            icon: <Bell className="h-4 w-4 text-orange-500" />,
            duration: 5_000,
          });
        } else {
          // Relax: remove affected approvals with green flash
          const targetId = payload.affectedApprovalIds[0];
          if (targetId) {
            setRelaxFlashId(targetId);
            setTimeout(() => {
              setRemovedApprovalIds((prev) => new Set([...prev, targetId]));
              setRelaxFlashId(null);
              // Also remove from injected if it was there
              setInjectedApprovals((prev) => prev.filter((a) => a.approvalId !== targetId));
            }, 800);
          }

          toast(`Policy relaxed: ${payload.policyName}`, {
            description: payload.changeDescription,
            icon: <Zap className="h-4 w-4 text-green-500" />,
            duration: 5_000,
          });
        }
      },
      [showDemo],
    ),
  );

  // Merge injected approvals and filter removed ones
  const items = [
    ...rawItems.filter((a) => !removedApprovalIds.has(a.approvalId)),
    ...injectedApprovals.filter((a) => !removedApprovalIds.has(a.approvalId)),
  ];
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
  const [singleCaseResult, setSingleCaseResult] = useState<TriageAction | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  pendingActionRef.current = pendingAction;

  const singleCaseApproval = singleCaseApprovalId
    ? (items.find((approval) => approval.approvalId === singleCaseApprovalId) ?? null)
    : null;
  const singleCasePendingApproval =
    singleCaseApproval?.status === 'Pending' ? singleCaseApproval : null;
  const genericTriageQueue = pendingItems.filter((a) => !triageSkipped.has(a.approvalId));
  const triageQueue = singleCaseMode
    ? singleCasePendingApproval && !triageSkipped.has(singleCasePendingApproval.approvalId)
      ? [singleCasePendingApproval]
      : []
    : genericTriageQueue;
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(search.focus ?? null);

  const currentApproval = singleCaseMode
    ? (triageQueue[0] ?? null)
    : ((selectedApprovalId
        ? triageQueue.find((approval) => approval.approvalId === selectedApprovalId)
        : null) ??
      triageQueue[0] ??
      null);
  const focusedApproval = search.focus
    ? (items.find((approval) => approval.approvalId === search.focus) ?? null)
    : currentApproval;
  const returnPolicyStudioSearch = fromApprovalReturnSearch(search);
  const policyStudioFocusDescription = !search.focus
    ? 'Return to Policy Studio with the same staged draft when you are done.'
    : focusedApproval?.status === 'Pending'
      ? `You are focused on ${focusedApproval.approvalId}. This reviews one Approval only and will not advance to unrelated queue items.`
      : focusedApproval
        ? `Approval ${focusedApproval.approvalId} is ${focusedApproval.status}. The staged Policy Studio draft is still preserved on the return path.`
        : 'The original live card is no longer active in the queue, but the staged Policy Studio draft is still preserved on the return path.';

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
    if (singleCaseMode) {
      setSelectedApprovalId(singleCasePendingApproval?.approvalId ?? null);
      return;
    }
    if (triageQueue.length === 0) {
      setSelectedApprovalId(null);
      return;
    }
    if (!selectedApprovalId || !triageQueue.some((a) => a.approvalId === selectedApprovalId)) {
      setSelectedApprovalId(triageQueue[0]!.approvalId);
    }
  }, [singleCaseMode, singleCasePendingApproval?.approvalId, triageQueue, selectedApprovalId]);

  useEffect(() => {
    setSingleCaseResult(null);
  }, [singleCaseApprovalId]);

  useEffect(() => {
    if (singleCaseMode) return;
    if (!search.focus) return;
    if (triageQueue.some((approval) => approval.approvalId === search.focus)) {
      setSelectedApprovalId(search.focus);
    }
  }, [search.focus, singleCaseMode, triageQueue]);

  const currentIndex = currentApproval
    ? Math.max(
        0,
        pendingItems.findIndex((a) => a.approvalId === currentApproval.approvalId),
      )
    : 0;
  const displayIndex = singleCaseMode ? 0 : currentIndex;
  const displayTotal = singleCaseMode ? triageQueue.length : pendingItems.length;

  function handleTriageAction(approvalId: string, action: TriageAction, rationale: string) {
    if (pendingActionRef.current) {
      clearTimeout(pendingActionRef.current.timerId);
      toast.dismiss(pendingActionRef.current.toastId);
      commitAction(pendingActionRef.current);
      pendingActionRef.current = null;
      setPendingAction(null);
    }

    setActionHistory((prev) => ({ ...prev, [displayIndex]: action }));
    setSessionStats((prev) => ({
      total: prev.total + 1,
      approved: prev.approved + (action === 'Approved' ? 1 : 0),
      denied: prev.denied + (action === 'Denied' ? 1 : 0),
      changesRequested: prev.changesRequested + (action === 'RequestChanges' ? 1 : 0),
      skipped: prev.skipped + (action === 'Skip' ? 1 : 0),
    }));

    // Compute the next card BEFORE removing the current one from the queue.
    // Using a direct set (not a functional updater) avoids stale-closure
    // issues where the updater captured a triageQueue that still includes the
    // outgoing item — and also handles the initial null selectedApprovalId.
    const queueIds = triageQueue.map((item) => item.approvalId);
    const idx = queueIds.indexOf(approvalId);
    const nextId = singleCaseMode ? null : (queueIds[idx + 1] ?? queueIds[idx - 1] ?? null);

    setTriageSkipped((prev) => new Set([...prev, approvalId]));
    setSelectedApprovalId(nextId);
    if (singleCaseMode && approvalId === singleCaseApprovalId) {
      setSingleCaseResult(action);
    }

    if (action === 'Skip') return;

    const toastId = `undo-${approvalId}`;
    const timerId = setTimeout(() => {
      const current = pendingActionRef.current;
      if (current?.approvalId === approvalId) {
        commitAction(current);
        pendingActionRef.current = null;
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
      queueIndex: displayIndex,
    };
    pendingActionRef.current = pa;
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
    pendingActionRef.current = null;
    setPendingAction(null);
    if (singleCaseMode && target.approvalId === singleCaseApprovalId) {
      setSingleCaseResult(null);
    }

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
  } else if (singleCaseMode && !singleCaseApproval) {
    triageChild = (
      <motion.div
        key="single-missing"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.25 }}
      >
        <EmptyState
          title="Approval not found"
          description={`Approval ${singleCaseApprovalId} is not available in this workspace. It may have been removed, expired, or opened from an outdated ${policyLinkedSingleCaseMode ? 'Policy Studio handoff' : 'link'}.`}
          icon={<AlertCircle className="h-12 w-12" />}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {policyLinkedMode ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/config/policies/studio" search={returnPolicyStudioSearch}>
                    Back to Policy Studio
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <Link to="/approvals">Open approval queue</Link>
              </Button>
            </div>
          }
        />
      </motion.div>
    );
  } else if (singleCaseMode && singleCaseApproval && singleCaseApproval.status !== 'Pending') {
    triageChild = (
      <motion.div
        key="single-decided"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.25 }}
      >
        <EmptyState
          title="Approval already decided"
          description={`Approval ${singleCaseApproval.approvalId} is ${singleCaseApproval.status}. This ${policyLinkedSingleCaseMode ? 'Policy Studio handoff' : 'deep link'} will not advance to another queued approval.`}
          icon={<CheckSquare className="h-12 w-12" />}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {policyLinkedMode ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/config/policies/studio" search={returnPolicyStudioSearch}>
                    Back to Policy Studio
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <Link to="/approvals">Open approval queue</Link>
              </Button>
            </div>
          }
        />
      </motion.div>
    );
  } else if (singleCaseMode && singleCaseResult) {
    const isSkip = singleCaseResult === 'Skip';
    const title = isSkip ? 'Approval skipped' : 'Approval handled';
    const description = isSkip
      ? `Approval ${singleCaseApprovalId} was skipped. This focused review is complete and will not advance to another queued approval.`
      : `Decision ${singleCaseResult} was recorded for ${singleCaseApprovalId}. This focused review is complete and will not advance to another queued approval.`;
    triageChild = (
      <motion.div
        key="single-complete"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.25 }}
      >
        <EmptyState
          title={title}
          description={description}
          icon={<CheckSquare className="h-12 w-12" />}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {pendingAction ? (
                <Button variant="outline" size="sm" onClick={() => handleUndo()}>
                  Undo decision
                </Button>
              ) : null}
              {policyLinkedMode ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/config/policies/studio" search={returnPolicyStudioSearch}>
                    Back to Policy Studio
                  </Link>
                </Button>
              ) : null}
              {isSkip ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (singleCaseApprovalId) {
                      setTriageSkipped((prev) => {
                        const next = new Set(prev);
                        next.delete(singleCaseApprovalId);
                        return next;
                      });
                      setSelectedApprovalId(singleCaseApprovalId);
                      setSingleCaseResult(null);
                      setSessionStats({
                        total: 0,
                        approved: 0,
                        denied: 0,
                        changesRequested: 0,
                        skipped: 0,
                      });
                    }
                  }}
                >
                  Review this approval
                </Button>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <Link to="/approvals">Open approval queue</Link>
              </Button>
            </div>
          }
        />
      </motion.div>
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
      <div className="relative">
        {/* Green flash overlay for relax animation */}
        <AnimatePresence>
          {relaxFlashId === currentApproval.approvalId && (
            <motion.div
              className="absolute inset-0 z-20 rounded-xl bg-green-500/20 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 0.3, 0.6, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>
        <ApprovalTriageDeck
          key={currentApproval.approvalId}
          approval={currentApproval}
          index={displayIndex}
          total={displayTotal}
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
          policyLinkedMode={policyLinkedMode}
        />
      </div>
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
          decisionContext="approval-review"
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

  const notificationPendingCount = singleCaseMode ? triageQueue.length : pendingItems.length;
  const showNotification =
    notificationPendingCount > 0 &&
    (search.from === 'notification' ||
      (!policyLinkedMode && !singleCaseMode && pendingItems.length > 0));
  const showOfflineSyncBanner =
    !policyLinkedMode || offlineMeta.isOffline || offlineMeta.isStaleData || pendingCount > 0;

  return (
    <div className="p-6 space-y-4">
      {singleCaseMode ? (
        <motion.div
          className="rounded-lg border border-primary/30 bg-primary/5 p-4"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              {policyLinkedSingleCaseMode
                ? 'Focused policy-linked review'
                : 'Focused approval review'}
            </div>
            <div className="text-sm font-medium">
              {singleCaseApprovalId ? `Reviewing ${singleCaseApprovalId}` : 'Reviewing approval'}
            </div>
            <p className="text-sm text-muted-foreground">
              {policyLinkedSingleCaseMode
                ? 'This Policy Studio handoff reviews one Approval only. Finishing it will not advance to another item in the queue.'
                : 'This mobile link reviews one Approval only. Finishing it will not advance to another item in the queue.'}
            </p>
          </div>
        </motion.div>
      ) : null}
      {showNotification ? <NotificationBanner pendingCount={notificationPendingCount} /> : null}
      {search.from === 'policy-studio' ? (
        <motion.div
          className="rounded-lg border border-primary/30 bg-primary/5 p-4"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Opened from Policy Studio
              </div>
              <div className="text-sm font-medium">
                {focusedApproval?.prompt ?? 'Return to the staged policy draft when you are done.'}
              </div>
              <p className="text-sm text-muted-foreground">{policyStudioFocusDescription}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/config/policies/studio" search={returnPolicyStudioSearch}>
                Back to Policy Studio
              </Link>
            </Button>
          </div>
        </motion.div>
      ) : null}
      <PageHeader
        title={singleCaseMode || policyLinkedMode ? 'Approval Review' : 'Approvals'}
        description={
          policyLinkedMode
            ? 'Focused policy-linked review for the live case that led to the staged Policy draft.'
            : singleCaseMode
              ? 'Single-case review opened from a notification or deep link.'
              : undefined
        }
        icon={<EntityIcon entityType="approval" size="md" decorative />}
        status={<FreshnessBadge offlineMeta={offlineMeta} isFetching={isLoading || isFlushing} />}
      />
      {showOfflineSyncBanner ? (
        <OfflineSyncBanner
          isOffline={offlineMeta.isOffline}
          isStaleData={offlineMeta.isStaleData}
          lastSyncAtIso={offlineMeta.lastSyncAtIso}
          pendingOutboxCount={pendingCount}
          decisionContext="approval-review"
        />
      ) : null}
      {showDemo && !policyLinkedMode && !singleCaseMode && (
        <motion.div
          className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Demo</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={triggerTighten}
          >
            <Bell className="h-3 w-3" />
            Policy tightened
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={triggerRelax}
          >
            <Zap className="h-3 w-3" />
            Policy relaxed
          </Button>
        </motion.div>
      )}
      {currentApproval && triageQueue.length > 0 ? (
        <div
          className={
            policyLinkedMode || singleCaseMode
              ? 'grid gap-4'
              : 'grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'
          }
        >
          {!policyLinkedMode && !singleCaseMode ? (
            <aside className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden min-h-[640px]">
              <ApprovalListPanel
                items={triageQueue}
                pendingCount={triageQueue.length}
                selectedId={currentApproval.approvalId}
                onSelect={setSelectedApprovalId}
              />
            </aside>
          ) : null}
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
  validateSearch: (search: Record<string, unknown>): ApprovalsSearch => {
    const policyStudioReturnSearch = validatePolicyStudioReturnSearch(search);
    const allowDemo = resolveCockpitRuntime().allowDemoControls;
    return {
      focus: typeof search.focus === 'string' ? search.focus : undefined,
      from: typeof search.from === 'string' ? search.from : undefined,
      demo:
        allowDemo &&
        (search.demo === true ||
          search.demo === 'true' ||
          search.demo === '"true"' ||
          search.demo === 1 ||
          search.demo === '1')
          ? true
          : undefined,
      ...policyStudioReturnSearch,
    };
  },
});

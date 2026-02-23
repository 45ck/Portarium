import { useState, useEffect, useCallback, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { useUIStore } from '@/stores/ui-store';
import { getNextRelevantMode, getPrevRelevantMode } from '@/components/cockpit/triage-modes/index';
import { resolveApprovalContext } from '@/components/cockpit/triage-modes/lib/approval-context';
import { DEFAULT_SOD_EVALUATION } from '../sod-banner';
import type { TriageAction, DragValidation } from './types';

export interface UseTriageCardOptions {
  approval: ApprovalSummary;
  onAction: (approvalId: string, action: TriageAction, rationale: string) => void;
  loading?: boolean;
  plannedEffects: PlanEffect[];
  evidenceEntries: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  undoAvailable: boolean;
  onUndo?: () => void;
  onValidationChange?: (validation: DragValidation) => void;
  dragRejection: 'approve' | 'deny' | null;
}

export function useTriageCard(options: UseTriageCardOptions) {
  const {
    approval,
    onAction,
    loading,
    plannedEffects,
    evidenceEntries,
    run,
    workflow,
    undoAvailable,
    onUndo,
    onValidationChange,
    dragRejection,
  } = options;

  const [rationale, setRationale] = useState('');
  const [requestChangesMode, setRequestChangesMode] = useState(false);
  const [requestChangesMsg, setRequestChangesMsg] = useState('');
  const [denyAttempted, setDenyAttempted] = useState(false);
  const [rationaleHasFocus, setRationaleHasFocus] = useState(false);

  const triageViewMode = useUIStore((s) => s.triageViewMode);
  const setTriageViewMode = useUIStore((s) => s.setTriageViewMode);

  const approvalContext = useMemo(
    () => resolveApprovalContext(approval, plannedEffects, evidenceEntries, run, workflow),
    [approval, plannedEffects, evidenceEntries, run, workflow],
  );

  const sodEval = approval.sodEvaluation ?? DEFAULT_SOD_EVALUATION;
  const policyRule = approval.policyRule;
  const history = approval.decisionHistory ?? [];
  const isBlocked = sodEval.state === 'blocked-self' || sodEval.state === 'blocked-role';
  const isOverdue = Boolean(approval.dueAtIso && new Date(approval.dueAtIso) < new Date());

  const prefersReducedMotion = useReducedMotion();
  const [shakeTarget, setShakeTarget] = useState<'approve' | 'rationale' | null>(null);
  const [flashSodBanner, setFlashSodBanner] = useState(false);

  const hasRationale = rationale.trim().length > 0;

  // Report validation state to deck
  useEffect(() => {
    onValidationChange?.({
      canApprove: !isBlocked,
      canDeny: hasRationale,
      approveBlockReason: isBlocked
        ? sodEval.state === 'blocked-self'
          ? 'You cannot approve your own request'
          : 'Missing required role'
        : undefined,
      denyBlockReason: hasRationale ? undefined : 'Rationale is required to deny',
      currentRationale: rationale,
    });
  }, [isBlocked, hasRationale, rationale, sodEval.state, onValidationChange]);

  // Respond to drag rejection from deck
  useEffect(() => {
    if (dragRejection === 'deny') setDenyAttempted(true);
  }, [dragRejection]);

  useEffect(() => {
    if (dragRejection === 'approve') {
      setFlashSodBanner(true);
      const t = setTimeout(() => setFlashSodBanner(false), 800);
      return () => clearTimeout(t);
    }
  }, [dragRejection]);

  const shouldShakeApprove =
    (dragRejection === 'approve' || shakeTarget === 'approve') && !prefersReducedMotion;
  const shouldShakeRationale =
    (dragRejection === 'deny' || shakeTarget === 'rationale') && !prefersReducedMotion;

  const handleAction = useCallback(
    (action: TriageAction) => {
      if (action === 'RequestChanges') {
        if (!requestChangesMode) {
          setRequestChangesMode(true);
          return;
        }
        onAction(approval.approvalId, action, requestChangesMsg);
        return;
      }
      onAction(approval.approvalId, action, rationale);
    },
    [approval.approvalId, onAction, rationale, requestChangesMode, requestChangesMsg],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.key === 'a' || e.key === 'A') && !loading) {
        if (isBlocked) {
          setShakeTarget('approve');
          setFlashSodBanner(true);
          if (navigator?.vibrate) navigator.vibrate(30);
          setTimeout(() => setShakeTarget(null), 500);
          setTimeout(() => setFlashSodBanner(false), 800);
          return;
        }
        handleAction('Approved');
      }
      if ((e.key === 'd' || e.key === 'D') && !loading) {
        if (!rationale.trim()) {
          setDenyAttempted(true);
          setShakeTarget('rationale');
          if (navigator?.vibrate) navigator.vibrate(30);
          setTimeout(() => setShakeTarget(null), 500);
          return;
        }
        handleAction('Denied');
      }
      if ((e.key === 'r' || e.key === 'R') && !requestChangesMode) setRequestChangesMode(true);
      if ((e.key === 's' || e.key === 'S') && !loading) handleAction('Skip');
      if (e.key === 'v') setTriageViewMode(getNextRelevantMode(triageViewMode, approvalContext));
      if (e.key === 'V') setTriageViewMode(getPrevRelevantMode(triageViewMode, approvalContext));
      if ((e.key === 'z' || e.key === 'Z') && undoAvailable && onUndo) onUndo();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    isBlocked,
    loading,
    rationale,
    requestChangesMode,
    handleAction,
    triageViewMode,
    setTriageViewMode,
    approvalContext,
    undoAvailable,
    onUndo,
  ]);

  return {
    rationale,
    setRationale: (value: string) => {
      setRationale(value);
      if (value.trim()) setDenyAttempted(false);
    },
    requestChangesMode,
    requestChangesMsg,
    setRequestChangesMsg,
    cancelRequestChanges: () => {
      setRequestChangesMode(false);
      setRequestChangesMsg('');
    },
    denyAttempted,
    setDenyAttempted,
    rationaleHasFocus,
    setRationaleHasFocus,
    triageViewMode,
    setTriageViewMode,
    approvalContext,
    sodEval,
    policyRule,
    history,
    isBlocked,
    isOverdue,
    prefersReducedMotion,
    flashSodBanner,
    shouldShakeApprove,
    shouldShakeRationale,
    handleAction,
    plannedEffects,
  };
}

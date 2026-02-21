import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  PolicyRule,
  DecisionHistoryEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  SkipForward,
  Clock,
  User,
  Bot,
  Workflow,
  AlertTriangle,
  ArrowRight,
  Paperclip,
} from 'lucide-react';
import { SodBanner, DEFAULT_SOD_EVALUATION } from './sod-banner';
import { useUIStore } from '@/stores/ui-store';
import { getNextRelevantMode, getPrevRelevantMode } from '@/components/cockpit/triage-modes/index';
import { ModeSwitcher } from '@/components/cockpit/triage-modes/mode-switcher';
import { resolveApprovalContext } from '@/components/cockpit/triage-modes/lib/approval-context';
import { TrafficSignalsMode } from '@/components/cockpit/triage-modes/traffic-signals-mode';
import { BriefingMode } from '@/components/cockpit/triage-modes/briefing-mode';
import { RiskRadarMode } from '@/components/cockpit/triage-modes/risk-radar-mode';
import { BlastMapMode } from '@/components/cockpit/triage-modes/blast-map-mode';
import { DiffViewMode } from '@/components/cockpit/triage-modes/diff-view-mode';
import { ActionReplayMode } from '@/components/cockpit/triage-modes/action-replay-mode';
import { EvidenceChainMode } from '@/components/cockpit/triage-modes/evidence-chain-mode';
import { StoryTimelineMode } from '@/components/cockpit/triage-modes/story-timeline-mode';
import { RoboticsSafetyMode } from '@/components/cockpit/triage-modes/robotics-safety-mode';
import { FinanceImpactMode } from '@/components/cockpit/triage-modes/finance-impact-mode';
import { ComplianceChecklistMode } from '@/components/cockpit/triage-modes/compliance-checklist-mode';
import { AgentOverviewMode } from '@/components/cockpit/triage-modes/agent-overview-mode';
import { ProvenanceJourney } from '@/components/cockpit/provenance-journey';
import { ApprovalContextPanels } from './approval-context-panels';

// ---------------------------------------------------------------------------
// ActorBadge — infers actor type from ID and shows icon + label
// ---------------------------------------------------------------------------
function inferActorType(userId: string): { label: string; Icon: typeof User } {
  const lower = userId.toLowerCase();
  if (lower.startsWith('agent-') || lower.startsWith('bot-') || lower.includes('automation'))
    return { label: 'Agent', Icon: Bot };
  if (lower.startsWith('wf-') || lower.startsWith('workflow-') || lower.includes('orchestrat'))
    return { label: 'Workflow', Icon: Workflow };
  if (lower === 'system' || lower.startsWith('sys-')) return { label: 'System', Icon: Bot };
  return { label: 'User', Icon: User };
}

function ActorBadge({ userId }: { userId: string }) {
  const { label, Icon } = inferActorType(userId);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted shrink-0">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </span>
      <span className="font-medium text-foreground">{userId}</span>
      <span className="text-muted-foreground">({label})</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// SorBadge — color-coded circular badge for each system of record
// ---------------------------------------------------------------------------
import { resolveSorPalette } from '@/components/cockpit/triage-modes/lib/sor-palette';

function SorBadge({ name }: { name: string }) {
  const palette = resolveSorPalette(name);
  const abbr = name.slice(0, 2);
  return (
    <span
      title={name}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0',
        palette.bg,
        palette.text,
      )}
    >
      {abbr}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline triage effect row (avoids modifying shared effects-list.tsx)
// ---------------------------------------------------------------------------
import { opColors } from '@/components/cockpit/lib/effect-colors';

function TriageEffectRow({ effect }: { effect: PlanEffect }) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <Badge variant="secondary" className={cn('text-[10px] shrink-0', opColors[effect.operation])}>
        {effect.operation}
      </Badge>
      <SorBadge name={effect.target.sorName} />
      <span className="font-mono text-muted-foreground text-[11px] shrink-0">
        {effect.target.externalType}
      </span>
      <span className="flex-1 truncate text-foreground">{effect.summary}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PolicyRulePanel — blast radius with SorBadge avatars
// ---------------------------------------------------------------------------
function PolicyRulePanel({ rule }: { rule: PolicyRule }) {
  const irreversibilityLabel = {
    full: 'Fully irreversible',
    partial: 'Partially reversible',
    none: 'Reversible',
  }[rule.irreversibility];
  const irreversibilityCls = {
    full: 'text-red-600 font-medium',
    partial: 'text-yellow-700',
    none: 'text-green-700',
  }[rule.irreversibility];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Policy Rule
        </span>
        <span className="font-mono text-[11px] text-foreground">{rule.ruleId}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {rule.tier}
        </Badge>
      </div>
      <div className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Trigger</span>
        <span className="font-mono text-[11px]">{rule.trigger}</span>
        <span className="text-muted-foreground">Blast radius</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {rule.blastRadius.map((b) =>
            b.includes('record') ? (
              <Badge key={b} variant="outline" className="text-[10px] h-5 px-1.5">
                {b}
              </Badge>
            ) : (
              <span
                key={b}
                className="inline-flex items-center gap-1 text-[11px] border border-border rounded-full px-2 py-0.5 bg-background"
              >
                <SorBadge name={b} />
                {b}
              </span>
            ),
          )}
        </div>
        <span className="text-muted-foreground">Reversibility</span>
        <span className={irreversibilityCls}>{irreversibilityLabel}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RequestChangesHistory — timeline trail
// ---------------------------------------------------------------------------
function RequestChangesHistory({ history }: { history: DecisionHistoryEntry[] }) {
  const dotCls: Record<DecisionHistoryEntry['type'], string> = {
    requested: 'bg-muted-foreground/50',
    changes_requested: 'bg-yellow-500',
    resubmitted: 'bg-blue-500',
  };

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        Decision History
      </p>
      <ol className="relative border-l border-border ml-3 space-y-3 pl-4">
        {history.map((entry) => (
          <li key={`${entry.timestamp}-${entry.actor}`} className="relative">
            <div
              className={cn(
                'absolute -left-[1.375rem] w-2.5 h-2.5 rounded-full border-2 border-background',
                dotCls[entry.type],
              )}
            />
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <time
                  dateTime={entry.timestamp}
                  className="text-muted-foreground text-[11px] shrink-0"
                >
                  {format(new Date(entry.timestamp), 'MMM d, HH:mm')}
                </time>
                <span className="text-muted-foreground font-mono text-[10px]">{entry.actor}</span>
              </div>
              <p className="mt-0.5 text-foreground">{entry.message}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// MODE_COMPONENTS — lookup table replaces 9-branch ternary chain
// ---------------------------------------------------------------------------
import type { TriageModeProps } from '@/components/cockpit/triage-modes/index';
import type { TriageViewMode } from '@/stores/ui-store';

const MODE_COMPONENTS: Partial<Record<TriageViewMode, React.ComponentType<TriageModeProps>>> = {
  'traffic-signals': TrafficSignalsMode,
  briefing: BriefingMode,
  'risk-radar': RiskRadarMode,
  'blast-map': BlastMapMode,
  'diff-view': DiffViewMode,
  'action-replay': ActionReplayMode,
  'evidence-chain': EvidenceChainMode,
  'story-timeline': StoryTimelineMode,
  'robotics-safety': RoboticsSafetyMode,
  'finance-impact': FinanceImpactMode,
  'compliance-checklist': ComplianceChecklistMode,
  'agent-overview': AgentOverviewMode,
};

// ---------------------------------------------------------------------------
// ModeErrorBoundary — prevents Recharts / mode failures from crashing card
// ---------------------------------------------------------------------------
interface ModeErrorBoundaryProps {
  modeKey: string;
  children: React.ReactNode;
}

interface ModeErrorBoundaryState {
  hasError: boolean;
}

class ModeErrorBoundary extends React.Component<ModeErrorBoundaryProps, ModeErrorBoundaryState> {
  state: ModeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ModeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ModeErrorBoundaryProps) {
    if (prevProps.modeKey !== this.props.modeKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
          <p className="text-sm font-medium text-destructive">This view encountered an error</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try switching to another mode or refreshing the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export type TriageAction = 'Approved' | 'Denied' | 'RequestChanges' | 'Skip';

export interface DragValidation {
  canApprove: boolean;
  canDeny: boolean;
  approveBlockReason: string | undefined;
  denyBlockReason: string | undefined;
  currentRationale: string;
}

export interface ApprovalTriageCardProps {
  approval: ApprovalSummary;
  index: number;
  total: number;
  hasMore: boolean;
  onAction: (approvalId: string, action: TriageAction, rationale: string) => void;
  loading?: boolean;
  plannedEffects?: PlanEffect[];
  evidenceEntries?: EvidenceEntry[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
  /** Per-index action history for color-coded progress dots */
  actionHistory?: Record<number, TriageAction>;
  /** Whether an undo is currently available (shows Z hint) */
  undoAvailable?: boolean;
  /** Called when user presses Z to undo */
  onUndo?: () => void;
  /** When true, drag is handled by the deck wrapper */
  externalDrag?: boolean;
  /** Normalized drag progress -1..1, driven by deck */
  dragProgress?: number;
  /** Whether a drag is in progress, from deck */
  isDragging?: boolean;
  /** Reports validation state for drag validation in deck */
  onValidationChange?: (validation: DragValidation) => void;
  /** Set by deck when a drag is rejected — triggers shake feedback */
  dragRejection?: 'approve' | 'deny' | null;
}

export function ApprovalTriageCard({
  approval,
  index,
  total,
  hasMore,
  onAction,
  loading,
  plannedEffects = [],
  evidenceEntries = [],
  run,
  workflow,
  actionHistory = {},
  undoAvailable = false,
  onUndo,
  externalDrag = false,
  dragProgress: externalDragProgress = 0,
  isDragging: externalIsDragging = false,
  onValidationChange,
  dragRejection = null,
}: ApprovalTriageCardProps) {
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
  const triagePosition = index + 1;

  const prefersReducedMotion = useReducedMotion();
  const [shakeTarget, setShakeTarget] = useState<'approve' | 'rationale' | null>(null);
  const [flashSodBanner, setFlashSodBanner] = useState(false);

  const hasRationale = rationale.trim().length > 0;

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
      // V cycles view modes forward, Shift+V backward (context-aware)
      if (e.key === 'v') setTriageViewMode(getNextRelevantMode(triageViewMode, approvalContext));
      if (e.key === 'V') setTriageViewMode(getPrevRelevantMode(triageViewMode, approvalContext));
      // Z triggers undo
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

  // Drag state comes from the deck wrapper
  const dragProgress = externalDragProgress;
  const isDragging = externalIsDragging;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Progress row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          {triagePosition} of {total} pending
        </span>
        <div className="flex gap-1 sm:gap-1.5 overflow-hidden max-w-[60%] sm:max-w-none">
          {Array.from({ length: total }).map((_, i) => {
            const action = actionHistory[i];
            const dotColor =
              i < index && action
                ? ({
                    Approved: 'bg-green-500',
                    Denied: 'bg-red-500',
                    RequestChanges: 'bg-yellow-500',
                    Skip: 'bg-muted-foreground/40',
                  }[action] ?? 'bg-green-500')
                : i < index
                  ? 'bg-green-500'
                  : i === index
                    ? 'bg-primary'
                    : 'bg-muted';
            const justCompleted = i === index - 1 && action;
            return (
              <motion.div
                key={`${approval.approvalId}-${i}`}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300 shrink-0',
                  i === index ? 'w-6 sm:w-8' : 'w-3 sm:w-5',
                  dotColor,
                  i === index && 'animate-pulse',
                )}
                animate={justCompleted ? { scale: [1, 1.8, 1] } : undefined}
                transition={justCompleted ? { duration: 0.3, ease: 'easeOut' } : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Card container — ghost cards and drag visuals are handled by the deck */}
      <div className="relative">
        {/* Main card — deck owns entrance/exit/drag/tint/stamps */}
        <div
          className="relative rounded-xl border border-border bg-card shadow-md overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[480px]"
          style={{ zIndex: 2 }}
        >
          {/* Overdue stripe */}
          {isOverdue && (
            <div className="bg-red-500 px-5 py-1.5 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-white" />
              <span className="text-[11px] font-bold text-white uppercase tracking-wide">
                Overdue
              </span>
              <span className="text-[11px] text-red-100 ml-auto">
                Due {format(new Date(approval.dueAtIso!), 'MMM d, HH:mm')}
              </span>
            </div>
          )}

          {/* Header */}
          <div className="bg-muted/20 px-5 pt-5 pb-4 border-b border-border/50 shrink-0">
            <div className="flex items-start gap-4">
              {/* Icon box */}
              <div className="shrink-0 rounded-xl bg-background border border-border p-3 w-16 h-16 flex items-center justify-center">
                <EntityIcon entityType="approval" size="xl" decorative />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Approval Gate
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {approval.approvalId}
                  </span>
                  {policyRule && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
                      {policyRule.tier}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug">{approval.prompt}</p>

                {/* Requested by — prominent actor line */}
                <div className="flex items-center gap-2 mt-2">
                  <ActorBadge userId={approval.requestedByUserId} />
                  {approval.assigneeUserId && (
                    <>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-foreground">
                          {approval.assigneeUserId}
                        </span>
                      </span>
                    </>
                  )}
                  <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                    {formatDistanceToNow(new Date(approval.requestedAtIso), { addSuffix: true })}
                  </span>
                </div>

                {/* Metadata pills */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5 hover:border-primary/40 transition-colors cursor-default"
                    title={`Run: ${approval.runId}`}
                  >
                    <EntityIcon entityType="run" size="xs" decorative />
                    {approval.runId.slice(0, 12)}
                  </span>
                  {approval.workItemId && (
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5 hover:border-primary/40 transition-colors cursor-default"
                      title={`Work Item: ${approval.workItemId}`}
                    >
                      <EntityIcon entityType="work-item" size="xs" decorative />
                      {approval.workItemId.slice(0, 12)}
                    </span>
                  )}
                  {approval.dueAtIso && !isOverdue && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Due {format(new Date(approval.dueAtIso), 'MMM d')}
                    </span>
                  )}
                  {evidenceEntries.length > 0 &&
                    (() => {
                      const totalAttachments = evidenceEntries.reduce(
                        (s, e) => s + (e.payloadRefs?.length ?? 0),
                        0,
                      );
                      return totalAttachments > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-2.5 py-0.5">
                          <Paperclip className="h-3 w-3" />
                          {totalAttachments} file{totalAttachments !== 1 ? 's' : ''}
                        </span>
                      ) : null;
                    })()}
                </div>
              </div>
            </div>
          </div>

          {/* Mode switcher — below header */}
          <div className="px-5 pt-3 pb-0 shrink-0">
            <ModeSwitcher context={approvalContext} />
          </div>

          {/* Body */}
          <div className="px-5 py-5 flex-1 min-h-0 flex flex-col gap-4">
            {/* SoD evaluation — always visible */}
            <motion.div
              className="shrink-0"
              animate={
                flashSodBanner && !prefersReducedMotion
                  ? {
                      scale: [1, 1.02, 1],
                      boxShadow: [
                        '0 0 0 0px rgba(239,68,68,0)',
                        '0 0 0 3px rgba(239,68,68,0.3)',
                        '0 0 0 0px rgba(239,68,68,0)',
                      ],
                    }
                  : {}
              }
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <SodBanner eval={sodEval} />
            </motion.div>

            {/* Cross-layer context panels for policy/evidence/run timeline */}
            <ApprovalContextPanels
              approval={approval}
              evidenceEntries={evidenceEntries}
              run={run}
              onOpenMode={setTriageViewMode}
            />

            {/* Mode-specific content — AnimatePresence crossfade on mode switch */}
            <ModeErrorBoundary modeKey={triageViewMode}>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-lg">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={triageViewMode}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    {triageViewMode === 'default' ? (
                      <>
                        {/* Provenance journey — shows how this approval got here */}
                        <ProvenanceJourney approval={approval} run={run} workflow={workflow} />

                        {/* Policy rule — shown when available */}
                        {policyRule && (
                          <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
                            <PolicyRulePanel rule={policyRule} />
                          </div>
                        )}

                        {/* Planned effects panel */}
                        {plannedEffects.length > 0 && (
                          <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                              What will happen if approved
                            </p>
                            <div className="divide-y divide-border/40">
                              {plannedEffects.map((e) => (
                                <TriageEffectRow key={e.effectId} effect={e} />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      (() => {
                        const ModeComponent = MODE_COMPONENTS[triageViewMode];
                        return ModeComponent ? (
                          <ModeComponent
                            approval={approval}
                            plannedEffects={plannedEffects}
                            evidenceEntries={evidenceEntries}
                            run={run}
                            workflow={workflow}
                          />
                        ) : null;
                      })()
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </ModeErrorBoundary>

            {/* Decision area */}
            {requestChangesMode ? (
              <div className="shrink-0 space-y-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
                <label className="text-xs font-semibold text-warning-foreground">
                  What needs to change?{' '}
                  <span className="text-red-500" aria-hidden>
                    *
                  </span>
                </label>
                <Textarea
                  autoFocus
                  className="text-xs min-h-[80px] resize-none bg-background"
                  placeholder="Describe what the requestor needs to update before you can approve…"
                  value={requestChangesMsg}
                  onChange={(e) => setRequestChangesMsg(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-9"
                    disabled={!requestChangesMsg.trim() || Boolean(loading)}
                    onClick={() => handleAction('RequestChanges')}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Submit request for changes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setRequestChangesMode(false);
                      setRequestChangesMsg('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="shrink-0 space-y-3">
                <motion.div
                  animate={shouldShakeRationale ? { x: [0, 6, -6, 4, -4, 2, 0] } : { x: 0 }}
                  transition={
                    shouldShakeRationale ? { duration: 0.35, ease: 'easeInOut' } : { duration: 0 }
                  }
                >
                  <Textarea
                    aria-label={`Decision rationale for approval ${approval.approvalId}`}
                    className={cn(
                      'text-xs min-h-[80px] resize-none',
                      denyAttempted &&
                        !rationale.trim() &&
                        'border-yellow-500 focus-visible:ring-yellow-500',
                    )}
                    placeholder="Decision rationale — optional for approve, required for deny…"
                    value={rationale}
                    onChange={(e) => {
                      setRationale(e.target.value);
                      if (e.target.value.trim()) setDenyAttempted(false);
                    }}
                    onFocus={() => setRationaleHasFocus(true)}
                    onBlur={() => setRationaleHasFocus(false)}
                  />
                </motion.div>
                {denyAttempted && !rationale.trim() ? (
                  <p role="alert" className="text-xs text-yellow-600 font-medium">
                    A rationale is required when denying an approval.
                  </p>
                ) : rationale.trim() ? (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Rationale provided
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Required when denying <span className="text-red-500">*</span>
                  </p>
                )}

                <div
                  role="group"
                  aria-label="Make approval decision"
                  className="grid grid-cols-2 sm:grid-cols-[1.5fr_1fr_1fr_0.75fr] gap-2"
                >
                  <motion.div
                    animate={shouldShakeApprove ? { x: [0, 8, -8, 6, -6, 3, 0] } : { x: 0 }}
                    transition={
                      shouldShakeApprove ? { duration: 0.4, ease: 'easeInOut' } : { duration: 0 }
                    }
                  >
                    <Button
                      size="sm"
                      className="h-14 w-full flex-col gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
                      disabled={isBlocked || Boolean(loading)}
                      onClick={() => handleAction('Approved')}
                      title="Approve (A)"
                      aria-keyshortcuts="a"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-[11px]">Approve</span>
                    </Button>
                  </motion.div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-12 flex-col gap-1"
                    disabled={Boolean(loading)}
                    onClick={() => {
                      if (!rationale.trim()) {
                        setDenyAttempted(true);
                        return;
                      }
                      handleAction('Denied');
                    }}
                    title="Deny (D)"
                    aria-keyshortcuts="d"
                  >
                    <XCircle className="h-5 w-5" />
                    <span className="text-[11px]">Deny</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-12 flex-col gap-1"
                    disabled={Boolean(loading)}
                    onClick={() => handleAction('RequestChanges')}
                    title="Request changes (R)"
                    aria-keyshortcuts="r"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span className="text-[11px]">Changes</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 flex-col gap-1 text-muted-foreground"
                    disabled={Boolean(loading)}
                    onClick={() => handleAction('Skip')}
                    title="Skip (S)"
                    aria-keyshortcuts="s"
                  >
                    <SkipForward className="h-4 w-4" />
                    <span className="text-[10px]">Skip</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard hints — contextual */}
      <AnimatePresence mode="wait">
        <motion.div
          key={rationaleHasFocus ? 'focus' : undoAvailable ? 'undo' : 'default'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-4 text-[11px] text-muted-foreground"
        >
          <span className="hidden sm:inline">Keyboard:</span>
          {rationaleHasFocus ? (
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">
                Esc
              </kbd>
              exit
            </span>
          ) : (
            <>
              {(
                [
                  { key: 'A', label: 'approve' },
                  { key: 'D', label: 'deny' },
                  { key: 'R', label: 'changes' },
                  { key: 'S', label: 'skip' },
                  { key: 'V', label: 'view mode' },
                ] as const
              ).map(({ key, label }) => (
                <span key={key} className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">
                    {key}
                  </kbd>
                  {label}
                </span>
              ))}
              {undoAvailable && (
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border border-border">
                    Z
                  </kbd>
                  undo
                </span>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

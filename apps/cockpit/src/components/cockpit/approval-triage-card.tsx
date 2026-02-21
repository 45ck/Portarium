import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  SodEvaluation,
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
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '@/stores/ui-store';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';
import { getNextMode, getPrevMode } from '@/components/cockpit/triage-modes/index';
import { ModeSwitcher } from '@/components/cockpit/triage-modes/mode-switcher';
import { TrafficSignalsMode } from '@/components/cockpit/triage-modes/traffic-signals-mode';
import { BriefingMode } from '@/components/cockpit/triage-modes/briefing-mode';
import { RiskRadarMode } from '@/components/cockpit/triage-modes/risk-radar-mode';
import { BlastMapMode } from '@/components/cockpit/triage-modes/blast-map-mode';
import { DiffViewMode } from '@/components/cockpit/triage-modes/diff-view-mode';
import { ActionReplayMode } from '@/components/cockpit/triage-modes/action-replay-mode';
import { EvidenceChainMode } from '@/components/cockpit/triage-modes/evidence-chain-mode';
import { StoryTimelineMode } from '@/components/cockpit/triage-modes/story-timeline-mode';
import { ProvenanceJourney } from '@/components/cockpit/provenance-journey';

const DEFAULT_SOD_EVALUATION: SodEvaluation = {
  state: 'eligible',
  requestorId: 'unknown',
  ruleId: 'N/A',
  rolesRequired: [],
};

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
// SodBanner — always visible
// ---------------------------------------------------------------------------
function SodBanner({ eval: ev }: { eval: SodEvaluation }) {
  if (ev.state === 'eligible') {
    return (
      <div
        role="status"
        className="rounded-lg bg-success/10 border border-success/30 px-4 py-3 flex items-start gap-3"
      >
        <ShieldCheck className="h-4 w-4 text-success mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-success">You are eligible to approve</p>
          <p className="text-success/80">
            Requestor: <span className="font-mono">{ev.requestorId}</span> (different from you) ·
            Rule: {ev.ruleId} · Roles required: {ev.rolesRequired.join(' OR ')}
          </p>
        </div>
      </div>
    );
  }
  if (ev.state === 'blocked-self') {
    return (
      <div
        role="alert"
        className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-start gap-3"
      >
        <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-destructive">You cannot approve your own request</p>
          <p className="text-destructive/80">SoD rule {ev.ruleId} requires a different approver.</p>
        </div>
      </div>
    );
  }
  if (ev.state === 'blocked-role') {
    return (
      <div
        role="alert"
        className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 flex items-start gap-3"
      >
        <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-destructive">Missing required role</p>
          <p className="text-destructive/80">
            Requires: {ev.rolesRequired.join(' OR ')} — rule {ev.ruleId}
          </p>
        </div>
      </div>
    );
  }
  // n-of-m
  return (
    <div
      role="status"
      className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 flex items-start gap-3"
    >
      <ShieldCheck className="h-4 w-4 text-warning mt-0.5 shrink-0" />
      <div className="text-xs space-y-1">
        <p className="font-semibold text-warning-foreground">
          {ev.nRequired} of {ev.nTotal} approvers needed — {(ev.nRequired ?? 0) - (ev.nSoFar ?? 0)}{' '}
          more required after you
        </p>
        <p className="text-warning-foreground/80">
          Rule: {ev.ruleId} · {ev.nSoFar} approval{ev.nSoFar !== 1 ? 's' : ''} recorded so far
        </p>
      </div>
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
}: ApprovalTriageCardProps) {
  const [rationale, setRationale] = useState('');
  const [requestChangesMode, setRequestChangesMode] = useState(false);
  const [requestChangesMsg, setRequestChangesMsg] = useState('');
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);
  const [denyAttempted, setDenyAttempted] = useState(false);
  const [rationaleHasFocus, setRationaleHasFocus] = useState(false);

  const triageViewMode = useUIStore((s) => s.triageViewMode);
  const setTriageViewMode = useUIStore((s) => s.setTriageViewMode);

  const sodEval = approval.sodEvaluation ?? DEFAULT_SOD_EVALUATION;
  const policyRule = approval.policyRule;
  const history = approval.decisionHistory ?? [];
  const isBlocked = sodEval.state === 'blocked-self' || sodEval.state === 'blocked-role';
  const isOverdue = Boolean(approval.dueAtIso && new Date(approval.dueAtIso) < new Date());
  const triagePosition = index + 1;

  const handleAction = useCallback(
    (action: TriageAction) => {
      if (action === 'RequestChanges') {
        if (!requestChangesMode) {
          setRequestChangesMode(true);
          return;
        }
        if (externalDrag) {
          onAction(approval.approvalId, action, requestChangesMsg);
          return;
        }
        const dir: 'left' | 'right' = 'left';
        setExitDir(dir);
        setTimeout(() => {
          setExitDir(null);
          onAction(approval.approvalId, action, requestChangesMsg);
        }, 320);
        return;
      }
      if (externalDrag) {
        onAction(approval.approvalId, action, rationale);
        return;
      }
      const dir: 'left' | 'right' = action === 'Approved' ? 'right' : 'left';
      setExitDir(dir);
      setTimeout(() => {
        setExitDir(null);
        onAction(approval.approvalId, action, rationale);
      }, 320);
    },
    [approval.approvalId, onAction, rationale, requestChangesMode, requestChangesMsg, externalDrag],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.key === 'a' || e.key === 'A') && !isBlocked && !loading) handleAction('Approved');
      if ((e.key === 'd' || e.key === 'D') && !loading) {
        if (!rationale.trim()) {
          setDenyAttempted(true);
          return;
        }
        handleAction('Denied');
      }
      if ((e.key === 'r' || e.key === 'R') && !requestChangesMode) setRequestChangesMode(true);
      if ((e.key === 's' || e.key === 'S') && !loading) handleAction('Skip');
      // V cycles view modes forward, Shift+V backward
      if (e.key === 'v') setTriageViewMode(getNextMode(triageViewMode));
      if (e.key === 'V') setTriageViewMode(getPrevMode(triageViewMode));
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
    undoAvailable,
    onUndo,
  ]);

  // Swipe gesture — disabled when deck owns drag
  const {
    dragStyle,
    pointerHandlers,
    progress: internalDragProgress,
    isDragging: internalIsDragging,
  } = useSwipeGesture({
    onSwipeRight: () => {
      if (!isBlocked && !loading) handleAction('Approved');
    },
    onSwipeLeft: () => {
      if (loading) return false;
      if (!rationale.trim()) {
        setDenyAttempted(true);
        toast.info('A rationale is required when denying an approval.', { duration: 2500 });
        return false;
      }
      handleAction('Denied');
      return true;
    },
    disabled:
      externalDrag || Boolean(loading) || isBlocked || requestChangesMode || Boolean(exitDir),
  });

  // Use deck-driven values when externalDrag, otherwise internal
  const dragProgress = externalDrag ? externalDragProgress : internalDragProgress;
  const isDragging = externalDrag ? externalIsDragging : internalIsDragging;

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

      {/* Stacked card effect — ghost cards behind (skipped when deck owns visuals) */}
      <div className="relative">
        {!externalDrag && hasMore && (
          <>
            <div
              className="absolute inset-x-6 rounded-xl border border-border bg-card/60 transition-transform duration-200 ease-out"
              style={{
                top: `${8 - (isDragging ? Math.min(Math.abs(dragProgress) * 3, 4) : 0)}px`,
                bottom: `${-8 + (isDragging ? Math.min(Math.abs(dragProgress) * 3, 4) : 0)}px`,
                zIndex: 0,
                transform: isDragging
                  ? `scale(${0.94 + Math.min(Math.abs(dragProgress) * 0.03, 0.03)})`
                  : 'scale(0.94)',
              }}
            />
            <div
              className="absolute inset-x-3 rounded-xl border border-border bg-card/80 transition-transform duration-200 ease-out"
              style={{
                top: `${4 - (isDragging ? Math.min(Math.abs(dragProgress) * 2, 3) : 0)}px`,
                bottom: `${-4 + (isDragging ? Math.min(Math.abs(dragProgress) * 2, 3) : 0)}px`,
                zIndex: 1,
                transform: isDragging
                  ? `scale(${0.97 + Math.min(Math.abs(dragProgress) * 0.02, 0.02)})`
                  : 'scale(0.97)',
              }}
            />
          </>
        )}

        {/* Main card — deck owns entrance/exit/drag when externalDrag is true */}
        <div
          className={cn(
            'relative rounded-xl border border-border bg-card shadow-md overflow-hidden',
            !externalDrag && exitDir === 'right' && 'animate-triage-out-right',
            !externalDrag && exitDir === 'left' && 'animate-triage-out-left',
            !externalDrag && !exitDir && 'animate-triage-in',
            !externalDrag && !exitDir && !isDragging && 'cursor-grab',
          )}
          style={{ zIndex: 2, ...(!externalDrag && !exitDir ? dragStyle : {}) }}
          {...(!externalDrag && !exitDir ? pointerHandlers : {})}
        >
          {/* Directional tint overlay — skipped when deck owns drag visuals */}
          {!externalDrag && isDragging && !exitDir && Math.abs(dragProgress) > 0.05 && (
            <div
              className="absolute inset-0 pointer-events-none z-10 rounded-xl"
              style={{
                background:
                  dragProgress > 0
                    ? `linear-gradient(100deg, rgba(34,197,94,${Math.min(Math.abs(dragProgress) * 0.12, 0.12)}) 0%, transparent 60%)`
                    : `linear-gradient(260deg, rgba(239,68,68,${Math.min(Math.abs(dragProgress) * 0.12, 0.12)}) 0%, transparent 60%)`,
              }}
            />
          )}

          {/* Decision stamps — skipped when deck owns drag visuals */}
          {!externalDrag && isDragging && !exitDir && Math.abs(dragProgress) > 0.3 && (
            <>
              {dragProgress > 0.3 && (
                <div
                  className="absolute top-6 right-4 sm:top-8 sm:right-6 z-10 pointer-events-none select-none"
                  style={{ opacity: Math.min((dragProgress - 0.3) / 0.7, 1) }}
                >
                  <span
                    className="text-green-600 text-lg sm:text-2xl font-bold uppercase tracking-widest border-[3px] sm:border-4 border-green-600 rounded-sm px-2 py-0.5 sm:px-3 sm:py-1"
                    style={{ transform: 'rotate(-12deg)', display: 'inline-block' }}
                  >
                    Approved
                  </span>
                </div>
              )}
              {dragProgress < -0.3 && (
                <div
                  className="absolute top-6 left-4 sm:top-8 sm:left-6 z-10 pointer-events-none select-none"
                  style={{ opacity: Math.min((Math.abs(dragProgress) - 0.3) / 0.7, 1) }}
                >
                  <span
                    className="text-red-600 text-lg sm:text-2xl font-bold uppercase tracking-widest border-[3px] sm:border-4 border-red-600 rounded-sm px-2 py-0.5 sm:px-3 sm:py-1"
                    style={{ transform: 'rotate(12deg)', display: 'inline-block' }}
                  >
                    Denied
                  </span>
                </div>
              )}
            </>
          )}
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
          <div className="bg-muted/20 px-5 pt-5 pb-4 border-b border-border/50">
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
          <div className="px-5 pt-3 pb-0">
            <ModeSwitcher />
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4">
            {/* SoD evaluation — always visible */}
            <SodBanner eval={sodEval} />

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
              <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
                <label className="text-xs font-semibold text-warning-foreground">
                  What needs to change?{' '}
                  <span className="text-red-500" aria-hidden>
                    *
                  </span>
                </label>
                <Textarea
                  autoFocus
                  className="text-xs min-h-[80px] resize-none bg-white"
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
              <div className="space-y-3">
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
                  <Button
                    size="sm"
                    className="h-14 flex-col gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
                    disabled={isBlocked || Boolean(loading)}
                    onClick={() => handleAction('Approved')}
                    title="Approve (A)"
                    aria-keyshortcuts="a"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-[11px]">Approve</span>
                  </Button>
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
      <div
        key={rationaleHasFocus ? 'focus' : undoAvailable ? 'undo' : 'default'}
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-4 text-[11px] text-muted-foreground animate-mode-crossfade"
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
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
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
import { useUIStore } from '@/stores/ui-store';
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
const SOR_PALETTE: Record<string, { bg: string; text: string }> = {
  Odoo: { bg: 'bg-indigo-600', text: 'text-white' },
  Stripe: { bg: 'bg-violet-600', text: 'text-white' },
  NetSuite: { bg: 'bg-blue-600', text: 'text-white' },
  Okta: { bg: 'bg-sky-500', text: 'text-white' },
  Mautic: { bg: 'bg-orange-500', text: 'text-white' },
  Zammad: { bg: 'bg-rose-500', text: 'text-white' },
  Vault: { bg: 'bg-amber-500', text: 'text-white' },
};

const SOR_PALETTE_DEFAULT = { bg: 'bg-muted', text: 'text-muted-foreground' };

function SorBadge({ name }: { name: string }) {
  const palette = SOR_PALETTE[name] ?? SOR_PALETTE_DEFAULT;
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
      className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-start gap-3"
    >
      <ShieldCheck className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
      <div className="text-xs space-y-1">
        <p className="font-semibold text-yellow-800">
          {ev.nRequired} of {ev.nTotal} approvers needed — {(ev.nRequired ?? 0) - (ev.nSoFar ?? 0)}{' '}
          more required after you
        </p>
        <p className="text-yellow-700">
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
// Main export
// ---------------------------------------------------------------------------
export type TriageAction = 'Approved' | 'Denied' | 'RequestChanges' | 'Skip';

interface ApprovalTriageCardProps {
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
}: ApprovalTriageCardProps) {
  const [rationale, setRationale] = useState('');
  const [requestChangesMode, setRequestChangesMode] = useState(false);
  const [requestChangesMsg, setRequestChangesMsg] = useState('');
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);
  const [denyAttempted, setDenyAttempted] = useState(false);

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
        const dir: 'left' | 'right' = 'left';
        setExitDir(dir);
        setTimeout(() => {
          setExitDir(null);
          onAction(approval.approvalId, action, requestChangesMsg);
        }, 320);
        return;
      }
      const dir: 'left' | 'right' = action === 'Approved' ? 'right' : 'left';
      setExitDir(dir);
      setTimeout(() => {
        setExitDir(null);
        onAction(approval.approvalId, action, rationale);
      }, 320);
    },
    [approval.approvalId, onAction, rationale, requestChangesMode, requestChangesMsg],
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
  ]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Progress row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">
          {triagePosition} of {total} pending
        </span>
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={`${approval.approvalId}-${i}`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i < index ? 'w-5 bg-green-500' : i === index ? 'w-8 bg-primary' : 'w-5 bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* Stacked card effect — ghost cards behind when queue has more items */}
      <div className="relative">
        {hasMore && (
          <>
            <div
              className="absolute inset-x-6 rounded-xl border border-border bg-card/60"
              style={{ top: '8px', bottom: '-8px', zIndex: 0 }}
            />
            <div
              className="absolute inset-x-3 rounded-xl border border-border bg-card/80"
              style={{ top: '4px', bottom: '-4px', zIndex: 1 }}
            />
          </>
        )}

        {/* Main card — animate-triage-in only on card mount (keyed by approvalId),
             mode switches use crossfade on the content area below */}
        <div
          className={cn(
            'relative rounded-xl border border-border bg-card shadow-md overflow-hidden',
            exitDir === 'right' && 'animate-triage-out-right',
            exitDir === 'left' && 'animate-triage-out-left',
            !exitDir && 'animate-triage-in',
          )}
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

            {/* Mode-specific content — keyed crossfade so mode switches don't jolt the card */}
            <div key={triageViewMode} className="animate-mode-crossfade">
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
              ) : triageViewMode === 'traffic-signals' ? (
                <TrafficSignalsMode
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                />
              ) : triageViewMode === 'briefing' ? (
                <BriefingMode
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                />
              ) : triageViewMode === 'risk-radar' ? (
                <RiskRadarMode
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                />
              ) : triageViewMode === 'blast-map' ? (
                <BlastMapMode
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                />
              ) : triageViewMode === 'diff-view' ? (
                <DiffViewMode
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                />
              ) : triageViewMode === 'action-replay' ? (
                <ActionReplayMode
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                />
              ) : triageViewMode === 'evidence-chain' ? (
                <EvidenceChainMode
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                />
              ) : triageViewMode === 'story-timeline' ? (
                <StoryTimelineMode
                  approval={approval}
                  plannedEffects={plannedEffects}
                  evidenceEntries={evidenceEntries}
                  run={run}
                  workflow={workflow}
                />
              ) : null}
            </div>

            {/* Decision area */}
            {requestChangesMode ? (
              <div className="space-y-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <label className="text-xs font-semibold text-yellow-900">
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
                />
                <p className="text-xs text-muted-foreground">
                  Required when denying <span className="text-red-500">*</span>
                </p>

                <div
                  role="group"
                  aria-label="Make approval decision"
                  className="grid grid-cols-4 gap-2"
                >
                  <Button
                    size="sm"
                    className="h-12 flex-col gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
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
                    className="h-12 flex-col gap-1 text-muted-foreground"
                    disabled={Boolean(loading)}
                    onClick={() => handleAction('Skip')}
                    title="Skip (S)"
                    aria-keyshortcuts="s"
                  >
                    <SkipForward className="h-5 w-5" />
                    <span className="text-[11px]">Skip</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span>Keyboard:</span>
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
      </div>
    </div>
  );
}

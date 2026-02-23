/**
 * Approval Review Panel — deep inspection UX (bead-58yp).
 *
 * A full-page detail view for deliberate review of high-risk or complex
 * approval requests. Complements triage mode by providing exhaustive
 * context: policy evaluation results, evidence chain timeline, planned
 * effects, and decision capture with structured rationale.
 *
 * Layout (top to bottom):
 *   1. Approval header (ApprovalShell-style, with risk and SoD context)
 *   2. Tabbed content area:
 *      - Evidence: hash-chain timeline with category badges
 *      - Policy: per-policy evaluation results with rule traces
 *      - Effects: planned external effects with blast radius
 *      - Discussion: prior decisions and inline feedback
 *   3. Decision panel: approve/deny/request-changes with rationale
 */

import { useState } from 'react';
import { format } from 'date-fns';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  PolicyRule,
  DecisionHistoryEntry,
} from '@portarium/cockpit-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Link2,
  ShieldCheck,
  Zap,
  MessageCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  Hash,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewTab = 'evidence' | 'policy' | 'effects' | 'discussion';

/** Extended policy evaluation result for display in review mode. */
export interface PolicyEvaluationDisplay {
  policyId: string;
  policyName: string;
  outcome: 'pass' | 'fail' | 'needs_human' | 'error';
  explanation: string;
  ruleTraces?: readonly PolicyRuleTraceDisplay[];
}

export interface PolicyRuleTraceDisplay {
  ruleId: string;
  condition: string;
  effect: 'Allow' | 'Deny';
  outcome: 'matched' | 'not_matched' | 'error';
  explanation: string;
}

export interface ApprovalReviewPanelProps {
  approval: ApprovalSummary;
  evidenceEntries?: EvidenceEntry[];
  policyEvaluations?: PolicyEvaluationDisplay[];
  plannedEffects?: PlanEffect[];
  onDecide: (decision: 'Approved' | 'Denied' | 'RequestChanges', rationale: string) => void;
  loading?: boolean;
  /** Initial tab to display. Defaults to 'evidence'. */
  initialTab?: ReviewTab;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS: { id: ReviewTab; label: string; icon: typeof Link2 }[] = [
  { id: 'evidence', label: 'Evidence Chain', icon: Link2 },
  { id: 'policy', label: 'Policy', icon: ShieldCheck },
  { id: 'effects', label: 'Effects', icon: Zap },
  { id: 'discussion', label: 'Discussion', icon: MessageCircle },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EvidenceTimeline({ entries }: { entries: EvidenceEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No evidence entries recorded yet.</p>;
  }

  const categoryColor: Record<string, string> = {
    Approval: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    Policy: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    Action: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    System: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <ol className="relative border-l border-border ml-3 space-y-4 pl-5">
      {entries.map((entry) => (
        <li key={entry.evidenceId} className="relative">
          <div className="absolute -left-[1.625rem] w-3 h-3 rounded-full border-2 border-background bg-primary" />
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px] px-1.5 py-0 font-medium',
                  categoryColor[entry.category] ?? categoryColor['System'],
                )}
              >
                {entry.category}
              </Badge>
              <time dateTime={entry.occurredAtIso} className="text-[11px] text-muted-foreground">
                {format(new Date(entry.occurredAtIso), 'MMM d, HH:mm:ss')}
              </time>
            </div>
            <p className="text-sm">{entry.summary}</p>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
              <Hash className="h-3 w-3" />
              <span title={entry.hashSha256}>{entry.hashSha256.slice(0, 16)}...</span>
              {entry.previousHash && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span title={entry.previousHash}>{entry.previousHash.slice(0, 16)}...</span>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PolicyEvaluationList({ evaluations }: { evaluations: PolicyEvaluationDisplay[] }) {
  if (evaluations.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No policy evaluations available.</p>;
  }

  const outcomeStyle: Record<string, string> = {
    pass: 'text-green-700 dark:text-green-400',
    fail: 'text-red-700 dark:text-red-400',
    needs_human: 'text-amber-700 dark:text-amber-400',
    error: 'text-gray-500',
  };

  const outcomeBadge: Record<string, string> = {
    pass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    fail: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    needs_human: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    error: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <div className="space-y-4">
      {evaluations.map((ev) => (
        <div key={ev.policyId} className="border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">{ev.policyName}</h4>
              <span className="text-[11px] font-mono text-muted-foreground">{ev.policyId}</span>
            </div>
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-2 py-0.5 font-semibold', outcomeBadge[ev.outcome])}
            >
              {ev.outcome}
            </Badge>
          </div>
          <p className={cn('text-xs', outcomeStyle[ev.outcome])}>{ev.explanation}</p>

          {ev.ruleTraces && ev.ruleTraces.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Rule Traces
              </p>
              {ev.ruleTraces.map((trace) => (
                <div
                  key={trace.ruleId}
                  className="text-xs flex items-start gap-2 py-1 border-b border-border/50 last:border-0"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] px-1 py-0 shrink-0',
                      trace.effect === 'Deny'
                        ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                        : 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400',
                    )}
                  >
                    {trace.effect}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {trace.ruleId}
                      </span>
                      <span
                        className={cn(
                          'text-[10px]',
                          trace.outcome === 'matched'
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground',
                        )}
                      >
                        {trace.outcome}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5">{trace.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EffectsList({ effects }: { effects: PlanEffect[] }) {
  if (effects.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No planned effects.</p>;
  }

  const opColor: Record<string, string> = {
    Create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    Update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    Delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    Upsert: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  };

  return (
    <div className="space-y-2">
      {effects.map((effect) => (
        <div
          key={effect.effectId}
          className="flex items-start gap-3 border border-border rounded-lg p-3"
        >
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] px-1.5 py-0 font-semibold shrink-0',
              opColor[effect.operation] ?? opColor['Update'],
            )}
          >
            {effect.operation}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{effect.summary}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="font-mono">{effect.target.externalType}</span>
              <span className="text-border">|</span>
              <span>{effect.target.sorName}</span>
              {effect.target.deepLinkUrl && (
                <a
                  href={effect.target.deepLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground mt-2">
        {effects.length} effect{effects.length !== 1 ? 's' : ''} planned
      </p>
    </div>
  );
}

function DiscussionPanel({ history }: { history: DecisionHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No prior decisions or discussion on this approval.
      </p>
    );
  }

  const typeLabel: Record<DecisionHistoryEntry['type'], string> = {
    requested: 'Requested',
    changes_requested: 'Changes Requested',
    resubmitted: 'Resubmitted',
  };

  const typeBadge: Record<DecisionHistoryEntry['type'], string> = {
    requested: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    changes_requested: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    resubmitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };

  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div
          key={`${entry.timestamp}-${entry.actor}`}
          className="border border-border rounded-lg p-3 space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{entry.actor}</span>
              <Badge
                variant="secondary"
                className={cn('text-[10px] px-1.5 py-0', typeBadge[entry.type])}
              >
                {typeLabel[entry.type]}
              </Badge>
            </div>
            <time dateTime={entry.timestamp} className="text-[11px] text-muted-foreground">
              {format(new Date(entry.timestamp), 'MMM d, HH:mm')}
            </time>
          </div>
          <p className="text-sm text-foreground">{entry.message}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ApprovalReviewPanel({
  approval,
  evidenceEntries = [],
  policyEvaluations = [],
  plannedEffects = [],
  onDecide,
  loading,
  initialTab = 'evidence',
}: ApprovalReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<ReviewTab>(initialTab);
  const history = approval.decisionHistory ?? [];

  const tabContent: Record<ReviewTab, React.ReactNode> = {
    evidence: <EvidenceTimeline entries={evidenceEntries} />,
    policy: <PolicyEvaluationList evaluations={policyEvaluations} />,
    effects: <EffectsList effects={plannedEffects} />,
    discussion: <DiscussionPanel history={history} />,
  };

  const tabCounts: Partial<Record<ReviewTab, number>> = {
    evidence: evidenceEntries.length,
    effects: plannedEffects.length,
    discussion: history.length,
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden bg-background"
      data-testid="approval-review-panel"
    >
      {/* Header */}
      <div className="bg-muted/20 px-6 py-5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Review
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">{approval.approvalId}</span>
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] ml-auto',
              approval.status === 'Pending'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                : approval.status === 'Approved'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
            )}
          >
            {approval.status}
          </Badge>
        </div>
        <p className="text-base font-semibold leading-snug">{approval.prompt}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>
            By <span className="font-medium text-foreground">{approval.requestedByUserId}</span>
          </span>
          {approval.assigneeUserId && (
            <span>
              Assigned to{' '}
              <span className="font-medium text-foreground">{approval.assigneeUserId}</span>
            </span>
          )}
          {approval.policyRule && (
            <span className="font-mono text-[10px]">Policy: {approval.policyRule.ruleId}</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors',
                'border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className="text-[10px] bg-muted rounded-full px-1.5 py-0 ml-0.5">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4" role="tabpanel">
        {tabContent[activeTab]}
      </div>

      {/* Decision bar — pending only */}
      {approval.status === 'Pending' && (
        <div className="shrink-0 border-t border-border bg-muted/10 px-6 py-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white border-0"
              disabled={Boolean(loading)}
              onClick={() => onDecide('Approved', '')}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Approve
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 h-9"
              disabled={Boolean(loading)}
              onClick={() => onDecide('Denied', '')}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Deny
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={Boolean(loading)}
              onClick={() => onDecide('RequestChanges', '')}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Request Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

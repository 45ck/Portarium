import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { ApprovalSummary, DecisionHistoryEntry } from '@portarium/cockpit-types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge';
import { SodBanner, DEFAULT_SOD_EVALUATION } from './sod-banner';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, RotateCcw, Clock, AlertTriangle, User } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ApprovalShellProps {
  approval: ApprovalSummary;
  onDecide: (decision: 'Approved' | 'Denied' | 'RequestChanges', rationale: string) => void;
  loading?: boolean;
  /** Domain-specific content rendered inside the shell's content area. */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// DecisionHistoryTimeline
// ---------------------------------------------------------------------------

function DecisionHistoryTimeline({ history }: { history: DecisionHistoryEntry[] }) {
  const dotCls: Record<DecisionHistoryEntry['type'], string> = {
    requested: 'bg-muted-foreground/50',
    changes_requested: 'bg-yellow-500',
    resubmitted: 'bg-blue-500',
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Prior Decisions
      </p>
      <ol className="relative border-l border-border ml-3 space-y-2 pl-4">
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
                <span className="text-muted-foreground font-mono text-[11px]">{entry.actor}</span>
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
// ApprovalShell
// ---------------------------------------------------------------------------

export function ApprovalShell({ approval, onDecide, loading, children }: ApprovalShellProps) {
  const [rationale, setRationale] = useState('');
  const [denyAttempted, setDenyAttempted] = useState(false);

  const isPending = approval.status === 'Pending';
  const sodEval = approval.sodEvaluation ?? DEFAULT_SOD_EVALUATION;
  const isBlocked = sodEval.state === 'blocked-self' || sodEval.state === 'blocked-role';
  const isOverdue = Boolean(approval.dueAtIso && new Date(approval.dueAtIso) < new Date());
  const history = approval.decisionHistory ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-border bg-card shadow-md">
      {/* Overdue stripe */}
      {isOverdue && (
        <div className="bg-red-500 px-4 py-1.5 flex items-center gap-2 shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 text-white" />
          <span className="text-[11px] font-bold text-white uppercase tracking-wide">Overdue</span>
          <span className="text-[11px] text-red-100 ml-auto">
            Due {format(new Date(approval.dueAtIso!), 'MMM d, HH:mm')}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-muted/20 px-5 pt-5 pb-4 border-b border-border/50 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Approval
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {approval.approvalId}
              </span>
            </div>
            <p className="text-sm font-semibold leading-snug">{approval.prompt}</p>

            {/* Actor line */}
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium text-foreground">{approval.requestedByUserId}</span>
              </span>
              {approval.assigneeUserId && (
                <>
                  <span className="text-muted-foreground">&rarr;</span>
                  <span className="font-medium text-foreground">{approval.assigneeUserId}</span>
                </>
              )}
              <span className="text-muted-foreground ml-auto shrink-0">
                {formatDistanceToNow(new Date(approval.requestedAtIso), { addSuffix: true })}
              </span>
            </div>

            {/* Due date (non-overdue) */}
            {approval.dueAtIso && !isOverdue && (
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Due {format(new Date(approval.dueAtIso), 'MMM d')}
              </div>
            )}
          </div>
          <ApprovalStatusBadge status={approval.status} />
        </div>
      </div>

      {/* SoD banner — pending only */}
      {isPending && (
        <div className="px-5 pt-3 shrink-0">
          <SodBanner eval={sodEval} />
        </div>
      )}

      {/* Decision history */}
      {history.length > 0 && (
        <div className="px-5 pt-3 shrink-0">
          <DecisionHistoryTimeline history={history} />
        </div>
      )}

      {/* Content area — domain-specific renderer output */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>

      {/* Action bar — pending only */}
      {isPending ? (
        <div className="shrink-0 border-t border-border bg-muted/10 px-5 py-4 space-y-3">
          <Textarea
            className={cn(
              'text-xs min-h-[60px] resize-none',
              denyAttempted &&
                !rationale.trim() &&
                'border-yellow-500 focus-visible:ring-yellow-500',
            )}
            placeholder="Decision rationale — optional for approve, required for deny..."
            value={rationale}
            onChange={(e) => {
              setRationale(e.target.value);
              if (e.target.value.trim()) setDenyAttempted(false);
            }}
          />
          {denyAttempted && !rationale.trim() && (
            <p role="alert" className="text-xs text-yellow-600 font-medium">
              A rationale is required when denying an approval.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white border-0"
              disabled={isBlocked || Boolean(loading)}
              onClick={() => onDecide('Approved', rationale)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Approve
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 h-9"
              disabled={Boolean(loading)}
              onClick={() => {
                if (!rationale.trim()) {
                  setDenyAttempted(true);
                  return;
                }
                onDecide('Denied', rationale);
              }}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Deny
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={Boolean(loading)}
              onClick={() => onDecide('RequestChanges', rationale)}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Request Changes
            </Button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-border bg-muted/10 px-5 py-3">
          {approval.rationale && (
            <div className="text-xs space-y-1 mb-2">
              <span className="text-muted-foreground font-medium">Rationale:</span>
              <p className="text-foreground">{approval.rationale}</p>
            </div>
          )}
          {approval.decidedByUserId && (
            <div className="text-xs text-muted-foreground">
              Decided by{' '}
              <span className="font-medium text-foreground">{approval.decidedByUserId}</span>
              {approval.decidedAtIso &&
                ` on ${format(new Date(approval.decidedAtIso), 'MMM d, yyyy HH:mm')}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

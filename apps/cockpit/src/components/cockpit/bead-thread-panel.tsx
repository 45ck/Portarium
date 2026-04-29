import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Shield,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type BeadThreadEntry,
  type BeadThreadStreamState,
  useBeadThreadStream,
} from '@/hooks/queries/use-bead-thread-stream';
import { cn } from '@/lib/utils';

const POLICY_TIER_LABELS: Record<BeadThreadEntry['policyTier'], string> = {
  Auto: 'AUTO',
  Assisted: 'ASSISTED',
  HumanApprove: 'HUMAN-APPROVE',
  ManualOnly: 'MANUAL-ONLY',
};

const BLAST_RADIUS_LABELS: Record<BeadThreadEntry['blastRadius'], string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

const STATUS_CONFIG: Record<
  BeadThreadEntry['status'],
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'text-muted-foreground',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    className: 'text-info',
  },
  success: {
    label: 'OK',
    icon: CheckCircle2,
    className: 'text-success',
  },
  error: {
    label: 'Error',
    icon: AlertTriangle,
    className: 'text-destructive',
  },
  awaiting_approval: {
    label: 'Awaiting approval',
    icon: Shield,
    className: 'text-warning',
  },
};

const POLICY_BADGE_VARIANT: Record<
  BeadThreadEntry['policyTier'],
  'secondary' | 'outline' | 'warning' | 'destructive'
> = {
  Auto: 'secondary',
  Assisted: 'outline',
  HumanApprove: 'warning',
  ManualOnly: 'destructive',
};

const BLAST_BADGE_CLASS: Record<BeadThreadEntry['blastRadius'], string> = {
  low: 'border-border text-muted-foreground',
  medium: 'border-warning/50 bg-warning/10 text-warning-foreground',
  high: 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  critical: 'border-destructive/50 bg-destructive/10 text-destructive',
};

export interface BeadThreadPanelProps {
  workspaceId: string;
  beadId: string;
  beadTitle?: string;
  onReviewApproval?: (approvalId: string, entry: BeadThreadEntry) => void;
  streamState?: BeadThreadStreamState;
}

function formatArgs(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return 'No arguments';
  return keys
    .slice(0, 3)
    .map((key) => `${key}: ${String(args[key])}`)
    .join(' · ');
}

function streamLabel(status: BeadThreadStreamState['status']): string {
  if (status === 'open') return 'Live';
  if (status === 'reconnecting') return 'Reconnecting';
  if (status === 'connecting') return 'Connecting';
  if (status === 'error') return 'Stream error';
  return 'Idle';
}

function EntryStatus({ entry }: { entry: BeadThreadEntry }) {
  const config = STATUS_CONFIG[entry.status];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', config.className)}>
      <Icon className={cn('h-3.5 w-3.5', entry.status === 'running' && 'animate-spin')} />
      {config.label}
    </span>
  );
}

function ApprovalGate({
  entry,
  onReviewApproval,
}: {
  entry: BeadThreadEntry;
  onReviewApproval?: (approvalId: string, entry: BeadThreadEntry) => void;
}) {
  if (entry.status !== 'awaiting_approval') return null;
  const canReview = Boolean(entry.approvalId && onReviewApproval);

  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="warning" className="h-5 text-[11px]">
              Approval Gate
            </Badge>
            {entry.policyRuleId && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {entry.policyRuleId}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-foreground">
            {entry.message ?? entry.rationale ?? `${entry.toolName} is waiting for human review.`}
          </p>
          {entry.approvalId && (
            <p className="font-mono text-[11px] text-muted-foreground">
              approval {entry.approvalId}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-full shrink-0 text-xs sm:w-auto"
          disabled={!canReview}
          onClick={() => {
            if (entry.approvalId) onReviewApproval?.(entry.approvalId, entry);
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Review
        </Button>
      </div>
    </div>
  );
}

function ThreadEntry({
  entry,
  onReviewApproval,
}: {
  entry: BeadThreadEntry;
  onReviewApproval?: (approvalId: string, entry: BeadThreadEntry) => void;
}) {
  return (
    <li
      className={cn(
        'rounded-lg border bg-background px-3 py-3',
        entry.status === 'awaiting_approval' ? 'border-warning/50' : 'border-border',
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{entry.toolName}</span>
            <EntryStatus entry={entry} />
          </div>
          <p className="truncate text-xs text-muted-foreground" title={formatArgs(entry.args)}>
            {formatArgs(entry.args)}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {entry.agentId && <span>agent {entry.agentId}</span>}
            {entry.occurredAtIso && <span>{entry.occurredAtIso}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Badge variant={POLICY_BADGE_VARIANT[entry.policyTier]} className="h-5 text-[11px]">
            {POLICY_TIER_LABELS[entry.policyTier]}
          </Badge>
          <Badge
            variant="outline"
            className={cn('h-5 text-[11px]', BLAST_BADGE_CLASS[entry.blastRadius])}
          >
            {BLAST_RADIUS_LABELS[entry.blastRadius]}
          </Badge>
        </div>
      </div>
      <ApprovalGate entry={entry} onReviewApproval={onReviewApproval} />
    </li>
  );
}

export function BeadThreadPanel({
  workspaceId,
  beadId,
  beadTitle,
  onReviewApproval,
  streamState,
}: BeadThreadPanelProps) {
  const liveState = useBeadThreadStream(workspaceId, beadId);
  const state = streamState ?? liveState;
  const awaitingCount = state.entries.filter(
    (entry) => entry.status === 'awaiting_approval',
  ).length;

  return (
    <Card className="h-full gap-0 overflow-hidden rounded-lg py-0 shadow-none">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">
              {beadTitle ? `${beadId}: ${beadTitle}` : beadId}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Live tool-call feed</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={state.status === 'open' ? 'success' : 'outline'}
              className="h-5 text-[11px]"
            >
              <Activity className="h-3 w-3" />
              {streamLabel(state.status)}
            </Badge>
            {awaitingCount > 0 && (
              <Badge variant="warning" className="h-5 text-[11px]">
                {awaitingCount} awaiting
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {state.error && (
          <div
            role="alert"
            className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {state.error}
          </div>
        )}

        {state.entries.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
            Waiting for bead events.
          </div>
        ) : (
          <ol className="space-y-2">
            {state.entries.map((entry) => (
              <ThreadEntry key={entry.id} entry={entry} onReviewApproval={onReviewApproval} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

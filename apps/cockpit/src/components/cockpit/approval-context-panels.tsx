import { format, formatDistanceToNow } from 'date-fns';
import { ShieldCheck, Link2, Clock3, ArrowRight } from 'lucide-react';
import type { ApprovalSummary, EvidenceEntry, RunSummary } from '@portarium/cockpit-types';
import type { TriageViewMode } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  buildEvidencePanelSummary,
  buildPolicyPanelSummary,
  buildRunTimelinePanelSummary,
} from './lib/approval-context-panels-summary';

interface ApprovalContextPanelsProps {
  approval: ApprovalSummary;
  evidenceEntries: readonly EvidenceEntry[];
  run?: RunSummary;
  onOpenMode: (mode: TriageViewMode) => void;
}

function ChainStatusBadge({ chainStatus }: { chainStatus: 'none' | 'verified' | 'broken' }) {
  const label =
    chainStatus === 'verified'
      ? 'Chain verified'
      : chainStatus === 'broken'
        ? 'Chain warning'
        : 'No evidence';
  const className =
    chainStatus === 'verified'
      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
      : chainStatus === 'broken'
        ? 'bg-red-500/10 text-red-700 border-red-500/30'
        : 'bg-muted text-muted-foreground border-border';

  return (
    <Badge variant="outline" className={cn('text-[11px] h-5', className)}>
      {label}
    </Badge>
  );
}

export function ApprovalContextPanels({
  approval,
  evidenceEntries,
  run,
  onOpenMode,
}: ApprovalContextPanelsProps) {
  const policy = buildPolicyPanelSummary(approval);
  const evidence = buildEvidencePanelSummary(evidenceEntries);
  const timeline = buildRunTimelinePanelSummary(approval, run);

  return (
    <section
      aria-label="Cross-layer context"
      className="grid gap-2 md:grid-cols-3 rounded-lg border border-border bg-muted/15 p-2"
    >
      <article className="rounded-md border border-border bg-background/80 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold">Policy Context</h3>
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            Tier: <span className="font-medium text-foreground">{policy.tierLabel}</span>
          </p>
          <p className="truncate" title={policy.triggerLabel}>
            Trigger: <span className="font-medium text-foreground">{policy.triggerLabel}</span>
          </p>
          <p>
            Risk: <span className="font-medium text-foreground">{policy.irreversibilityLabel}</span>
          </p>
          <p>
            SoD: <span className="font-medium text-foreground">{policy.sodLabel}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onOpenMode('compliance-checklist')}
        >
          Compliance Review
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </article>

      <article className="rounded-md border border-border bg-background/80 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold">Evidence Context</h3>
          </div>
          <ChainStatusBadge chainStatus={evidence.chainStatus} />
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            Entries: <span className="font-medium text-foreground">{evidence.entryCount}</span>
          </p>
          <p>
            Attachments:{' '}
            <span className="font-medium text-foreground">{evidence.attachmentCount}</span>
          </p>
          <p>
            Latest:{' '}
            <span className="font-medium text-foreground">
              {evidence.latestOccurredAtIso
                ? formatDistanceToNow(new Date(evidence.latestOccurredAtIso), { addSuffix: true })
                : 'N/A'}
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onOpenMode('evidence-chain')}
        >
          Evidence Chain
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </article>

      <article className="rounded-md border border-border bg-background/80 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold">Run Timeline</h3>
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            Status: <span className="font-medium text-foreground">{timeline.runStatusLabel}</span>
          </p>
          <p>
            Tier: <span className="font-medium text-foreground">{timeline.executionTierLabel}</span>
          </p>
          <p>
            Revision cycles:{' '}
            <span className="font-medium text-foreground">{timeline.cycleCount}</span>
          </p>
          <p>
            Due:{' '}
            <span className="font-medium text-foreground">
              {approval.dueAtIso ? format(new Date(approval.dueAtIso), 'MMM d, HH:mm') : 'N/A'}
              {timeline.isOverdue ? ' (overdue)' : ''}
            </span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onOpenMode('story-timeline')}
        >
          Story Timeline
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </article>
    </section>
  );
}

import { Link } from '@tanstack/react-router';
import { differenceInMinutes, formatDistanceToNowStrict } from 'date-fns';
import { Clock, GitPullRequest, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BlastRadiusBadge } from '@/components/cockpit/blast-radius-badge';
import {
  ENGINEERING_BEAD_COLUMNS,
  type EngineeringBead,
  type EngineeringBeadColumnId,
} from '@/components/cockpit/engineering-beads';
import { PolicyTierBadge } from '@/components/cockpit/policy-tier-badge';
import { cn } from '@/lib/utils';

const LinkComponent = Link as React.ComponentType<{
  to: string;
  params?: Record<string, string>;
  className?: string;
  children?: React.ReactNode;
}>;

export interface BeadKanbanBoardProps {
  beads: EngineeringBead[];
  selectedBeadId?: string;
}

function waitingMinutes(bead: EngineeringBead): number {
  const requestedAt = bead.primaryApproval?.requestedAtIso;
  if (!requestedAt || bead.primaryApproval?.status !== 'Pending') return 0;
  return differenceInMinutes(new Date(), new Date(requestedAt));
}

function BeadCard({ bead, selected }: { bead: EngineeringBead; selected: boolean }) {
  const minutesWaiting = waitingMinutes(bead);
  const staleApproval = bead.column === 'AwaitingApproval' && minutesWaiting >= 15;

  return (
    <LinkComponent
      to="/engineering/beads/$beadId"
      params={{ beadId: bead.beadId }}
      className={cn(
        'block rounded-md border bg-background p-3 text-left transition-colors hover:border-primary/60 hover:bg-accent/40',
        selected && 'border-primary bg-primary/5',
        staleApproval && 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-muted-foreground">{bead.beadId}</div>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{bead.title}</h3>
        </div>
        {staleApproval && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <PolicyTierBadge tier={bead.policyTier} />
        <BlastRadiusBadge level={bead.blastRadius} />
        <Badge variant="outline" className="h-5 text-[11px]">
          {bead.workItemStatus}
        </Badge>
      </div>
      <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
        {bead.ownerUserId && (
          <span className="inline-flex items-center gap-1">
            <UserCircle className="h-3.5 w-3.5" />
            {bead.ownerUserId}
          </span>
        )}
        {bead.primaryApproval?.status === 'Pending' && (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <GitPullRequest className="h-3.5 w-3.5" />
            {bead.primaryApproval.approvalId}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatDistanceToNowStrict(new Date(bead.lastActivityIso), { addSuffix: true })}
        </span>
      </div>
    </LinkComponent>
  );
}

function columnBeads(beads: EngineeringBead[], columnId: EngineeringBeadColumnId) {
  return beads.filter((bead) => bead.column === columnId);
}

export function BeadKanbanBoard({ beads, selectedBeadId }: BeadKanbanBoardProps) {
  return (
    <div className="grid h-full min-h-0 gap-3 overflow-x-auto p-3 md:grid-cols-4">
      {ENGINEERING_BEAD_COLUMNS.map((column) => {
        const items = columnBeads(beads, column.id);
        return (
          <section
            key={column.id}
            aria-label={column.title}
            className={cn(
              'flex min-h-[220px] min-w-64 flex-col rounded-md border bg-muted/20',
              column.id === 'AwaitingApproval' &&
                'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10',
            )}
          >
            <div className="border-b px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <Badge variant="secondary" className="h-5 text-[11px]">
                  {items.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{column.description}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  No beads
                </div>
              ) : (
                items.map((bead) => (
                  <BeadCard
                    key={bead.beadId}
                    bead={bead}
                    selected={bead.beadId === selectedBeadId}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

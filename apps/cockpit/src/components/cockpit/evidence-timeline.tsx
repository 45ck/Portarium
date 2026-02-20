import type { EvidenceEntry } from '@portarium/cockpit-types';
import {
  EvidenceCategoryBadge,
  EVIDENCE_CATEGORY_COLORS,
} from '@/components/cockpit/evidence-category-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface EvidenceTimelineProps {
  entries: EvidenceEntry[];
  loading?: boolean;
}

const dotColors: Record<string, string> = {
  Plan: 'bg-purple-500',
  Action: 'bg-blue-500',
  Approval: 'bg-yellow-500',
  Policy: 'bg-orange-500',
  System: 'bg-gray-500',
};

function actorLabel(actor: EvidenceEntry['actor']): string {
  switch (actor.kind) {
    case 'User':
      return `User: ${actor.userId}`;
    case 'Machine':
      return `Machine: ${actor.machineId}`;
    case 'Adapter':
      return `Adapter: ${actor.adapterId}`;
    case 'System':
      return 'System';
  }
}

export function EvidenceTimeline({ entries, loading }: EvidenceTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-3 w-3 rounded-full mt-1 shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <div
          key={entry.evidenceId}
          className="flex gap-3 py-2 border-b border-border last:border-0"
        >
          <div className="flex flex-col items-center pt-1">
            <div
              className={cn(
                'h-3 w-3 rounded-full shrink-0',
                dotColors[entry.category] ?? 'bg-gray-400',
              )}
            />
            {i < entries.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">{entry.summary}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground">{actorLabel(entry.actor)}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(entry.occurredAtIso), { addSuffix: true })}
              </span>
              {entry.previousHash && (
                <Link2 className="h-3 w-3 text-muted-foreground" aria-label="Chained entry" />
              )}
            </div>
          </div>
          <div className="shrink-0">
            <EvidenceCategoryBadge category={entry.category} />
          </div>
        </div>
      ))}
    </div>
  );
}

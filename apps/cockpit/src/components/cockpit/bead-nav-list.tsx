import { Link } from '@tanstack/react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { GitBranch, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PolicyTierBadge } from '@/components/cockpit/policy-tier-badge';
import type { EngineeringBead } from '@/components/cockpit/engineering-beads';
import { cn } from '@/lib/utils';

const LinkComponent = Link as React.ComponentType<{
  to: string;
  params?: Record<string, string>;
  className?: string;
  children?: React.ReactNode;
}>;

export interface BeadNavListProps {
  beads: EngineeringBead[];
  selectedBeadId?: string;
}

export function BeadNavList({ beads, selectedBeadId }: BeadNavListProps) {
  const [query, setQuery] = useState('');
  const visibleBeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return beads;
    return beads.filter(
      (bead) =>
        bead.beadId.toLowerCase().includes(needle) || bead.title.toLowerCase().includes(needle),
    );
  }, [beads, query]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r bg-muted/20">
      <div className="border-b p-3">
        <div className="mb-3 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Beads</h2>
          <Badge variant="secondary" className="ml-auto h-5 text-[11px]">
            {beads.length}
          </Badge>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search beads"
            className="h-8 pl-7 text-xs"
          />
        </label>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Engineering beads">
        {visibleBeads.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            No beads match.
          </div>
        ) : (
          <div className="space-y-1.5">
            {visibleBeads.map((bead) => (
              <LinkComponent
                key={bead.beadId}
                to="/engineering/beads/$beadId"
                params={{ beadId: bead.beadId }}
                className={cn(
                  'block rounded-md border border-transparent px-2.5 py-2 text-sm hover:border-border hover:bg-background',
                  selectedBeadId === bead.beadId && 'border-primary bg-background shadow-sm',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-muted-foreground">{bead.beadId}</div>
                    <div className="truncate font-medium">{bead.title}</div>
                  </div>
                  {bead.column === 'AwaitingApproval' && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <PolicyTierBadge tier={bead.policyTier} />
                  <span className="truncate text-[11px] text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(bead.lastActivityIso), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </LinkComponent>
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}

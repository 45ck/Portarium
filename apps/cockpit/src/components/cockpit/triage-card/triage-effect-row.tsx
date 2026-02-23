import type { PlanEffect } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { opColors } from '@/components/cockpit/lib/effect-colors';
import { SorBadge } from './sor-badge';

export function TriageEffectRow({ effect }: { effect: PlanEffect }) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <Badge variant="secondary" className={cn('text-[11px] shrink-0', opColors[effect.operation])}>
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

import type { PlanEffect, PredictedPlanEffect } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EffectsListProps {
  planned: PlanEffect[];
  predicted?: PredictedPlanEffect[];
  verified?: PlanEffect[];
}

import { opColors } from '@/components/cockpit/lib/effect-colors';

function EffectRow({ effect, confidence }: { effect: PlanEffect; confidence?: number }) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <Badge variant="secondary" className={cn('text-[10px] shrink-0', opColors[effect.operation])}>
        {effect.operation}
      </Badge>
      <span className="font-mono text-muted-foreground">
        {effect.target.sorName}:{effect.target.externalType}
      </span>
      <span className="flex-1 truncate">{effect.summary}</span>
      {confidence !== undefined && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function EffectsList({ planned, predicted, verified }: EffectsListProps) {
  return (
    <div className="space-y-3">
      {planned.length > 0 && (
        <Section title="Planned">
          {planned.map((e) => (
            <EffectRow key={e.effectId} effect={e} />
          ))}
        </Section>
      )}
      {predicted && predicted.length > 0 && (
        <Section title="Predicted">
          {predicted.map((e) => (
            <EffectRow key={e.effectId} effect={e} confidence={e.confidence} />
          ))}
        </Section>
      )}
      {verified && verified.length > 0 && (
        <Section title="Verified">
          {verified.map((e) => (
            <EffectRow key={e.effectId} effect={e} />
          ))}
        </Section>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { EntityIcon } from '@/components/domain/entity-icon';
import type { TriageModeProps } from './index';
import {
  evaluateAllSignals,
  computeOverallSignal,
  type Signal,
  type SignalColor,
} from './lib/signal-evaluators';

const SIGNAL_CIRCLE_COLORS: Record<SignalColor, string> = {
  green: 'bg-emerald-500 shadow-emerald-500/40',
  yellow: 'bg-yellow-400 shadow-yellow-400/40',
  red: 'bg-red-500 shadow-red-500/40',
};

const SIGNAL_ENTITY_ICONS: Record<string, string> = {
  sod: 'policy',
  blast: 'run',
  reversibility: 'workflow',
  deadline: 'human-task',
  history: 'approval',
  destructiveness: 'evidence',
  'evidence-chain': 'evidence',
  'execution-tier': 'workflow',
};

const OVERALL_BG: Record<SignalColor, string> = {
  green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  red: 'bg-red-50 border-red-200 text-red-800',
};

function SignalCard({ signal, index }: { signal: Signal; index: number }) {
  const entityType = SIGNAL_ENTITY_ICONS[signal.id] ?? 'approval';

  return (
    <div
      className="rounded-lg border border-border bg-card p-3 flex items-center gap-3 animate-signal-fade-in"
      style={{ animationDelay: `${Math.min(index * 80, 300)}ms` }}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-full shrink-0 shadow-lg flex items-center justify-center',
          SIGNAL_CIRCLE_COLORS[signal.color],
        )}
      >
        <EntityIcon
          entityType={entityType as Parameters<typeof EntityIcon>[0]['entityType']}
          size="sm"
          decorative
          className="brightness-0 invert"
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{signal.label}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-2">{signal.explanation}</p>
      </div>
    </div>
  );
}

export function TrafficSignalsMode({
  approval,
  plannedEffects,
  evidenceEntries,
  run,
}: TriageModeProps) {
  const signals = useMemo(
    () => evaluateAllSignals(approval, plannedEffects, evidenceEntries, run),
    [approval, plannedEffects, evidenceEntries, run],
  );
  const overall = useMemo(() => computeOverallSignal(signals), [signals]);

  const warningCount = useMemo(
    () => signals.filter((s) => s.color === 'yellow' || s.color === 'red').length,
    [signals],
  );

  return (
    <div className="space-y-3">
      {/* Overall banner */}
      <div
        className={cn(
          'rounded-lg border px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest',
          OVERALL_BG[overall.color],
        )}
        title={`Based on ${warningCount} of ${signals.length} signals at yellow or red level`}
      >
        <span
          className={cn(
            'inline-block w-2.5 h-2.5 rounded-full shadow-sm',
            SIGNAL_CIRCLE_COLORS[overall.color],
          )}
        />
        {overall.label}
      </div>

      {/* Signal grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {signals.map((signal, i) => (
          <SignalCard key={signal.id} signal={signal} index={i} />
        ))}
      </div>
    </div>
  );
}

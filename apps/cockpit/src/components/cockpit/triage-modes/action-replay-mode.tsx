import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { opColors } from '@/components/cockpit/lib/effect-colors';
import type { PlanEffect, WorkflowSummary } from '@portarium/cockpit-types';
import type { TriageModeProps } from './index';
import { resolveSorPalette } from './lib/sor-palette';
import { resolveEntity } from './lib/entity-type-resolver';

const AUTOPLAY_INTERVAL = 2000;

const OP_BADGE: Record<string, string> = {
  Create: 'bg-emerald-500 text-white',
  Update: 'bg-blue-500 text-white',
  Delete: 'bg-red-500 text-white',
  Upsert: 'bg-yellow-500 text-white',
};

const OP_LETTER: Record<string, string> = {
  Create: 'C',
  Update: 'U',
  Delete: 'D',
  Upsert: 'P',
};

function findWorkflowStep(effect: PlanEffect, workflow?: WorkflowSummary): number | null {
  if (!workflow?.actions) return null;
  const action = workflow.actions.find((a) => a.portFamily === effect.target.portFamily);
  return action?.order ?? null;
}

export function ActionReplayMode({ approval, plannedEffects, run, workflow }: TriageModeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const activeThumbRef = useRef<HTMLButtonElement>(null);
  const total = plannedEffects.length;

  const goNext = useCallback(() => {
    setCurrentStep((s) => {
      if (s >= total - 1) {
        setPlaying(false);
        return s;
      }
      return s + 1;
    });
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(goNext, AUTOPLAY_INTERVAL);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, goNext]);

  // Pause on textarea focus
  useEffect(() => {
    function onFocus(e: FocusEvent) {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') setPlaying(false);
    }
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);

  // Scroll active film strip thumbnail into view
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [currentStep]);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 text-center text-xs text-muted-foreground">
        No planned effects to replay
      </div>
    );
  }

  const effect = plannedEffects[currentStep]!;
  const entity = resolveEntity(effect.target.externalType);
  const sorPalette = resolveSorPalette(effect.target.sorName);
  const stepNumber = findWorkflowStep(effect, workflow);
  const prevEffect = currentStep > 0 ? plannedEffects[currentStep - 1] : null;
  const sameSorAsPrev = prevEffect && prevEffect.target.sorName === effect.target.sorName;

  // Single-effect: show static card without playback controls
  if (total === 1) {
    return (
      <div className="space-y-3">
        <div className="text-[11px] text-muted-foreground font-semibold">1 planned effect</div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          {stepNumber !== null && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded bg-primary/10 text-primary text-[9px] font-bold">
                {stepNumber}
              </span>
              <span>Workflow step {stepNumber}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Badge className={cn('text-sm px-3 py-1 font-bold', OP_BADGE[effect.operation])}>
              {effect.operation}
            </Badge>
            <span
              className={cn(
                'inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0',
                sorPalette.bg,
                sorPalette.text,
              )}
            >
              {effect.target.sorName.slice(0, 2)}
            </span>
            <span className="text-sm font-semibold">{effect.target.sorName}</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-muted/30 border border-border p-2">
              <EntityIcon entityType={entity} size="lg" decorative />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[11px] text-muted-foreground block">
                {effect.target.externalType}
              </span>
              <p className="text-sm text-foreground mt-1 leading-relaxed">{effect.summary}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Running tally up to current step
  const tally: Record<string, number> = { Create: 0, Update: 0, Delete: 0, Upsert: 0 };
  for (let i = 0; i <= currentStep; i++) {
    const op = plannedEffects[i]!.operation;
    tally[op] = (tally[op] ?? 0) + 1;
  }

  return (
    <div className="space-y-3">
      {/* Step progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-semibold tabular-nums">
            Step {currentStep + 1} of {total}
          </span>
          <span className="border-l border-border h-3" />
          {Object.entries(tally)
            .filter(([, v]) => v > 0)
            .map(([op, count]) => (
              <span key={op} className="flex items-center gap-1">
                <span className={cn('w-2 h-2 rounded-full', OP_BADGE[op]?.split(' ')[0])} />
                <span>
                  {count} {op}
                </span>
              </span>
            ))}
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Hero card */}
      <div
        key={currentStep}
        className="rounded-lg border border-border bg-card p-5 space-y-3 animate-replay-step"
      >
        {/* Workflow step badge */}
        {stepNumber !== null && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded bg-primary/10 text-primary text-[9px] font-bold">
              {stepNumber}
            </span>
            <span>Workflow step {stepNumber}</span>
          </div>
        )}
        {/* Dependency hint */}
        {sameSorAsPrev && (
          <div className="text-[10px] text-muted-foreground italic">
            Sequential operation on {effect.target.sorName} (follows previous step)
          </div>
        )}
        {/* Operation + SOR */}
        <div className="flex items-center gap-3">
          <Badge className={cn('text-sm px-3 py-1 font-bold', OP_BADGE[effect.operation])}>
            {effect.operation}
          </Badge>
          <span
            className={cn(
              'inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0',
              sorPalette.bg,
              sorPalette.text,
            )}
          >
            {effect.target.sorName.slice(0, 2)}
          </span>
          <span className="text-sm font-semibold">{effect.target.sorName}</span>
        </div>

        {/* Entity icon + details */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-muted/30 border border-border p-2">
            <EntityIcon entityType={entity} size="lg" decorative />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[11px] text-muted-foreground block">
              {effect.target.externalType}
            </span>
            <p className="text-sm text-foreground mt-1 leading-relaxed">{effect.summary}</p>
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={currentStep === 0}
          onClick={goPrev}
          title="Previous"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setPlaying((p) => !p)}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={currentStep >= total - 1}
          onClick={goNext}
          title="Next"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Film strip thumbnails */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {plannedEffects.map((e, i) => {
          const sn = findWorkflowStep(e, workflow);
          return (
            <button
              key={e.effectId}
              ref={i === currentStep ? activeThumbRef : undefined}
              type="button"
              onClick={() => {
                setCurrentStep(i);
                setPlaying(false);
              }}
              className="shrink-0 flex flex-col items-center gap-0.5"
              title={`Step ${i + 1}: ${e.operation} ${e.target.externalType}`}
            >
              <span
                className={cn(
                  'w-8 h-8 sm:w-10 sm:h-10 rounded border flex items-center justify-center text-[9px] sm:text-[11px] font-bold transition-all duration-200 relative',
                  OP_BADGE[e.operation] ?? 'bg-muted text-foreground',
                  i === currentStep
                    ? 'ring-2 ring-primary border-primary scale-110 shadow-md'
                    : i < currentStep
                      ? 'opacity-40 scale-95'
                      : 'opacity-60',
                )}
              >
                {OP_LETTER[e.operation] ?? '?'}
                {sn !== null && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                    {sn}
                  </span>
                )}
              </span>
              <span className="text-[9px] text-muted-foreground leading-none truncate max-w-[2.5rem]">
                {e.target.sorName.slice(0, 2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

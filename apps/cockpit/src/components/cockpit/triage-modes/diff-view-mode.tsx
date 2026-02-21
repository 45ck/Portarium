import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EntityIcon } from '@/components/domain/entity-icon';
import type { TriageModeProps } from './index';
import type { PlanEffect, EffectOperation, WorkflowActionSummary } from '@portarium/cockpit-types';
import { resolveSorPalette } from './lib/sor-palette';
import { resolveEntity } from './lib/entity-type-resolver';

function SorBadgeInline({ name }: { name: string }) {
  const bg = resolveSorPalette(name).bg;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold text-white shrink-0',
        bg,
      )}
    >
      {name.slice(0, 2)}
    </span>
  );
}

function BeforeCard({ effect }: { effect: PlanEffect }) {
  const entity = resolveEntity(effect.target.externalType);

  if (effect.operation === 'Create') {
    return (
      <div className="rounded-md border-2 border-dashed border-muted px-3 py-2.5 flex items-center gap-2 bg-muted/5 min-h-[52px]">
        <span className="text-[11px] text-muted-foreground italic">Does not exist yet</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border px-3 py-2 flex items-center gap-2 bg-card min-h-[52px]">
      <SorBadgeInline name={effect.target.sorName} />
      <EntityIcon entityType={entity} size="xs" decorative />
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-mono text-muted-foreground block truncate">
          {effect.target.externalType}
        </span>
        <span className="text-[10px] text-foreground block truncate">{effect.summary}</span>
      </div>
    </div>
  );
}

function AfterCard({ effect }: { effect: PlanEffect }) {
  const entity = resolveEntity(effect.target.externalType);

  const border =
    effect.operation === 'Create'
      ? 'border-emerald-400 bg-emerald-50/50'
      : effect.operation === 'Delete'
        ? 'border-red-400 bg-red-50/50'
        : 'border-blue-400 bg-blue-50/50';

  if (effect.operation === 'Delete') {
    return (
      <div
        className={cn(
          'rounded-md border-2 border-dashed px-3 py-2 flex items-center gap-2 opacity-50 min-h-[52px]',
          border,
        )}
      >
        <SorBadgeInline name={effect.target.sorName} />
        <EntityIcon entityType={entity} size="xs" decorative />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-mono text-red-500 line-through block truncate">
            {effect.target.externalType}
          </span>
          <span className="text-[10px] text-red-400 line-through block truncate">
            {effect.summary}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-md border-2 px-3 py-2 flex items-center gap-2 min-h-[52px]', border)}
    >
      <SorBadgeInline name={effect.target.sorName} />
      <EntityIcon entityType={entity} size="xs" decorative />
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-mono text-muted-foreground block truncate">
          {effect.target.externalType}
        </span>
        <span className="text-[10px] text-foreground block truncate">{effect.summary}</span>
        {effect.operation === 'Update' && (
          <span className="text-[9px] font-medium text-primary block mt-0.5">
            Fields will be modified
          </span>
        )}
      </div>
    </div>
  );
}

function OpBadge({ op }: { op: EffectOperation }) {
  const cls: Record<string, string> = {
    Create: 'bg-success/10 text-success',
    Update: 'bg-info/10 text-info',
    Delete: 'bg-destructive/10 text-destructive',
    Upsert: 'bg-warning/10 text-warning',
  };
  return (
    <Badge variant="secondary" className={cn('text-[9px] h-4 px-1', cls[op])}>
      {op}
    </Badge>
  );
}

function matchWorkflowStep(
  sorEffects: PlanEffect[],
  actions?: WorkflowActionSummary[],
): WorkflowActionSummary | undefined {
  if (!actions) return undefined;
  return actions.find((a) => sorEffects.some((e) => e.target.portFamily === a.portFamily));
}

function formatElapsed(startIso: string, endIso?: string): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const ms = end - start;
  const minutes = Math.floor(ms / 60000);
  if (minutes === 0) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function DiffViewMode({ approval, plannedEffects, run, workflow }: TriageModeProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, PlanEffect[]>();
    for (const e of plannedEffects) {
      const list = map.get(e.target.sorName) ?? [];
      list.push(e);
      map.set(e.target.sorName, list);
    }
    return map;
  }, [plannedEffects]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Create: 0, Update: 0, Delete: 0, Upsert: 0 };
    for (const e of plannedEffects) c[e.operation] = (c[e.operation] ?? 0) + 1;
    return c;
  }, [plannedEffects]);

  if (plannedEffects.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 text-center text-xs text-muted-foreground">
        No planned effects to compare
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Workflow context header */}
      {(workflow || run) && (
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
          {workflow ? (
            <span className="font-semibold">
              {workflow.name} v{workflow.version}
            </span>
          ) : (
            <span className="font-semibold">Run context</span>
          )}
          {run?.startedAtIso && <span>Started {formatElapsed(run.startedAtIso)} ago</span>}
        </div>
      )}

      {/* Counter */}
      <div className="flex items-center justify-center gap-3 text-[11px]">
        {Object.entries(counts)
          .filter(([, v]) => v > 0)
          .map(([op, count]) => (
            <span key={op} className="flex items-center gap-1">
              <OpBadge op={op as EffectOperation} />
              <span className="text-muted-foreground">{count}</span>
            </span>
          ))}
      </div>

      {/* Column headers */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-center">
          Current State
        </div>
        <div className="w-8" />
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-center">
          After Approval
        </div>
      </div>

      {/* Grouped by SOR */}
      {Array.from(grouped.entries()).map(([sorName, effects]) => {
        const step = matchWorkflowStep(effects, workflow?.actions);
        return (
          <div key={sorName} className="space-y-1.5">
            <div className="flex items-center gap-1.5 px-1 min-w-0">
              {step && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded bg-primary/10 text-primary text-[9px] font-bold shrink-0">
                  {step.order}
                </span>
              )}
              <SorBadgeInline name={sorName} />
              <span className="text-[10px] font-semibold text-muted-foreground truncate min-w-0">
                {sorName}
              </span>
            </div>
            {effects.map((effect) => (
              <div
                key={effect.effectId}
                className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] gap-2 items-center"
              >
                <BeforeCard effect={effect} />
                <div className="sm:hidden flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <svg width="8" height="16" viewBox="0 0 8 16" className="text-muted-foreground">
                    <path
                      d="M4 0 V12 M1 9 L4 12 L7 9"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <OpBadge op={effect.operation} />
                </div>
                <div className="hidden sm:flex w-8 flex-col items-center gap-0.5">
                  <OpBadge op={effect.operation} />
                  <svg width="8" height="16" viewBox="0 0 8 16" className="text-muted-foreground">
                    <path
                      d="M4 0 V12 M1 9 L4 12 L7 9"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <AfterCard effect={effect} />
              </div>
            ))}
          </div>
        );
      })}

      {/* Run context footer */}
      {run && (
        <div className="text-[11px] text-muted-foreground text-center">
          Run{' '}
          {run.status
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .toLowerCase()}
          {' · '}
          {run.executionTier} tier
          {run.startedAtIso && ` · ${formatElapsed(run.startedAtIso, run.endedAtIso)} elapsed`}
        </div>
      )}
    </div>
  );
}

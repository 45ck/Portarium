import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import type { TriageModeProps } from './index';
import type { PlanEffect } from '@portarium/cockpit-types';
import { resolveSorPalette } from './lib/sor-palette';
import { opColors } from '@/components/cockpit/lib/effect-colors';

function IrreversibilityBar({ level }: { level: 'full' | 'partial' | 'none' }) {
  const config = {
    full: { width: '100%', color: 'bg-red-500', label: 'Full', textColor: 'text-red-600' },
    partial: {
      width: '50%',
      color: 'bg-yellow-500',
      label: 'Partial',
      textColor: 'text-yellow-600',
    },
    none: { width: '10%', color: 'bg-emerald-500', label: 'None', textColor: 'text-emerald-600' },
  }[level];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-24 shrink-0">Irreversibility</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', config.color)}
          style={{ width: config.width }}
        />
      </div>
      <span className={cn('text-[11px] font-medium w-12', config.textColor)}>{config.label}</span>
    </div>
  );
}

function SorBadge({ name }: { name: string }) {
  const palette = resolveSorPalette(name);
  const abbr = name.slice(0, 2);
  return (
    <span
      title={name}
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0',
        palette.bg,
        palette.text,
      )}
    >
      {abbr}
    </span>
  );
}

export function FinanceImpactMode({ approval, plannedEffects, workflow }: TriageModeProps) {
  const policyRule = approval.policyRule;
  const sodEval = approval.sodEvaluation;

  // Group effects by SOR name
  const effectsBySor = useMemo(() => {
    const groups = new Map<string, PlanEffect[]>();
    for (const e of plannedEffects) {
      const sor = e.target.sorName;
      if (!groups.has(sor)) groups.set(sor, []);
      groups.get(sor)!.push(e);
    }
    return groups;
  }, [plannedEffects]);

  if (plannedEffects.length === 0 && !policyRule) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 text-center">
        <p className="text-xs font-medium text-muted-foreground">No financial impact data</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Financial context will appear when the approval involves finance-related effects.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Affected Systems */}
      {effectsBySor.size > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Affected Systems
          </p>
          <div className="space-y-3">
            {[...effectsBySor.entries()].map(([sor, effects]) => (
              <div key={sor}>
                <div className="flex items-center gap-2 mb-1">
                  <SorBadge name={sor} />
                  <span className="text-xs font-medium">{sor}</span>
                  <span className="text-[11px] text-muted-foreground">
                    ({effects[0]?.target.portFamily})
                  </span>
                </div>
                <div className="ml-9 space-y-0.5">
                  {effects.map((e) => (
                    <div key={e.effectId} className="flex items-center gap-2 text-[11px]">
                      <Badge
                        variant="secondary"
                        className={cn('text-[9px] h-4 px-1 shrink-0', opColors[e.operation])}
                      >
                        {e.operation}
                      </Badge>
                      <span className="text-muted-foreground">{e.target.externalType}</span>
                      <span className="truncate">{e.summary}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Assessment */}
      {policyRule && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Risk Assessment
          </p>
          <div className="space-y-2">
            <IrreversibilityBar level={policyRule.irreversibility} />

            <div className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">Blast radius</span>
              <div className="flex flex-wrap gap-1">
                {policyRule.blastRadius.map((b) => (
                  <Badge key={b} variant="outline" className="text-[11px] h-5 px-1.5">
                    {b}
                  </Badge>
                ))}
              </div>

              <span className="text-muted-foreground">Policy trigger</span>
              <span className="font-mono text-[11px]">{policyRule.trigger}</span>

              {sodEval && (
                <>
                  <span className="text-muted-foreground">SoD</span>
                  <span className="flex items-center gap-1 text-[11px]">
                    {sodEval.state === 'eligible' ? (
                      <>
                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600">Approve ≠ Initiate</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-3 w-3 text-red-500" />
                        <span className="text-red-600">{sodEval.state}</span>
                      </>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-System Flow */}
      {workflow && workflow.actions.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Multi-System Flow
          </p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {workflow.actions.map((action, i) => (
              <div key={action.actionId} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                <div className="rounded border border-border bg-card px-2 py-1.5 text-center min-w-[80px]">
                  <div className="text-[11px] font-medium truncate">{action.operation}</div>
                  <div className="text-[9px] text-muted-foreground truncate">
                    {action.portFamily}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import type {
  ApprovalSummary,
  PlanEffect,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { ProvenanceJourney } from '../provenance-journey';
import { PolicyRulePanel } from './policy-rule-panel';
import { TriageEffectRow } from './triage-effect-row';

export interface TriageDefaultContentProps {
  approval: ApprovalSummary;
  plannedEffects: PlanEffect[];
  run?: RunSummary;
  workflow?: WorkflowSummary;
}

export function TriageDefaultContent({
  approval,
  plannedEffects,
  run,
  workflow,
}: TriageDefaultContentProps) {
  const policyRule = approval.policyRule;
  return (
    <>
      <ProvenanceJourney approval={approval} run={run} workflow={workflow} />
      {policyRule && (
        <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
          <PolicyRulePanel rule={policyRule} />
        </div>
      )}
      {plannedEffects.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            What will happen if approved
          </p>
          <div className="divide-y divide-border/40">
            {plannedEffects.map((e) => (
              <TriageEffectRow key={e.effectId} effect={e} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

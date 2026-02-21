import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import type { TriageModeProps } from './index';
import type { PlanEffect } from '@portarium/cockpit-types';
import { computeAdequacy } from './lib/evidence-adequacy';
import { opColors } from '@/components/cockpit/lib/effect-colors';

const COMPLIANCE_FAMILIES = new Set([
  'RegulatoryCompliance',
  'AuditReporting',
  'PolicyEnforcement',
  'QualityManagement',
]);

export function ComplianceChecklistMode({
  approval,
  plannedEffects,
  evidenceEntries = [],
}: TriageModeProps) {
  const policyRule = approval.policyRule;
  const sodEval = approval.sodEvaluation;

  const complianceEffects = useMemo(
    () => plannedEffects.filter((e) => COMPLIANCE_FAMILIES.has(e.target.portFamily)),
    [plannedEffects],
  );

  const adequacy = useMemo(
    () => (evidenceEntries.length > 0 ? computeAdequacy(evidenceEntries) : null),
    [evidenceEntries],
  );

  return (
    <div className="space-y-4">
      {/* Policy Gate */}
      {policyRule && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Policy Gate
          </p>
          <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">Rule</span>
            <span className="font-mono text-[11px]">{policyRule.ruleId}</span>

            <span className="text-muted-foreground">Trigger</span>
            <span className="font-mono text-[11px]">{policyRule.trigger}</span>

            <span className="text-muted-foreground">Required tier</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 w-fit">
              {policyRule.tier}
            </Badge>

            <span className="text-muted-foreground">Irreversibility</span>
            <span
              className={cn('font-medium', {
                'text-red-600': policyRule.irreversibility === 'full',
                'text-yellow-600': policyRule.irreversibility === 'partial',
                'text-emerald-600': policyRule.irreversibility === 'none',
              })}
            >
              {policyRule.irreversibility === 'full'
                ? 'Full'
                : policyRule.irreversibility === 'partial'
                  ? 'Partial'
                  : 'None'}
              {policyRule.irreversibility === 'full' && (
                <AlertTriangle className="inline h-3 w-3 ml-1" />
              )}
            </span>
          </div>
        </div>
      )}

      {/* Separation of Duties */}
      {sodEval && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Separation of Duties
          </p>
          <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">State</span>
            <span className="flex items-center gap-1">
              {sodEval.state === 'eligible' ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-medium">eligible</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-red-600 font-medium">{sodEval.state}</span>
                </>
              )}
            </span>

            <span className="text-muted-foreground">Requestor</span>
            <span className="font-mono text-[11px]">{sodEval.requestorId}</span>

            {sodEval.rolesRequired.length > 0 && (
              <>
                <span className="text-muted-foreground">Required roles</span>
                <div className="flex flex-wrap gap-1">
                  {sodEval.rolesRequired.map((role) => (
                    <Badge key={role} variant="outline" className="text-[10px] h-4 px-1.5">
                      {role}
                    </Badge>
                  ))}
                </div>
              </>
            )}

            <span className="text-muted-foreground">Rule</span>
            <span className="font-mono text-[11px]">{sodEval.ruleId}</span>
          </div>
        </div>
      )}

      {/* Regulatory Effects */}
      {complianceEffects.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Regulatory Effects
          </p>
          <div className="space-y-1.5">
            {complianceEffects.map((e) => (
              <div key={e.effectId} className="flex items-center gap-2 text-xs">
                <FileCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{e.target.sorName}</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-muted-foreground">{e.target.externalType}</span>
                <Badge
                  variant="secondary"
                  className={cn('text-[9px] h-4 px-1 ml-auto shrink-0', opColors[e.operation])}
                >
                  {e.operation}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Coverage */}
      {adequacy && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Evidence Coverage
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-0.5">
              {adequacy.entryCount >= 3 ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
              Entries: {adequacy.entryCount}/3
            </span>
            <span className="inline-flex items-center gap-0.5">
              {adequacy.actorCount >= 2 ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
              Actors: {adequacy.actorCount}/2
            </span>
            <span className="inline-flex items-center gap-0.5">
              {adequacy.categoryCount >= 5 ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
              Categories: {adequacy.categoryCount}/5
            </span>
            <span className="inline-flex items-center gap-0.5">
              {adequacy.attachmentCount >= 1 ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
              Attachments: {adequacy.attachmentCount}/1
            </span>
          </div>
        </div>
      )}

      {/* Fallback when nothing to show */}
      {!policyRule && !sodEval && complianceEffects.length === 0 && !adequacy && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 text-center">
          <p className="text-xs font-medium text-muted-foreground">No compliance data available</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Compliance context will appear when the approval involves policy rules or regulatory
            effects.
          </p>
        </div>
      )}
    </div>
  );
}

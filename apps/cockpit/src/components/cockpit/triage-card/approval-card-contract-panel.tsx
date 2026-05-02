import { AlertTriangle, CheckCircle2, LockKeyhole, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ApprovalCardContract, ApprovalCardRiskTier } from './approval-card-contract';

const TIER_COPY: Record<
  ApprovalCardRiskTier,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  low: {
    label: 'Fast triage',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
    icon: CheckCircle2,
  },
  elevated: {
    label: 'Deep review',
    className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-800',
    icon: AlertTriangle,
  },
  high: {
    label: 'High-risk review',
    className: 'border-red-500/35 bg-red-500/10 text-red-700',
    icon: ShieldAlert,
  },
};

function FieldTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/80 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

export function ApprovalCardContractPanel({ contract }: { contract: ApprovalCardContract }) {
  const tier = TIER_COPY[contract.riskTier];
  const TierIcon = contract.friction.escalationLock ? LockKeyhole : tier.icon;
  const primaryCopy = contract.friction.escalationLock
    ? 'Escalation lock'
    : contract.reviewDepth === 'fast-triage'
      ? 'Fast triage allowed'
      : 'Deep review required';

  return (
    <section
      aria-label={contract.contractName}
      className={cn(
        'rounded-lg border p-3 space-y-3',
        contract.riskTier === 'low'
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : contract.riskTier === 'elevated'
            ? 'border-yellow-500/25 bg-yellow-500/5'
            : 'border-red-500/25 bg-red-500/5',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn('h-6 gap-1.5 text-[11px]', tier.className)}>
          <TierIcon className="h-3.5 w-3.5" />
          {tier.label}
        </Badge>
        <span className="text-xs font-semibold text-foreground">{primaryCopy}</span>
        <span className="text-[11px] text-muted-foreground">{contract.contractName}</span>
      </div>

      {contract.escalationReasons.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {contract.escalationReasons.map((reason) => (
            <Badge key={reason} variant="outline" className="h-5 text-[11px] bg-background/80">
              {reason}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2">
        <FieldTile {...contract.fields.proposedAction} />
        <FieldTile {...contract.fields.intent} />
        <FieldTile {...contract.fields.systemsTouched} />
        <FieldTile {...contract.fields.policyResult} />
        <FieldTile {...contract.fields.blastRadius} />
        <FieldTile {...contract.fields.reversibility} />
        <FieldTile {...contract.fields.evidence} />
        <FieldTile {...contract.fields.rationale} />
      </div>

      <FieldTile {...contract.fields.priorRelatedActions} />

      {contract.reviewDepth !== 'fast-triage' ? (
        <div className="rounded-md border border-border bg-background/80 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Review friction
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            {contract.friction.escalationLock
              ? (contract.friction.lockReason ?? 'Approval is locked by governance policy.')
              : contract.friction.requireSecondConfirm
                ? 'Approval requires rationale and a second confirmation.'
                : 'Open the review context before deciding.'}
          </p>
        </div>
      ) : null}
    </section>
  );
}

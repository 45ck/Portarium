import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  GitBranch,
  Link2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  ApprovalPolicyConversionAction,
  ApprovalPolicyConversionProposal,
  ApprovalPolicyConversionScope,
} from '@portarium/cockpit-types';
import type { TriageModeProps } from './index';
import {
  FUTURE_CASE_CONVERSION_ACTIONS,
  ONE_OFF_CONVERSION_ACTIONS,
  buildApprovalPolicyConversionProposal,
  labelApprovalPolicyConversionAction,
} from '@/lib/approval-policy-conversion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const ACTION_ICONS: Record<ApprovalPolicyConversionAction, typeof CheckCircle2> = {
  'approve-once': CheckCircle2,
  'approve-and-loosen-rule': ShieldCheck,
  'deny-once': XCircle,
  'deny-and-create-rule': ShieldAlert,
  'require-more-evidence-next-time': FileSearch,
  'escalate-action-class': AlertTriangle,
};

const SCOPE_ACTIONS: Record<
  ApprovalPolicyConversionScope,
  readonly ApprovalPolicyConversionAction[]
> = {
  CurrentRunOnly: ONE_OFF_CONVERSION_ACTIONS,
  FutureSimilarCases: FUTURE_CASE_CONVERSION_ACTIONS,
};

function scopeLabel(scope: ApprovalPolicyConversionScope): string {
  return scope === 'CurrentRunOnly' ? 'This Run only' : 'Future similar cases';
}

function Field({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'strong';
}) {
  return (
    <div className="rounded-md border border-border bg-background/80 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <p
        className={cn(
          'mt-2 text-sm',
          tone === 'strong' ? 'font-semibold text-foreground' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function PolicyPrecedentMode({
  approval,
  plannedEffects,
  evidenceEntries = [],
  run,
  workflow,
}: TriageModeProps) {
  const [scope, setScope] = useState<ApprovalPolicyConversionScope>('CurrentRunOnly');
  const [action, setAction] = useState<ApprovalPolicyConversionAction>('approve-once');
  const [rationale, setRationale] = useState(
    approval.rationale ?? approval.agentActionProposal?.rationale ?? '',
  );
  const [stagedProposal, setStagedProposal] = useState<ApprovalPolicyConversionProposal | null>(
    null,
  );

  const proposal = useMemo(
    () =>
      buildApprovalPolicyConversionProposal({
        approval,
        plannedEffects,
        evidenceEntries,
        run,
        workflow,
        action,
        scope,
        rationale,
      }),
    [action, approval, evidenceEntries, plannedEffects, rationale, run, scope, workflow],
  );

  useEffect(() => {
    setStagedProposal(null);
  }, [proposal.action, proposal.scope, proposal.rationale, proposal.ruleText]);

  const actions = SCOPE_ACTIONS[scope];
  const mutationTone = proposal.policyMutation
    ? proposal.policyBlocked
      ? 'destructive'
      : 'secondary'
    : 'outline';

  return (
    <div className="space-y-4" data-testid="policy-precedent-mode">
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <GitBranch className="h-4 w-4 text-primary" aria-hidden="true" />
              Runtime precedent
            </div>
            <h3 className="mt-2 text-base font-semibold">Convert judgment to Policy</h3>
          </div>
          <Badge variant={mutationTone}>
            {proposal.policyMutation ? 'Policy mutation' : 'One-off decision'}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(['CurrentRunOnly', 'FutureSimilarCases'] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => {
                setScope(candidate);
                setAction(SCOPE_ACTIONS[candidate][0]!);
              }}
              className={cn(
                'rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors',
                scope === candidate
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              {scopeLabel(candidate)}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {actions.map((candidate) => {
            const Icon = ACTION_ICONS[candidate];
            const selected = action === candidate;
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => setAction(candidate)}
                className={cn(
                  'flex min-h-12 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted/40',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{labelApprovalPolicyConversionAction(candidate)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Capability" value={proposal.capability} tone="strong" />
        <Field label="Environment" value={proposal.environment} />
        <Field
          label="Tier"
          value={
            proposal.policyBlocked
              ? `${proposal.currentTier} to Denied`
              : `${proposal.currentTier} to ${proposal.proposedTier}`
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/80 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Prefilled policy-change proposal
          </div>
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            {proposal.ruleText}
          </div>
          <div className="mt-3 space-y-2">
            {proposal.diff.map((entry) => (
              <div
                key={`${entry.field}-${entry.toValue}`}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <Badge variant="outline">{entry.field}</Badge>
                <span className="text-muted-foreground">{entry.fromValue}</span>
                <span aria-hidden="true">to</span>
                <span className="font-medium">{entry.toValue}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/80 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
            Audit and replay linkage
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Approval</span>
              <span className="font-mono text-xs">{proposal.auditLink.approvalId}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Run</span>
              <span className="font-mono text-xs">{proposal.auditLink.runId}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Evidence</span>
              <span className="font-mono text-xs">{proposal.auditLink.evidenceIds.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Replay subjects</span>
              <span className="font-mono text-xs">
                {proposal.simulation.replaySubjectIds.length}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="outline">policy simulation input</Badge>
            <Badge variant="outline">approval replay compatible</Badge>
            <Badge variant="outline">
              {proposal.policyBlocked ? 'blocking replay' : proposal.simulation.tier}
            </Badge>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/80 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <FileSearch className="h-4 w-4 text-primary" aria-hidden="true" />
          Structured feedback reasons
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {proposal.feedbackReasons.map((reason) => (
            <Badge key={reason.code} variant="secondary" className="text-[11px]">
              {reason.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/80 p-4">
        <label
          htmlFor={`precedent-rationale-${approval.approvalId}`}
          className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          Rationale
        </label>
        <Textarea
          id={`precedent-rationale-${approval.approvalId}`}
          className="mt-2 min-h-24 resize-none text-sm"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          placeholder="Rationale for the one-off decision or future Policy change"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {proposal.policyMutation
              ? 'Proposal is staged for future matching cases.'
              : 'Approval decision remains scoped to the current Run.'}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!proposal.policyMutation}
            onClick={() => setStagedProposal(proposal)}
          >
            Stage policy proposal
          </Button>
        </div>
        {stagedProposal ? (
          <div
            className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm"
            role="status"
          >
            <div className="font-medium text-foreground">
              Policy proposal staged for simulation before activation.
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Linked to approval {stagedProposal.auditLink.approvalId}, Run{' '}
              {stagedProposal.auditLink.runId}, and {stagedProposal.auditLink.evidenceIds.length}{' '}
              evidence item{stagedProposal.auditLink.evidenceIds.length === 1 ? '' : 's'}.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { lazy, Suspense, useMemo } from 'react';
import { Activity, ArrowRight, Ban, GitCompareArrows, UserCheck } from 'lucide-react';
import type {
  ApprovalSummary,
  PolicySummary,
  RunSummary,
  SodConstraint,
} from '@portarium/cockpit-types';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { Badge } from '@/components/ui/badge';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';
import { cn } from '@/lib/utils';

export type ExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';

export interface PolicyPreviewFormState {
  triggerAction: string;
  triggerCondition: string;
  tier: ExecutionTier;
  policyId?: string;
  policyBlocked?: boolean;
}

interface LivePolicyPreviewProps {
  form: PolicyPreviewFormState;
  policy?: PolicySummary;
  approvals?: readonly ApprovalSummary[];
  runs?: readonly RunSummary[];
  sodConstraints?: readonly SodConstraint[];
  currentTier?: ExecutionTier;
}

type ApprovalImpact = Readonly<{
  approval: ApprovalSummary;
  outcome: 'new-approval' | 'lower-gate' | 'blocked' | 'unchanged';
}>;

const DemoPolicyLivePreview = lazy(() =>
  import('@/mocks/components/demo-policy-live-preview').then((module) => ({
    default: module.PolicyLivePreview,
  })),
);

const TIER_RANK: Record<ExecutionTier, number> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

function isExecutionTier(value: unknown): value is ExecutionTier {
  return (
    value === 'Auto' || value === 'Assisted' || value === 'HumanApprove' || value === 'ManualOnly'
  );
}

function triggerParts(form: PolicyPreviewFormState): string[] {
  return [form.triggerAction, form.triggerCondition]
    .flatMap((part) => part.split(/\s+AND\s+/i))
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function approvalMatchesPolicy(
  approval: ApprovalSummary,
  policy: PolicySummary | undefined,
  form: PolicyPreviewFormState,
): boolean {
  const policyRule = approval.policyRule;
  if (!policyRule) return false;
  if (form.policyId && policyRule.ruleId === form.policyId) return true;
  if (policy?.policyId && policyRule.ruleId === policy.policyId) return true;

  const parts = triggerParts(form);
  if (parts.length === 0) return false;
  const trigger = policyRule.trigger.toLowerCase();
  return parts.every((part) => trigger.includes(part) || part.includes(trigger));
}

function classifyApprovalImpact(
  approval: ApprovalSummary,
  form: PolicyPreviewFormState,
  currentTier: ExecutionTier,
): ApprovalImpact['outcome'] {
  if (form.policyBlocked) return 'blocked';
  const approvalTier = isExecutionTier(approval.policyRule?.tier)
    ? approval.policyRule.tier
    : currentTier;
  if (approvalTier === form.tier) return 'unchanged';
  return TIER_RANK[form.tier] > TIER_RANK[approvalTier] ? 'new-approval' : 'lower-gate';
}

function ImpactBadge({ outcome }: { outcome: ApprovalImpact['outcome'] }) {
  const label = {
    blocked: 'Would be policy-blocked',
    'new-approval': 'Would add review',
    'lower-gate': 'Would lower gate',
    unchanged: 'No route change',
  }[outcome];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        outcome === 'blocked' && 'border-destructive/30 bg-destructive/10 text-destructive',
        outcome === 'new-approval' && 'border-orange-300 bg-orange-50 text-orange-700',
        outcome === 'lower-gate' && 'border-emerald-300 bg-emerald-50 text-emerald-700',
        outcome === 'unchanged' && 'border-border bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  );
}

function LivePolicyPreview({
  form,
  policy,
  approvals = [],
  runs = [],
  sodConstraints = [],
  currentTier = 'HumanApprove',
}: LivePolicyPreviewProps) {
  const affectedApprovals = useMemo<ApprovalImpact[]>(() => {
    return approvals
      .filter((approval) => approval.status === 'Pending')
      .filter((approval) => approvalMatchesPolicy(approval, policy, form))
      .map((approval) => ({
        approval,
        outcome: classifyApprovalImpact(approval, form, currentTier),
      }));
  }, [approvals, currentTier, form, policy]);

  const affectedRuns = useMemo(() => {
    const affectedWorkflowIds = new Set(policy?.affectedWorkflowIds ?? []);
    if (affectedWorkflowIds.size === 0) return [];
    return runs.filter((run) => affectedWorkflowIds.has(run.workflowId));
  }, [policy?.affectedWorkflowIds, runs]);

  const relatedSod = useMemo(() => {
    if (!policy?.policyId) return [];
    return sodConstraints.filter((constraint) =>
      constraint.relatedPolicyIds.includes(policy.policyId),
    );
  }, [policy?.policyId, sodConstraints]);

  const blockedCount = affectedApprovals.filter((item) => item.outcome === 'blocked').length;
  const reviewCount = affectedApprovals.filter((item) => item.outcome === 'new-approval').length;
  const lowerGateCount = affectedApprovals.filter((item) => item.outcome === 'lower-gate').length;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Expected Impact And Simulation
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-background/80 p-3">
          <div className="text-2xl font-semibold tabular-nums">{affectedApprovals.length}</div>
          <p className="text-xs text-muted-foreground">pending approvals matched</p>
        </div>
        <div className="rounded-md border border-border bg-background/80 p-3">
          <div className="text-2xl font-semibold tabular-nums">{affectedRuns.length}</div>
          <p className="text-xs text-muted-foreground">runs in affected Workflows</p>
        </div>
        <div className="rounded-md border border-border bg-background/80 p-3">
          <div className="text-2xl font-semibold tabular-nums">{relatedSod.length}</div>
          <p className="text-xs text-muted-foreground">SoD constraints in scope</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {blockedCount > 0 ? <Badge variant="destructive">{blockedCount} blocked</Badge> : null}
        {reviewCount > 0 ? <Badge variant="secondary">{reviewCount} add review</Badge> : null}
        {lowerGateCount > 0 ? <Badge variant="outline">{lowerGateCount} lower gate</Badge> : null}
        {affectedApprovals.length === 0 ? (
          <Badge variant="outline">No pending approval replay</Badge>
        ) : null}
      </div>

      <div className="space-y-2">
        {affectedApprovals.length > 0 ? (
          affectedApprovals.map(({ approval, outcome }) => (
            <div
              key={approval.approvalId}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{approval.prompt}</p>
                <ImpactBadge outcome={outcome} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{approval.approvalId}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                {form.policyBlocked ? (
                  <span className="inline-flex items-center gap-1 font-medium text-destructive">
                    <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                    blocked before approval
                  </span>
                ) : (
                  <ExecutionTierBadge tier={form.tier} />
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            No pending approvals currently match this rule. Future matching requests would use the
            proposed route after a backend policy mutation contract exists.
          </div>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-border bg-background/80 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <GitCompareArrows className="h-4 w-4 text-primary" aria-hidden="true" />
            Future request path
          </div>
          <p className="mt-2 text-muted-foreground">
            Matching future requests would route as{' '}
            {form.policyBlocked ? 'policy-blocked' : form.tier}.
          </p>
        </div>
        <div className="rounded-md border border-border bg-background/80 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Current live approvals
          </div>
          <p className="mt-2 text-muted-foreground">
            Existing approvals remain decisions for operators; this surface only simulates policy
            posture.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PolicyLivePreview(props: LivePolicyPreviewProps) {
  const runtime = resolveCockpitRuntime();

  if (!runtime.allowDemoControls) {
    return <LivePolicyPreview {...props} />;
  }

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="h-28 animate-pulse rounded-md bg-background/70" />
        </div>
      }
    >
      <DemoPolicyLivePreview form={props.form} />
    </Suspense>
  );
}

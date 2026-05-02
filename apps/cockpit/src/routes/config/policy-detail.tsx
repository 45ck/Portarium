import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { AlertCircle, Ban, GitCompareArrows, RotateCcw, ShieldCheck } from 'lucide-react';
import type { PolicySummary } from '@portarium/cockpit-types';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import {
  PolicyLivePreview,
  type ExecutionTier,
  type PolicyPreviewFormState,
} from '@/components/cockpit/policy-live-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { usePolicy, useSodConstraints } from '@/hooks/queries/use-policies';
import { useRuns } from '@/hooks/queries/use-runs';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

const DemoPolicyDetailPage = lazy(() =>
  import('@/mocks/routes/config/policy-detail-demo').then((module) => ({
    default: module.DemoPolicyDetailPage,
  })),
);

const EXECUTION_TIER_OPTIONS: ExecutionTier[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];

function isExecutionTier(value: unknown): value is ExecutionTier {
  return (
    value === 'Auto' || value === 'Assisted' || value === 'HumanApprove' || value === 'ManualOnly'
  );
}

function policyTier(policy?: PolicySummary): ExecutionTier {
  return isExecutionTier(policy?.tier) ? policy.tier : 'HumanApprove';
}

function parseRuleTrigger(
  ruleText: string,
): Pick<PolicyPreviewFormState, 'triggerAction' | 'triggerCondition'> {
  const normalized = ruleText.replace(/\s+/g, ' ').trim();
  const whenMatch = /WHEN\s+(.+?)(?:\s+THEN\s+|$)/i.exec(normalized);
  const trigger = whenMatch?.[1] ?? normalized;
  const [triggerAction = '', ...conditions] = trigger.split(/\s+AND\s+/i);
  return {
    triggerAction: triggerAction.trim(),
    triggerCondition: conditions.join(' AND ').trim(),
  };
}

function LivePolicyDetailPage({ policyId }: { policyId: string }) {
  const { activeWorkspaceId: wsId, activePersona } = useUIStore();
  const policyQuery = usePolicy(wsId, policyId);
  const approvalsQuery = useApprovals(wsId);
  const runsQuery = useRuns(wsId);
  const sodQuery = useSodConstraints(wsId);
  const [draftTier, setDraftTier] = useState<ExecutionTier>('HumanApprove');
  const [policyBlocked, setPolicyBlocked] = useState(false);
  const [rationale, setRationale] = useState('');
  const policy = policyQuery.data;
  const currentTier = policyTier(policy);
  const canStageDraft = activePersona !== 'Auditor';

  useEffect(() => {
    if (!policy) return;
    setDraftTier(policyTier(policy));
    setPolicyBlocked(false);
    setRationale('');
  }, [policy?.policyId]);

  const previewForm = useMemo<PolicyPreviewFormState>(() => {
    const trigger = parseRuleTrigger(policy?.ruleText ?? '');
    return {
      ...trigger,
      policyId,
      tier: draftTier,
      policyBlocked,
    };
  }, [draftTier, policy?.ruleText, policyBlocked, policyId]);

  if (policyQuery.isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Policy Detail"
          description="Control Plane policy detail could not be loaded."
          icon={<ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />}
          breadcrumb={[{ label: 'Policies', to: '/config/policies' }, { label: policyId }]}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/config/policies">Back to Policies</Link>
            </Button>
          }
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load policy</p>
            <p className="text-xs text-muted-foreground">Try reloading the policy record.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void policyQuery.refetch();
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (policyQuery.isLoading || !policy) {
    return (
      <div className="p-6">
        <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={policy.name}
        description="Review the current rule, stage a local proposed diff, and simulate impact."
        icon={<ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />}
        breadcrumb={[{ label: 'Policies', to: '/config/policies' }, { label: policy.policyId }]}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/config/policies">Back to Policies</Link>
          </Button>
        }
      />

      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        Detail edits are local simulation only. Backend policy lifecycle mutation is not available
        from Cockpit yet.
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Current Rule
                </CardTitle>
                <CardDescription>{policy.description}</CardDescription>
              </div>
              <ExecutionTierBadge tier={currentTier} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Rule text
              </div>
              <p className="mt-2 font-mono text-sm">{policy.ruleText}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Scope
                </div>
                <p className="mt-1">{policy.scope ?? 'Workspace policy'}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Affected Workflows
                </div>
                <p className="mt-1">{policy.affectedWorkflowIds?.length ?? 0}</p>
              </div>
              <div className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Status
                </div>
                <p className="mt-1">{policy.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompareArrows className="h-4 w-4 text-primary" />
              Proposed Diff
            </CardTitle>
            <CardDescription>Local draft state for review and simulation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {EXECUTION_TIER_OPTIONS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  disabled={!canStageDraft}
                  onClick={() => {
                    setDraftTier(tier);
                    setPolicyBlocked(false);
                  }}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    draftTier === tier && !policyBlocked
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  Set{' '}
                  {tier === 'HumanApprove'
                    ? 'Human Approve'
                    : tier === 'ManualOnly'
                      ? 'Manual Only'
                      : tier}
                </button>
              ))}
            </div>

            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <Checkbox
                checked={policyBlocked}
                disabled={!canStageDraft}
                onCheckedChange={(checked) => setPolicyBlocked(checked === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">Policy-block matching future actions</span>
                <span className="block text-xs text-muted-foreground">
                  Simulates a deny posture without backend mutation.
                </span>
              </span>
            </label>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Draft route
              </div>
              <div className="mt-2">
                {policyBlocked ? (
                  <Badge variant="destructive">
                    <Ban className="h-3 w-3" aria-hidden="true" />
                    Policy-blocked
                  </Badge>
                ) : (
                  <ExecutionTierBadge tier={draftTier} />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="policy-detail-rationale">Rationale</Label>
              <Textarea
                id="policy-detail-rationale"
                value={rationale}
                disabled={!canStageDraft}
                onChange={(event) => setRationale(event.target.value)}
                placeholder="Explain the staged change."
                className="min-h-24"
              />
            </div>

            <Button type="button" disabled>
              Publish policy change
            </Button>
          </CardContent>
        </Card>
      </div>

      <PolicyLivePreview
        form={previewForm}
        policy={policy}
        approvals={approvalsQuery.data?.items ?? []}
        runs={runsQuery.data?.items ?? []}
        sodConstraints={sodQuery.data?.items ?? []}
        currentTier={currentTier}
      />
    </div>
  );
}

function PolicyDetailPage() {
  const { policyId } = Route.useParams();
  const runtime = resolveCockpitRuntime();

  if (!runtime.allowDemoControls) {
    return <LivePolicyDetailPage policyId={policyId} />;
  }

  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="h-56 animate-pulse rounded-md border border-border bg-muted/30" />
        </div>
      }
    >
      <DemoPolicyDetailPage policyId={policyId} />
    </Suspense>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/policies/$policyId',
  component: PolicyDetailPage,
});

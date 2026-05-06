import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  FileText,
  GitCompareArrows,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type { PolicySummary } from '@portarium/cockpit-types';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { usePolicies, useSodConstraints } from '@/hooks/queries/use-policies';
import { useRuns } from '@/hooks/queries/use-runs';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

const EXECUTION_TIER_OPTIONS: ExecutionTier[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];

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

function riskTone(
  currentTier: ExecutionTier,
  draftTier: ExecutionTier,
  policyBlocked: boolean,
): 'high' | 'medium' | 'low' {
  if (policyBlocked || draftTier === 'ManualOnly') return 'high';
  if (TIER_RANK[draftTier] > TIER_RANK[currentTier]) return 'medium';
  return 'low';
}

function riskLabel(tone: ReturnType<typeof riskTone>): string {
  if (tone === 'high') return 'Risky change';
  if (tone === 'medium') return 'More restrictive';
  return 'Low-risk or lower-friction';
}

function affectedWorkflowText(policy: PolicySummary): string {
  const count = policy.affectedWorkflowIds?.length ?? 0;
  if (count === 0) return 'No affected Workflows declared by the API';
  if (count === 1) return '1 affected Workflow declared by the API';
  return `${count} affected Workflows declared by the API`;
}

function DemoLoadingState() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Policy Studio"
        icon={<EntityIcon entityType="policy" size="md" decorative />}
      />
      <div className="h-40 rounded-md border border-border bg-muted/30 animate-pulse" />
    </div>
  );
}

function PolicySelector({
  policies,
  selectedPolicyId,
  onSelect,
}: {
  policies: readonly PolicySummary[];
  selectedPolicyId: string;
  onSelect: (policyId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {policies.map((policy) => {
        const selected = policy.policyId === selectedPolicyId;
        return (
          <button
            key={policy.policyId}
            type="button"
            onClick={() => onSelect(policy.policyId)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{policy.name}</span>
              <Badge variant={policy.status === 'Active' ? 'secondary' : 'outline'}>
                {policy.status}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {policy.description || policy.ruleText}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{policy.policyId}</span>
              {isExecutionTier(policy.tier) ? <ExecutionTierBadge tier={policy.tier} /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmptyPolicyState() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Policy Studio"
        description="No policy rules were returned by the current Workspace policy API."
        icon={<EntityIcon entityType="policy" size="md" decorative />}
      />
      <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
        The policy authoring surface needs at least one current rule before it can stage a proposed
        diff or simulate future routing.
      </div>
    </div>
  );
}

function LivePolicyStudioPage() {
  const { activeWorkspaceId: wsId, activePersona } = useUIStore();
  const policiesQuery = usePolicies(wsId);
  const approvalsQuery = useApprovals(wsId);
  const runsQuery = useRuns(wsId);
  const sodQuery = useSodConstraints(wsId);
  const policies = policiesQuery.data?.items ?? [];
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [draftTier, setDraftTier] = useState<ExecutionTier>('HumanApprove');
  const [policyBlocked, setPolicyBlocked] = useState(false);
  const [rationale, setRationale] = useState('');

  useEffect(() => {
    if (!selectedPolicyId && policies[0]) {
      setSelectedPolicyId(policies[0].policyId);
    }
  }, [policies, selectedPolicyId]);

  const selectedPolicy = useMemo(
    () => policies.find((policy) => policy.policyId === selectedPolicyId) ?? policies[0],
    [policies, selectedPolicyId],
  );
  const currentTier = policyTier(selectedPolicy);

  useEffect(() => {
    if (!selectedPolicy) return;
    setDraftTier(policyTier(selectedPolicy));
    setPolicyBlocked(false);
    setRationale('');
  }, [selectedPolicy?.policyId]);

  if (policiesQuery.isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Policy Studio"
          description="Control Plane policy rules could not be loaded."
          icon={<EntityIcon entityType="policy" size="md" decorative />}
        />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load policies</p>
            <p className="text-xs text-muted-foreground">
              Try reloading the Workspace policy data.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void policiesQuery.refetch();
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (policiesQuery.isLoading) {
    return <DemoLoadingState />;
  }

  if (!selectedPolicy) return <EmptyPolicyState />;

  const canStageDraft = activePersona !== 'Auditor';
  const trigger = parseRuleTrigger(selectedPolicy.ruleText);
  const previewForm: PolicyPreviewFormState = {
    ...trigger,
    tier: draftTier,
    policyId: selectedPolicy.policyId,
    policyBlocked,
  };
  const tone = riskTone(currentTier, draftTier, policyBlocked);
  const hasDraftChange = draftTier !== currentTier || policyBlocked || rationale.trim().length > 0;
  const impactedApprovals = approvalsQuery.data?.items ?? [];
  const impactedRuns = runsQuery.data?.items ?? [];
  const sodConstraints = sodQuery.data?.items ?? [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Policy Studio"
        description="Stage policy posture changes against live Control Plane data without applying unavailable backend mutations."
        icon={<EntityIcon entityType="policy" size="md" decorative />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={canStageDraft ? 'secondary' : 'outline'}>
              {canStageDraft ? 'Draft simulation enabled' : 'Read-only simulation'}
            </Badge>
            <Badge variant="outline">Workspace {wsId}</Badge>
          </div>
        }
      />

      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        Backend policy lifecycle mutation is not wired here yet. This page shows the current rule, a
        local proposed diff, rationale, and expected impact; publishing stays disabled until the
        Control Plane contract is available.
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.65fr)_minmax(0,1.35fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Current Rules</CardTitle>
            <CardDescription>Policy records returned by the Workspace API.</CardDescription>
          </CardHeader>
          <CardContent>
            <PolicySelector
              policies={policies}
              selectedPolicyId={selectedPolicy.policyId}
              onSelect={setSelectedPolicyId}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Current Rule
                  </CardTitle>
                  <CardDescription>{selectedPolicy.description}</CardDescription>
                </div>
                <ExecutionTierBadge tier={currentTier} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Rule text
                </div>
                <p className="mt-2 font-mono text-sm">{selectedPolicy.ruleText}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Scope
                  </div>
                  <p className="mt-1">{selectedPolicy.scope ?? 'Workspace policy'}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Blast radius
                  </div>
                  <p className="mt-1">{affectedWorkflowText(selectedPolicy)}</p>
                </div>
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Rule count
                  </div>
                  <p className="mt-1">{selectedPolicy.ruleCount ?? 1}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GitCompareArrows className="h-4 w-4 text-primary" />
                    Proposed Diff
                  </CardTitle>
                  <CardDescription>
                    Local draft only; operators can inspect the policy change before any backend
                    apply path exists.
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    tone === 'high' ? 'destructive' : tone === 'medium' ? 'secondary' : 'outline'
                  }
                >
                  {riskLabel(tone)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Current route
                  </div>
                  <div className="mt-2">
                    <ExecutionTierBadge tier={currentTier} />
                  </div>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Proposed route
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
              </div>

              <div className="space-y-2">
                <Label>Action class</Label>
                <div className="grid gap-2 sm:grid-cols-4">
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
                        'rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
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
              </div>

              <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <Checkbox
                  checked={policyBlocked}
                  disabled={!canStageDraft}
                  onCheckedChange={(checked) => setPolicyBlocked(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">
                    Treat matching future actions as policy-blocked
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    This simulates a deny posture. It does not write a blocking rule to the backend.
                  </span>
                </span>
              </label>

              <div className="space-y-2">
                <Label htmlFor="policy-rationale">Rationale</Label>
                <Textarea
                  id="policy-rationale"
                  value={rationale}
                  disabled={!canStageDraft}
                  onChange={(event) => setRationale(event.target.value)}
                  placeholder="Explain why this policy posture should change and what impact operators should expect."
                  className="min-h-24"
                />
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Diff packet
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Tier {currentTier} to {policyBlocked ? 'policy-blocked' : draftTier}.
                  </p>
                </div>
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Rationale state
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {rationale.trim() ? 'Captured for review.' : 'No rationale captured yet.'}
                  </p>
                </div>
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Ban className="h-4 w-4 text-primary" />
                    Apply path
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Publish disabled pending API contract.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled>
                  Publish policy change
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hasDraftChange || !canStageDraft}
                  onClick={() => {
                    setDraftTier(currentTier);
                    setPolicyBlocked(false);
                    setRationale('');
                  }}
                >
                  Reset draft
                </Button>
              </div>
            </CardContent>
          </Card>

          <PolicyLivePreview
            form={previewForm}
            policy={selectedPolicy}
            approvals={impactedApprovals}
            runs={impactedRuns}
            sodConstraints={sodConstraints}
            currentTier={currentTier}
          />
        </div>
      </div>
    </div>
  );
}

export function PolicyStudioPage() {
  return <LivePolicyStudioPage />;
}

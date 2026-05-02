import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowRight,
  GitCompareArrows,
  History,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type {
  ApprovalSummary,
  EvidenceEntry,
  PolicySummary,
  RunSummary,
  SodConstraint,
} from '@portarium/cockpit-types';
import { PageHeader } from '@/components/cockpit/page-header';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { FreshnessBadge } from '@/components/cockpit/freshness-badge';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useEvidence } from '@/hooks/queries/use-evidence';
import { usePolicies, useSodConstraints } from '@/hooks/queries/use-policies';
import { useRuns } from '@/hooks/queries/use-runs';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

type ExecutionTier = RunSummary['executionTier'];

type CapabilityPosture = Readonly<{
  capability: string;
  policies: PolicySummary[];
  approvals: ApprovalSummary[];
  incidents: EvidenceEntry[];
  activeRules: number;
  strongestTier: ExecutionTier;
  noiseCount: number;
  driftSignals: string[];
}>;

type PolicyOwnership = Readonly<{
  policy: PolicySummary;
  owner: string;
  reviewState: 'Current' | 'Due soon' | 'Overdue' | 'Missing owner';
  lastReviewedAtIso?: string;
  incidentCount: number;
  sodCount: number;
}>;

const EXECUTION_TIERS: ExecutionTier[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];
const TIER_WEIGHT: Record<ExecutionTier, number> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

const POLICY_OWNER_FALLBACKS: Record<
  string,
  { owner: string; lastReviewedAtIso: string; reviewState: PolicyOwnership['reviewState'] }
> = {
  'pol-001': {
    owner: 'Security operations',
    lastReviewedAtIso: '2026-04-15T09:00:00.000Z',
    reviewState: 'Current',
  },
  'pol-002': {
    owner: 'Privacy lead',
    lastReviewedAtIso: '2026-03-22T09:00:00.000Z',
    reviewState: 'Due soon',
  },
  'pol-003': {
    owner: 'IAM operations',
    lastReviewedAtIso: '2026-04-08T09:00:00.000Z',
    reviewState: 'Current',
  },
  'pol-004': {
    owner: 'Robotics safety',
    lastReviewedAtIso: '2026-02-28T09:00:00.000Z',
    reviewState: 'Overdue',
  },
  'pol-006': {
    owner: 'Approval operations',
    lastReviewedAtIso: '2026-04-01T09:00:00.000Z',
    reviewState: 'Due soon',
  },
};

function isExecutionTier(value: unknown): value is ExecutionTier {
  return (
    value === 'Auto' || value === 'Assisted' || value === 'HumanApprove' || value === 'ManualOnly'
  );
}

function policyTier(policy: PolicySummary): ExecutionTier {
  return isExecutionTier(policy.tier) ? policy.tier : 'HumanApprove';
}

function strongestTier(tiers: readonly ExecutionTier[]): ExecutionTier {
  return tiers.reduce<ExecutionTier>(
    (strongest, tier) => (TIER_WEIGHT[tier] > TIER_WEIGHT[strongest] ? tier : strongest),
    'Auto',
  );
}

function capabilityForPolicy(policy: PolicySummary): string {
  const haystack = `${policy.name} ${policy.scope ?? ''} ${policy.ruleText}`.toLowerCase();
  if (haystack.includes('robot') || haystack.includes('sensor') || haystack.includes('mission')) {
    return 'RoboticsActuation';
  }
  if (
    haystack.includes('payment') ||
    haystack.includes('finance') ||
    haystack.includes('invoice')
  ) {
    return 'FinanceAccounting';
  }
  if (haystack.includes('approval')) return 'Approval gates';
  if (haystack.includes('crm') || haystack.includes('campaign')) return 'CrmSales';
  if (haystack.includes('access') || haystack.includes('iam') || haystack.includes('session')) {
    return 'IamDirectory';
  }
  if (haystack.includes('data') || haystack.includes('gdpr') || haystack.includes('pii')) {
    return 'ComplianceGrc';
  }
  if (haystack.includes('agent')) return 'Machine governance';
  return policy.scope ?? 'Workspace policy';
}

function policyMatchesApproval(policy: PolicySummary, approval: ApprovalSummary): boolean {
  if (approval.policyRule?.ruleId === policy.policyId) return true;
  return Boolean(
    policy.affectedWorkflowIds?.some((workflowId) => approval.runId.includes(workflowId)),
  );
}

function evidenceRelatesToPolicy(policy: PolicySummary, evidence: EvidenceEntry): boolean {
  const summary = evidence.summary.toLowerCase();
  return (
    summary.includes(policy.policyId.toLowerCase()) ||
    summary.includes(policy.name.toLowerCase()) ||
    summary.includes(capabilityForPolicy(policy).toLowerCase()) ||
    Boolean(evidence.links?.externalRefs?.some((ref) => ref.externalId === policy.policyId))
  );
}

function isPolicyIncident(evidence: EvidenceEntry): boolean {
  return (
    evidence.category === 'PolicyViolation' ||
    /denied|blocked|incident|near miss|near-miss|escalat/i.test(evidence.summary)
  );
}

function isOverrideEvidence(evidence: EvidenceEntry): boolean {
  return /override|break-glass|break glass|emergency|handoff|reroute|freeze|operator-owned/i.test(
    evidence.summary,
  );
}

function buildCapabilityPosture(
  policies: readonly PolicySummary[],
  approvals: readonly ApprovalSummary[],
  evidence: readonly EvidenceEntry[],
  runs: readonly RunSummary[],
): CapabilityPosture[] {
  const byCapability = new Map<string, PolicySummary[]>();
  for (const policy of policies) {
    const capability = capabilityForPolicy(policy);
    byCapability.set(capability, [...(byCapability.get(capability) ?? []), policy]);
  }

  return Array.from(byCapability.entries())
    .map(([capability, capabilityPolicies]) => {
      const relatedApprovals = approvals.filter((approval) =>
        capabilityPolicies.some((policy) => policyMatchesApproval(policy, approval)),
      );
      const relatedIncidents = evidence.filter((entry) =>
        capabilityPolicies.some((policy) => evidenceRelatesToPolicy(policy, entry)),
      );
      const capabilityRuns = runs.filter((run) =>
        capabilityPolicies.some((policy) => policy.affectedWorkflowIds?.includes(run.workflowId)),
      );
      const driftSignals = [
        ...capabilityPolicies
          .filter((policy) => policy.status === 'Draft')
          .map((policy) => `${policy.name} still draft`),
        ...capabilityRuns
          .filter((run) => run.controlState === 'blocked' || run.controlState === 'degraded')
          .map((run) => `${run.workflowId} ${run.controlState}`),
        ...relatedIncidents
          .filter((entry) => /drift|changed after|unexpected/i.test(entry.summary))
          .map((entry) => entry.summary),
      ];
      const noisyApprovals = relatedApprovals.filter(
        (approval) =>
          approval.status === 'Pending' ||
          approval.status === 'Denied' ||
          approval.status === 'RequestChanges' ||
          approval.status === 'Expired',
      );
      return {
        capability,
        policies: capabilityPolicies,
        approvals: relatedApprovals,
        incidents: relatedIncidents.filter(isPolicyIncident),
        activeRules: capabilityPolicies.filter((policy) => policy.status === 'Active').length,
        strongestTier: strongestTier(capabilityPolicies.map(policyTier)),
        noiseCount: noisyApprovals.length,
        driftSignals: Array.from(new Set(driftSignals)).slice(0, 3),
      };
    })
    .sort((a, b) => {
      const riskA = TIER_WEIGHT[a.strongestTier] * 10 + a.incidents.length * 4 + a.noiseCount;
      const riskB = TIER_WEIGHT[b.strongestTier] * 10 + b.incidents.length * 4 + b.noiseCount;
      return riskB - riskA;
    });
}

function buildOwnershipRows(
  policies: readonly PolicySummary[],
  sodConstraints: readonly SodConstraint[],
  evidence: readonly EvidenceEntry[],
): PolicyOwnership[] {
  return policies.map((policy) => {
    const fallback = POLICY_OWNER_FALLBACKS[policy.policyId];
    const owner = fallback?.owner ?? 'Unassigned';
    const reviewState = fallback?.reviewState ?? 'Missing owner';
    const incidentCount = evidence.filter(
      (entry) => isPolicyIncident(entry) && evidenceRelatesToPolicy(policy, entry),
    ).length;
    const sodCount = sodConstraints.filter((constraint) =>
      constraint.relatedPolicyIds.includes(policy.policyId),
    ).length;

    return {
      policy,
      owner,
      reviewState,
      lastReviewedAtIso: fallback?.lastReviewedAtIso,
      incidentCount,
      sodCount,
    };
  });
}

function tierTone(tier: ExecutionTier): string {
  switch (tier) {
    case 'Auto':
      return 'bg-sky-500';
    case 'Assisted':
      return 'bg-emerald-500';
    case 'HumanApprove':
      return 'bg-amber-500';
    case 'ManualOnly':
      return 'bg-rose-500';
  }
}

function formatShortDate(iso?: string): string {
  if (!iso) return 'No review recorded';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  );
}

function reviewStateClassName(state: PolicyOwnership['reviewState']): string {
  switch (state) {
    case 'Current':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200';
    case 'Due soon':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200';
    case 'Overdue':
      return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200';
    case 'Missing owner':
      return 'border-border bg-muted text-muted-foreground';
  }
}

function EmptyLine({ children }: { children: string }) {
  return <p className="py-3 text-xs text-muted-foreground">{children}</p>;
}

function dedupeEvidence(entries: readonly EvidenceEntry[]): EvidenceEntry[] {
  return Array.from(new Map(entries.map((entry) => [entry.evidenceId, entry])).values());
}

export function PolicyOverviewPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const policiesQuery = usePolicies(wsId);
  const approvalsQuery = useApprovals(wsId);
  const runsQuery = useRuns(wsId);
  const sodQuery = useSodConstraints(wsId);
  const policyEvidenceQuery = useEvidence(wsId, { category: 'Policy', limit: 30 });
  const violationEvidenceQuery = useEvidence(wsId, { category: 'PolicyViolation', limit: 30 });

  const policies = policiesQuery.data?.items ?? [];
  const approvals = approvalsQuery.data?.items ?? [];
  const runs = runsQuery.data?.items ?? [];
  const sodConstraints = sodQuery.data?.items ?? [];
  const evidence = Array.from(
    new Map(
      [
        ...(policyEvidenceQuery.data?.items ?? []),
        ...(violationEvidenceQuery.data?.items ?? []),
      ].map((entry) => [entry.evidenceId, entry]),
    ).values(),
  );
  const tierCounts = EXECUTION_TIERS.map((tier) => ({
    tier,
    count: policies.filter((policy) => policyTier(policy) === tier).length,
  }));
  const activePolicyCount = policies.filter((policy) => policy.status === 'Active').length;
  const draftPolicyCount = policies.filter((policy) => policy.status === 'Draft').length;
  const pendingPolicyApprovals = approvals.filter(
    (approval) =>
      approval.status === 'Pending' &&
      policies.some((policy) => policyMatchesApproval(policy, approval)),
  );
  const policyIncidents = evidence.filter(isPolicyIncident);
  const overrides = [
    ...evidence.filter(isOverrideEvidence),
    ...runs
      .filter((run) => run.controlState === 'operator-owned' || run.controlState === 'frozen')
      .map<EvidenceEntry>((run) => ({
        schemaVersion: 1,
        evidenceId: `run-control-${run.runId}`,
        workspaceId: run.workspaceId,
        occurredAtIso: run.startedAtIso ?? run.createdAtIso,
        category: 'OperatorSurface',
        summary: `${run.controlState} override on ${run.workflowId}`,
        actor: { kind: 'System' },
        links: { runId: run.runId },
        hashSha256: run.runId,
      })),
  ]
    .sort((a, b) => b.occurredAtIso.localeCompare(a.occurredAtIso))
    .slice(0, 5);
  const capabilityPosture = buildCapabilityPosture(policies, approvals, evidence, runs);
  const ownershipRows = buildOwnershipRows(policies, sodConstraints, evidence);
  const riskyCapabilities = capabilityPosture
    .filter((item) => item.noiseCount > 0 || item.incidents.length > 0 || item.driftSignals.length)
    .slice(0, 5);
  const noisyApprovalClasses = capabilityPosture
    .filter((item) => item.noiseCount > 0)
    .sort((a, b) => b.noiseCount - a.noiseCount)
    .slice(0, 4);
  const unownedPolicies = ownershipRows.filter((row) => row.reviewState === 'Missing owner').length;
  const reviewAttentionCount = ownershipRows.filter(
    (row) => row.reviewState === 'Due soon' || row.reviewState === 'Overdue',
  ).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Policy Overview"
        description="Operational policy posture, approval noise, ownership, drift, and runtime incidents."
        icon={<EntityIcon entityType="policy" size="md" decorative />}
        status={
          <>
            <FreshnessBadge sourceLabel="Approvals" offlineMeta={approvalsQuery.offlineMeta} />
            <FreshnessBadge sourceLabel="Runs" offlineMeta={runsQuery.offlineMeta} />
            <FreshnessBadge sourceLabel="Evidence" offlineMeta={policyEvidenceQuery.offlineMeta} />
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link to="/config/policies/studio">
                <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                Open Policy Studio
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/config/blast-radius">Capability Posture</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Active policy rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activePolicyCount}</div>
            <p className="text-xs text-muted-foreground">{draftPolicyCount} drafts need review</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Approval noise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{pendingPolicyApprovals.length}</div>
            <p className="text-xs text-muted-foreground">pending approvals tied to policy gates</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Incidents and denials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{policyIncidents.length}</div>
            <p className="text-xs text-muted-foreground">recent policy violations or escalations</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase">Ownership attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{reviewAttentionCount + unownedPolicies}</div>
            <p className="text-xs text-muted-foreground">
              due, overdue, or unassigned policy areas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  Posture By Execution Tier
                </CardTitle>
                <CardDescription>
                  The current routing mix across Policy rules before opening the editor.
                </CardDescription>
              </div>
              <Badge variant="outline">{policies.length} policies</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tierCounts.map(({ tier, count }) => {
              const percent = policies.length > 0 ? Math.round((count / policies.length) * 100) : 0;
              return (
                <div key={tier} className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_48px]">
                  <ExecutionTierBadge tier={tier} />
                  <div className="h-2 self-center rounded-full bg-muted">
                    <div
                      className={cn('h-2 rounded-full', tierTone(tier))}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="text-right text-sm font-medium">{count}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-primary" aria-hidden="true" />
              Risky Capabilities
            </CardTitle>
            <CardDescription>
              Policy areas with approval noise, incidents, or drift.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskyCapabilities.length === 0 ? (
              <EmptyLine>No risky capability signals detected.</EmptyLine>
            ) : (
              riskyCapabilities.map((item) => (
                <div key={item.capability} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.capability}</p>
                    <ExecutionTierBadge tier={item.strongestTier} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>{item.activeRules} active</span>
                    <span>{item.noiseCount} noisy</span>
                    <span>{item.incidents.length} incidents</span>
                  </div>
                  {item.driftSignals[0] ? (
                    <p className="mt-2 line-clamp-2 text-xs text-amber-700 dark:text-amber-300">
                      {item.driftSignals[0]}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" />
              Noisy Approval Classes And Drift
            </CardTitle>
            <CardDescription>
              Use these rows to decide which policy defaults need tightening or relaxing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {noisyApprovalClasses.length === 0 ? (
              <EmptyLine>No noisy approval classes found.</EmptyLine>
            ) : (
              noisyApprovalClasses.map((item) => (
                <div
                  key={item.capability}
                  className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div>
                    <p className="font-medium">{item.capability}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.noiseCount} unresolved approvals across {item.policies.length} policy
                      rules.
                    </p>
                    {item.driftSignals.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.driftSignals.map((signal) => (
                          <Badge key={signal} variant="secondary" className="text-[11px]">
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/config/policies/studio">
                      Simulate
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" aria-hidden="true" />
              Recent Overrides And Incidents
            </CardTitle>
            <CardDescription>
              Break-glass usage, denials, escalations, and near misses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dedupeEvidence([...overrides, ...policyIncidents])
              .sort((a, b) => b.occurredAtIso.localeCompare(a.occurredAtIso))
              .slice(0, 6)
              .map((entry) => (
                <div key={entry.evidenceId} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant={entry.category === 'PolicyViolation' ? 'destructive' : 'outline'}
                    >
                      {entry.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatShortDate(entry.occurredAtIso)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{entry.summary}</p>
                  {entry.links?.runId ? (
                    <Link
                      to="/runs/$runId"
                      params={{ runId: entry.links.runId }}
                      className="mt-2 inline-flex text-xs text-primary hover:underline"
                    >
                      Open Run {entry.links.runId}
                    </Link>
                  ) : null}
                </div>
              ))}
            {overrides.length === 0 && policyIncidents.length === 0 ? (
              <EmptyLine>No recent overrides or policy incidents found.</EmptyLine>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Ownership And Review State
          </CardTitle>
          <CardDescription>
            Each policy area needs an accountable owner before operators change posture.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {ownershipRows.map((row) => (
            <div
              key={row.policy.policyId}
              className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/config/policies/$policyId"
                    params={{ policyId: row.policy.policyId }}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.policy.name}
                  </Link>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {row.policy.policyId}
                  </Badge>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Owner: {row.owner}</span>
                  <span>Reviewed: {formatShortDate(row.lastReviewedAtIso)}</span>
                  <span>{row.sodCount} SoD constraints</span>
                  <span>{row.incidentCount} linked incidents</span>
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn('self-start', reviewStateClassName(row.reviewState))}
              >
                {row.reviewState}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Policy Studio',
            description: 'Stage posture changes and simulate approval impact.',
            to: '/config/policies/studio',
          },
          {
            title: 'Capability Posture',
            description: 'Inspect tool blast radius and capability controls.',
            to: '/config/blast-radius',
          },
          {
            title: 'Governance Explorer',
            description: 'Open raw Policy, SoD, and evidence tables.',
            to: '/explore/governance',
          },
          {
            title: 'Approvals',
            description: 'Review live cases contributing to policy noise.',
            to: '/approvals',
          },
        ].map((entry) => (
          <Card key={entry.title} className="shadow-none">
            <CardHeader>
              <CardTitle className="text-sm">{entry.title}</CardTitle>
              <CardDescription>{entry.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link to={entry.to}>
                  Open
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

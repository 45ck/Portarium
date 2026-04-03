import { useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  ClipboardList,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import { PageHeader } from '@/components/cockpit/page-header';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import {
  PolicyLivePreview,
  type PolicyPreviewFormState,
} from '@/components/cockpit/policy-live-preview';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  type ExecutionTier,
  type PolicyStudioSearch,
  serializeDelimitedSearchList,
  parseDelimitedSearchList,
  toApprovalReturnSearch,
} from '@/lib/policy-studio-search';
import { cn } from '@/lib/utils';
import { APPROVALS, POLICIES } from '@/mocks/fixtures/openclaw-demo';

interface PolicySlice {
  id: string;
  title: string;
  family: string;
  owner: string;
  reviewCadence: string;
  environment: string;
  systems: string[];
  sensitivity: string;
  persistence: string;
  blastRadius: string;
  tier: ExecutionTier;
  roles: string[];
  evidence: string[];
  triggerAction: string;
  triggerCondition: string;
  policyId: string;
  rationale: string;
  precedentApprovalIds: string[];
}

interface RuntimePrecedent {
  id: string;
  approvalId: string;
  title: string;
  summary: string;
  decisionType: 'tighten' | 'relax' | 'keep-tight';
  targetPolicyId: string;
  recommendedTier: ExecutionTier;
  recommendedEvidence: string[];
  recommendedRoles: string[];
  feedback: string;
}

interface DraftState {
  tier: ExecutionTier;
  evidence: string[];
  rationale: string;
}

const TIER_RANK: Record<ExecutionTier, number> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

const EXECUTION_TIER_OPTIONS: ExecutionTier[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];

const DEFAULT_EVIDENCE_OPTIONS = [
  'Draft preview',
  'Recipient or target list',
  'Diff artifact',
  'Sample output',
  'Impacted entities list',
  'Rollback plan',
  'Policy trace',
  'Connector posture check',
  'Blast radius preview',
];

const POLICY_METADATA: Record<
  string,
  {
    family: string;
    owner: string;
    reviewCadence: string;
    sensitivity: string;
    persistence: string;
    evidence: string[];
  }
> = {
  'COMMUNICATION-APPROVAL-001': {
    family: 'Outbound communication',
    owner: 'Policy owner / Comms ops',
    reviewCadence: 'Weekly',
    sensitivity: 'External reputation + customer data',
    persistence: 'One-shot external action',
    evidence: ['Draft preview', 'Recipient or target list', 'Policy trace'],
  },
  'CALENDAR-APPROVAL-001': {
    family: 'External scheduling',
    owner: 'Approver / Revenue operations',
    reviewCadence: 'Weekly',
    sensitivity: 'External coordination',
    persistence: 'Calendar artifact',
    evidence: ['Draft preview', 'Recipient or target list', 'Policy trace'],
  },
  'EMAIL-DESTRUCTIVE-BLOCK-001': {
    family: 'Destructive mailbox action',
    owner: 'Security admin',
    reviewCadence: 'Per incident',
    sensitivity: 'Workspace-wide destructive action',
    persistence: 'Irreversible',
    evidence: ['Blast radius preview', 'Break-glass ticket', 'Rollback plan', 'Policy trace'],
  },
  'CRON-BATCH-APPROVAL-001': {
    family: 'Batch external delivery',
    owner: 'Operations dispatch',
    reviewCadence: 'Daily',
    sensitivity: 'Cross-channel outbound update',
    persistence: 'Visible downstream output',
    evidence: ['Sample output', 'Impacted entities list', 'Policy trace'],
  },
  'CRON-CREATE-BLOCK-001': {
    family: 'Persistent automation',
    owner: 'Platform admin',
    reviewCadence: 'Per request',
    sensitivity: 'Persistent unattended execution',
    persistence: 'Long-running schedule',
    evidence: ['Diff artifact', 'Rollback plan', 'Connector posture check', 'Policy trace'],
  },
  'SUBAGENT-APPLY-001': {
    family: 'Sub-agent application',
    owner: 'Inbox operations',
    reviewCadence: 'Daily',
    sensitivity: 'Inbox state mutation',
    persistence: 'Reversible workspace change',
    evidence: ['Sample output', 'Diff artifact', 'Policy trace'],
  },
  'CRON-GREEN-AUTO-001': {
    family: 'Internal note mutation',
    owner: 'Workspace operator',
    reviewCadence: 'Monthly',
    sensitivity: 'Internal-only note update',
    persistence: 'Low-risk internal change',
    evidence: ['Sample output'],
  },
};

const RUNTIME_PRECEDENTS: RuntimePrecedent[] = [
  {
    id: 'precedent-delete-all',
    approvalId: 'apr-oc-3203',
    title: 'Delete-all emails safety test',
    summary:
      'Blocked destructive mailbox wipe should harden doctrine, not rely on one-off operator denial.',
    decisionType: 'keep-tight',
    targetPolicyId: 'EMAIL-DESTRUCTIVE-BLOCK-001',
    recommendedTier: 'ManualOnly',
    recommendedEvidence: [
      'Blast radius preview',
      'Break-glass ticket',
      'Rollback plan',
      'Policy trace',
    ],
    recommendedRoles: ['security-admin'],
    feedback:
      'Convert destructive mailbox actions into non-overridable doctrine at higher layers, with break-glass only for security-admin.',
  },
  {
    id: 'precedent-persistent-cron',
    approvalId: 'apr-oc-3205',
    title: 'Persistent cron creation request',
    summary:
      'Persistent automation needs more friction and a visible rollback path before any human can even consider approval.',
    decisionType: 'keep-tight',
    targetPolicyId: 'CRON-CREATE-BLOCK-001',
    recommendedTier: 'ManualOnly',
    recommendedEvidence: [
      'Diff artifact',
      'Rollback plan',
      'Connector posture check',
      'Policy trace',
    ],
    recommendedRoles: ['admin'],
    feedback:
      'Escalate schedule creation to a control-room review path with explicit rollback evidence and admin-only authority.',
  },
  {
    id: 'precedent-subagent-apply',
    approvalId: 'apr-oc-3206',
    title: 'Sub-agent tagging result',
    summary:
      'Safe-looking inbox mutation can likely move from HumanApprove to Assisted if preview evidence is present.',
    decisionType: 'relax',
    targetPolicyId: 'SUBAGENT-APPLY-001',
    recommendedTier: 'Assisted',
    recommendedEvidence: ['Sample output', 'Diff artifact', 'Policy trace'],
    recommendedRoles: ['approver'],
    feedback:
      'Allow operators to accept low-risk sub-agent outputs faster when the diff is visible and reversibility is explicit.',
  },
  {
    id: 'precedent-cron-batch',
    approvalId: 'apr-oc-3204',
    title: 'Morning brief batch output',
    summary:
      'Batch external delivery stays human-gated, but the evidence packet needs sample output and impacted-channel visibility.',
    decisionType: 'tighten',
    targetPolicyId: 'CRON-BATCH-APPROVAL-001',
    recommendedTier: 'HumanApprove',
    recommendedEvidence: [
      'Sample output',
      'Impacted entities list',
      'Connector posture check',
      'Policy trace',
    ],
    recommendedRoles: ['approver', 'operations.dispatch'],
    feedback:
      'Keep the gate, but require higher-fidelity evidence so operators can judge blast radius quickly instead of opening multiple panels.',
  },
];

function parseTrigger(trigger: string): { triggerAction: string; triggerCondition: string } {
  const [triggerAction = '', triggerCondition = ''] = trigger.split(' AND ');
  return {
    triggerAction,
    triggerCondition,
  };
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_:-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function buildPolicySlices(): PolicySlice[] {
  return POLICIES.map((policy) => {
    const metadata = POLICY_METADATA[policy.policyId] ?? {
      family: 'Capability posture',
      owner: 'Policy owner',
      reviewCadence: 'Quarterly',
      sensitivity: 'Workspace impact',
      persistence: 'Varies by action',
      evidence: ['Policy trace'],
    };
    const { triggerAction, triggerCondition } = parseTrigger(policy.trigger);
    const precedentApprovalIds = APPROVALS.filter(
      (approval) => approval.policyRule?.ruleId === policy.policyId,
    ).map((approval) => approval.approvalId);

    return {
      id: policy.policyId,
      title: policy.name,
      family: metadata.family,
      owner: metadata.owner,
      reviewCadence: metadata.reviewCadence,
      environment: 'Workspace default / production posture',
      systems: Array.from(new Set(policy.blastRadius.map((entry) => entry.system))),
      sensitivity: metadata.sensitivity,
      persistence: metadata.persistence,
      blastRadius: policy.blastRadius.map((entry) => entry.scope).join(', '),
      tier: policy.tier,
      roles: [...(policy.sodRule?.rolesRequired ?? ['operator'])],
      evidence: metadata.evidence,
      triggerAction,
      triggerCondition,
      policyId: policy.policyId,
      rationale: policy.description,
      precedentApprovalIds,
    };
  });
}

function createDraftState(slice: PolicySlice): DraftState {
  return {
    tier: slice.tier,
    evidence: [...slice.evidence],
    rationale: '',
  };
}

function createDraftStateFromSearch(slice: PolicySlice, search: PolicyStudioSearch): DraftState {
  return {
    tier: search.draftTier ?? slice.tier,
    evidence: parseDelimitedSearchList(search.draftEvidence) ?? [...slice.evidence],
    rationale: search.draftRationale ?? '',
  };
}

function areListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function buildPolicyStudioSearchState({
  defaultSliceId,
  defaultPrecedentId,
  selectedSliceId,
  selectedPrecedentId,
  selectedScenarioId,
  selectedSlice,
  draft,
}: {
  defaultSliceId: string;
  defaultPrecedentId: string;
  selectedSliceId: string;
  selectedPrecedentId: string;
  selectedScenarioId: string;
  selectedSlice: PolicySlice;
  draft: DraftState;
}): PolicyStudioSearch {
  return {
    slice: selectedSliceId === defaultSliceId ? undefined : selectedSliceId,
    precedent: selectedPrecedentId === defaultPrecedentId ? undefined : selectedPrecedentId,
    scenario: selectedScenarioId || undefined,
    draftTier: draft.tier === selectedSlice.tier ? undefined : draft.tier,
    draftEvidence: areListsEqual(draft.evidence, selectedSlice.evidence)
      ? undefined
      : serializeDelimitedSearchList(draft.evidence),
    draftRationale: draft.rationale.trim() ? draft.rationale : undefined,
  };
}

function getPlatformDoctrine(slice: PolicySlice): string {
  if (slice.tier === 'ManualOnly') {
    return 'Platform doctrine does not allow this action family to run below a manual control path.';
  }

  if (slice.tier === 'Auto') {
    return 'Platform doctrine allows this internal-only capability to stay below the approval queue unless a higher layer tightens it.';
  }

  return 'Platform doctrine allows delegated execution, but the human-visible gate remains the workspace safety boundary.';
}

function getDraftOutcome(currentTier: ExecutionTier, draftTier: ExecutionTier): string {
  if (currentTier === draftTier) {
    return 'No routing change';
  }

  if (TIER_RANK[draftTier] > TIER_RANK[currentTier]) {
    return draftTier === 'ManualOnly'
      ? 'Would move into a manual-only control path'
      : 'Would tighten and add more review friction';
  }

  return draftTier === 'Auto'
    ? 'Would resolve without a human gate'
    : 'Would relax into a lower-friction review path';
}

function getUniqueEvidence(
  slice: PolicySlice,
  draft: DraftState,
  precedent?: RuntimePrecedent | null,
): string[] {
  const combined = new Set([...DEFAULT_EVIDENCE_OPTIONS, ...slice.evidence, ...draft.evidence]);
  if (precedent) {
    for (const item of precedent.recommendedEvidence) combined.add(item);
  }
  return Array.from(combined);
}

function StatCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardDescription className="text-xs uppercase tracking-[0.18em]">{title}</CardDescription>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

export function PolicyStudioPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/config/policies' }) as PolicyStudioSearch;
  const slices = useMemo(() => buildPolicySlices(), []);
  const defaultSlice = slices[0];
  const defaultPrecedent = RUNTIME_PRECEDENTS[0];

  if (!defaultSlice || !defaultPrecedent) {
    return null;
  }

  const selectedSliceId = search.slice ?? defaultSlice.id;
  const selectedPrecedentId = search.precedent ?? defaultPrecedent.id;
  const selectedSlice = slices.find((slice) => slice.id === selectedSliceId) ?? defaultSlice;
  const selectedPrecedent =
    RUNTIME_PRECEDENTS.find((precedent) => precedent.id === selectedPrecedentId) ??
    defaultPrecedent;
  const draft = createDraftStateFromSearch(selectedSlice, search);
  const selectedScenarioId = search.scenario ?? '';

  const matchingApprovals = useMemo(
    () =>
      APPROVALS.filter(
        (approval) =>
          approval.status === 'Pending' && approval.policyRule?.ruleId === selectedSlice?.policyId,
      ),
    [selectedSlice],
  );

  const selectedScenario =
    matchingApprovals.find((approval) => approval.approvalId === selectedScenarioId) ??
    matchingApprovals[0] ??
    null;
  const triageTargetApproval = selectedScenario ?? null;

  const tierCounts = useMemo(() => {
    return slices.reduce<Record<ExecutionTier, number>>(
      (acc, slice) => {
        acc[slice.tier] += 1;
        return acc;
      },
      {
        Auto: 0,
        Assisted: 0,
        HumanApprove: 0,
        ManualOnly: 0,
      },
    );
  }, [slices]);

  const pendingPrecedentCount = APPROVALS.filter(
    (approval) => approval.status === 'Pending',
  ).length;
  const noisySliceCount = slices.filter((slice) => slice.precedentApprovalIds.length > 0).length;
  const simulationReadyCount = slices.filter(
    (slice) => slice.precedentApprovalIds.length > 0,
  ).length;

  const evidenceOptions = getUniqueEvidence(selectedSlice, draft, selectedPrecedent);
  const previewForm: PolicyPreviewFormState = {
    triggerAction: selectedSlice.triggerAction,
    triggerCondition: selectedSlice.triggerCondition,
    tier: draft.tier,
  };
  const hasDraftChange =
    draft.tier !== selectedSlice.tier ||
    draft.rationale.trim().length > 0 ||
    draft.evidence.join('|') !== selectedSlice.evidence.join('|');

  const writeStudioState = useCallback(
    ({
      nextSliceId = selectedSliceId,
      nextPrecedentId = selectedPrecedentId,
      nextScenarioId = selectedScenarioId,
      nextDraft = draft,
    }: {
      nextSliceId?: string;
      nextPrecedentId?: string;
      nextScenarioId?: string;
      nextDraft?: DraftState;
    }) => {
      const nextSlice = slices.find((slice) => slice.id === nextSliceId) ?? defaultSlice;
      navigate({
        to: '/config/policies',
        search: buildPolicyStudioSearchState({
          defaultSliceId: defaultSlice.id,
          defaultPrecedentId: defaultPrecedent.id,
          selectedSliceId: nextSlice.id,
          selectedPrecedentId: nextPrecedentId,
          selectedScenarioId: nextScenarioId,
          selectedSlice: nextSlice,
          draft: nextDraft,
        }),
        replace: true,
      });
    },
    [
      defaultPrecedent.id,
      defaultSlice,
      draft,
      navigate,
      selectedPrecedentId,
      selectedScenarioId,
      selectedSliceId,
      slices,
    ],
  );

  const currentStudioSearch = buildPolicyStudioSearchState({
    defaultSliceId: defaultSlice.id,
    defaultPrecedentId: defaultPrecedent.id,
    selectedSliceId: selectedSlice.id,
    selectedPrecedentId,
    selectedScenarioId,
    selectedSlice,
    draft,
  });
  const approvalReturnSearch = toApprovalReturnSearch(currentStudioSearch);

  function handleSelectSlice(sliceId: string) {
    const next = slices.find((slice) => slice.id === sliceId);
    if (!next) return;
    writeStudioState({
      nextSliceId: next.id,
      nextScenarioId: '',
      nextDraft: createDraftState(next),
    });
  }

  function handleToggleEvidence(evidence: string) {
    writeStudioState({
      nextDraft: {
        ...draft,
        evidence: draft.evidence.includes(evidence)
          ? draft.evidence.filter((item) => item !== evidence)
          : [...draft.evidence, evidence],
      },
    });
  }

  function handleApplyPrecedent(precedent: RuntimePrecedent) {
    const target = slices.find((slice) => slice.policyId === precedent.targetPolicyId);
    if (!target) return;

    writeStudioState({
      nextPrecedentId: precedent.id,
      nextSliceId: target.id,
      nextScenarioId: precedent.approvalId,
      nextDraft: {
        tier: precedent.recommendedTier,
        evidence: Array.from(new Set([...target.evidence, ...precedent.recommendedEvidence])),
        rationale: precedent.feedback,
      },
    });
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Policy Studio"
        description="Layered control, live simulation, and runtime-to-policy conversion for governed agent work."
        icon={<EntityIcon entityType="policy" size="md" decorative />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/config/policies/$policyId" params={{ policyId: selectedSlice.policyId }}>
                Open source rule
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-none">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardDescription className="text-xs uppercase tracking-[0.18em] text-primary">
                Operator loop
              </CardDescription>
              <CardTitle className="text-lg">
                Set posture, replay the outcome, then drop into the live approval card.
              </CardTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Cockpit should read as one governed operator loop: choose the capability default,
                stage the evidence packet, then hand the operator into the exact live approval that
                still needs judgment.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-[11px]">
                {matchingApprovals.length} live case{matchingApprovals.length === 1 ? '' : 's'}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                {hasDraftChange ? 'Draft staged' : 'Draft unchanged'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-background/80 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                1. Choose capability
              </div>
              <div className="mt-2 text-sm font-medium">{selectedSlice.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{selectedSlice.family}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Trigger: {toTitleCase(selectedSlice.triggerAction)}
                {selectedSlice.triggerCondition
                  ? ` when ${toTitleCase(selectedSlice.triggerCondition)}`
                  : ''}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background/80 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                2. Stage doctrine
              </div>
              <div className="mt-2 flex items-center gap-2">
                <ExecutionTierBadge tier={draft.tier} />
                <span className="text-sm font-medium">
                  {getDraftOutcome(selectedSlice.tier, draft.tier)}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Evidence packet: {draft.evidence.length} requirement
                {draft.evidence.length === 1 ? '' : 's'} visible before action.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background/80 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                3. Review live card
              </div>
              {triageTargetApproval ? (
                <>
                  <div className="mt-2 text-sm font-medium">{triageTargetApproval.approvalId}</div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {triageTargetApproval.prompt}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No pending approval currently matches this slice. Use simulation to stage the rule
                  before the next live case appears.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-background/95 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Live handoff
                </div>
                <div className="mt-1 text-base font-medium">Focused triage deck entry point</div>
              </div>
              <Waypoints className="h-4 w-4 text-primary" />
            </div>

            {triageTargetApproval ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Send the operator straight into the approvals deck with the related case focused,
                  then let them come back here to tighten or relax the rule based on what they
                  learn.
                </p>
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-sm font-medium">{triageTargetApproval.prompt}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">
                      {triageTargetApproval.approvalId}
                    </Badge>
                    {triageTargetApproval.policyRule?.ruleId ? (
                      <Badge variant="secondary" className="text-[11px]">
                        {triageTargetApproval.policyRule.ruleId}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link
                      to="/approvals"
                      search={{
                        demo: true,
                        from: 'policy-studio',
                        focus: triageTargetApproval.approvalId,
                        ...approvalReturnSearch,
                      }}
                    >
                      Open in triage deck
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/approvals/$approvalId"
                      params={{ approvalId: triageTargetApproval.approvalId }}
                    >
                      Open approval detail
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                The handoff panel will activate when a pending approval matches the selected slice.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard
          title="Posture Mix"
          value={`${tierCounts.Auto}/${tierCounts.Assisted}/${tierCounts.HumanApprove}/${tierCounts.ManualOnly}`}
          note="Auto, Assisted, HumanApprove, ManualOnly slices"
          icon={<Layers3 className="h-4 w-4" />}
        />
        <StatCard
          title="Pending Precedents"
          value={String(pendingPrecedentCount)}
          note="Live approvals currently shaping future policy"
          icon={<Waypoints className="h-4 w-4" />}
        />
        <StatCard
          title="Noisy Slices"
          value={String(noisySliceCount)}
          note="Capability slices already generating operator traffic"
          icon={<BrainCircuit className="h-4 w-4" />}
        />
        <StatCard
          title="Simulation Ready"
          value={String(simulationReadyCount)}
          note="Slices with real OpenClaw scenarios behind the draft"
          icon={<Sparkles className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.9fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Capability posture matrix
            </CardTitle>
            <CardDescription>
              Humans set defaults by capability slice, then tighten or relax posture from real
              runtime evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="pb-3 pr-4">Capability slice</th>
                  <th className="pb-3 pr-4">Systems</th>
                  <th className="pb-3 pr-4">Sensitivity</th>
                  <th className="pb-3 pr-4">Persistence</th>
                  <th className="pb-3 pr-4">Tier</th>
                  <th className="pb-3 pr-4">Evidence</th>
                  <th className="pb-3">Runtime noise</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((slice) => {
                  const selected = slice.id === selectedSlice.id;
                  return (
                    <tr
                      key={slice.id}
                      className={cn(
                        'border-t border-border align-top transition-colors',
                        selected ? 'bg-primary/5' : 'hover:bg-muted/40',
                      )}
                    >
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 text-left"
                          onClick={() => handleSelectSlice(slice.id)}
                        >
                          <span className="space-y-1">
                            <span className="block font-medium text-foreground">{slice.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {slice.family}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {toTitleCase(slice.triggerAction)}
                              {slice.triggerCondition
                                ? ` when ${toTitleCase(slice.triggerCondition)}`
                                : ''}
                            </span>
                          </span>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1.5">
                          {slice.systems.map((system) => (
                            <Badge key={system} variant="secondary" className="text-[11px]">
                              {system}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {slice.sensitivity}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {slice.persistence}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <ExecutionTierBadge tier={slice.tier} />
                          {selected && hasDraftChange ? (
                            <Badge variant="outline" className="text-[10px]">
                              Draft staged
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        {slice.evidence.join(', ')}
                      </td>
                      <td className="py-3">
                        <div className="space-y-1 text-xs">
                          <div className="font-medium text-foreground">
                            {slice.precedentApprovalIds.length} linked approval
                            {slice.precedentApprovalIds.length === 1 ? '' : 's'}
                          </div>
                          <div className="text-muted-foreground">{slice.owner}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-none xl:sticky xl:top-6 xl:self-start">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{selectedSlice.title}</CardTitle>
                <CardDescription>{selectedSlice.family}</CardDescription>
              </div>
              <ExecutionTierBadge tier={selectedSlice.tier} />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
              <Badge variant="secondary" className="text-[11px]">
                Owner: {selectedSlice.owner}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                Review: {selectedSlice.reviewCadence}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                Blast radius: {selectedSlice.blastRadius}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">Drafted posture</span>
                <ExecutionTierBadge tier={draft.tier} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {hasDraftChange
                  ? getDraftOutcome(selectedSlice.tier, draft.tier)
                  : 'No draft change staged yet.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="policy-studio-tier">Execution tier</Label>
              <Select
                value={draft.tier}
                onValueChange={(value) =>
                  writeStudioState({
                    nextDraft: { ...draft, tier: value as ExecutionTier },
                  })
                }
              >
                <SelectTrigger id="policy-studio-tier" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXECUTION_TIER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Evidence requirements</Label>
              <div className="grid gap-2">
                {evidenceOptions.map((item) => {
                  const checked = draft.evidence.includes(item);
                  return (
                    <label
                      key={item}
                      className="flex items-start gap-3 rounded-md border border-border p-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggleEvidence(item)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-medium">{item}</span>
                        <span className="block text-xs text-muted-foreground">
                          Visible evidence operators can inspect before action.
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="policy-rationale">Rationale capture</Label>
              <Textarea
                id="policy-rationale"
                value={draft.rationale}
                onChange={(event) =>
                  writeStudioState({
                    nextDraft: { ...draft, rationale: event.target.value },
                  })
                }
                placeholder="Explain why this posture should change, what risk it manages, and how operators should use it."
                className="min-h-24"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Layers3 className="h-4 w-4 text-primary" />
                Layered control system
              </div>
              <div className="space-y-2 text-sm">
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    1. Platform doctrine
                  </div>
                  <p className="mt-1 text-sm">{getPlatformDoctrine(selectedSlice)}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    2. Capability default
                  </div>
                  <p className="mt-1 text-sm">{selectedSlice.rationale}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    3. Conditions
                  </div>
                  <p className="mt-1 text-sm">
                    {selectedSlice.triggerAction}
                    {selectedSlice.triggerCondition ? ` AND ${selectedSlice.triggerCondition}` : ''}
                  </p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    4. Evidence gate
                  </div>
                  <p className="mt-1 text-sm">{draft.evidence.join(', ')}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    5. Decision path
                  </div>
                  <p className="mt-1 text-sm">
                    {draft.tier} routed to {selectedSlice.roles.join(', ')} under{' '}
                    {selectedSlice.environment}.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Simulation lab
            </CardTitle>
            <CardDescription>
              Replay the draft against pending OpenClaw approvals before changing the effective
              rule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="impact" className="space-y-4">
              <TabsList>
                <TabsTrigger value="impact">Live impact</TabsTrigger>
                <TabsTrigger value="scenario">Scenario replay</TabsTrigger>
              </TabsList>
              <TabsContent value="impact">
                <PolicyLivePreview form={previewForm} />
              </TabsContent>
              <TabsContent value="scenario" className="space-y-4">
                {matchingApprovals.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="scenario-select">Replay scenario</Label>
                      <Select
                        value={selectedScenario?.approvalId ?? matchingApprovals[0]!.approvalId}
                        onValueChange={(value) => writeStudioState({ nextScenarioId: value })}
                      >
                        <SelectTrigger id="scenario-select" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {matchingApprovals.map((approval) => (
                            <SelectItem key={approval.approvalId} value={approval.approvalId}>
                              {approval.prompt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedScenario ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-border p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Current outcome
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <ExecutionTierBadge tier={selectedSlice.tier} />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {selectedScenario.status === 'Pending'
                                ? 'Waiting for human review'
                                : selectedScenario.status}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">
                            {selectedScenario.prompt}
                          </p>
                        </div>
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Draft outcome
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <ExecutionTierBadge tier={draft.tier} />
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {getDraftOutcome(selectedSlice.tier, draft.tier)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Evidence packet: {draft.evidence.join(', ')}.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    No pending approvals currently match this capability slice. The draft still
                    stays reviewable via the live impact tab.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Runtime precedent to policy
            </CardTitle>
            <CardDescription>
              Convert approval decisions into reusable posture changes instead of re-solving the
              same case by hand.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {RUNTIME_PRECEDENTS.map((precedent) => {
                const active = precedent.id === selectedPrecedent?.id;
                return (
                  <button
                    key={precedent.id}
                    type="button"
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
                    )}
                    onClick={() => writeStudioState({ nextPrecedentId: precedent.id })}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{precedent.title}</span>
                      <Badge variant={precedent.decisionType === 'relax' ? 'secondary' : 'outline'}>
                        {precedent.decisionType === 'relax'
                          ? 'Loosen'
                          : precedent.decisionType === 'tighten'
                            ? 'Tighten'
                            : 'Doctrine'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{precedent.summary}</p>
                  </button>
                );
              })}
            </div>

            <Separator />

            {selectedPrecedent ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Selected precedent
                  </div>
                  <div className="mt-1 text-base font-medium">{selectedPrecedent.title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedPrecedent.feedback}</p>
                </div>

                <div className="grid gap-2 text-sm">
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Target capability
                    </div>
                    <div className="mt-1">{selectedPrecedent.targetPolicyId}</div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Suggested tier
                    </div>
                    <div className="mt-1">
                      <ExecutionTierBadge tier={selectedPrecedent.recommendedTier} />
                    </div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Suggested evidence
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedPrecedent.recommendedEvidence.map((item) => (
                        <Badge key={item} variant="secondary" className="text-[11px]">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Suggested approvers
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedPrecedent.recommendedRoles.map((role) => (
                        <Badge key={role} variant="secondary" className="text-[11px]">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleApplyPrecedent(selectedPrecedent)}>
                    Apply to draft
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/approvals/$approvalId"
                      params={{ approvalId: selectedPrecedent.approvalId }}
                    >
                      Open approval
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole className="h-4 w-4 text-primary" />
            Operator control checklist
          </CardTitle>
          <CardDescription>
            This prototype keeps the human in a real control loop: doctrine, capability defaults,
            evidence gates, and runtime precedent all stay visible on one surface.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium">Fast triage stays intact</div>
            <p className="mt-2 text-sm text-muted-foreground">
              OpenClaw approvals still flow through the mobile-friendly triage deck; this studio
              turns those decisions into reusable policy instead of a dead-end note.
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium">High-risk actions gain depth</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Manual-only and destructive slices inherit stronger doctrine, extra evidence, and
              clearer authority requirements before any operator can act.
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium">Demo-ready path</div>
            <p className="mt-2 text-sm text-muted-foreground">
              This branch already closes the loop: stage posture here, jump into the focused triage
              card, then come back to convert the decision into reusable policy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

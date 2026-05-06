import type {
  ApprovalSummary,
  EvidenceEntry,
  RunSummary,
  WorkItemSummary,
} from '@portarium/cockpit-types';

type ExecutionTier = RunSummary['executionTier'];

export interface GrowthStudioMetric {
  key: string;
  label: string;
  value: string;
  description: string;
}

export interface GrowthStudioActivity {
  id: string;
  timestampIso: string;
  title: string;
  persona: string;
  tool: string;
  tier: ExecutionTier;
  outcome: ApprovalSummary['status'];
  approval: ApprovalSummary;
  run?: RunSummary;
  workItem?: WorkItemSummary;
  evidence: EvidenceEntry[];
}

export interface GrowthStudioPolicyBreakdown {
  autoApproved: number;
  humanApproved: number;
  denied: number;
  requestChanges: number;
  pending: number;
}

export interface GrowthStudioTierLatency {
  tier: ExecutionTier;
  averageSeconds: number;
  sampleCount: number;
  label: string;
}

export interface GrowthStudioPolicyEffectiveness {
  breakdown: GrowthStudioPolicyBreakdown;
  latencyByTier: GrowthStudioTierLatency[];
  sodTriggerCount: number;
}

export interface GrowthStudioDashboardModel {
  hasGrowthSignals: boolean;
  metrics: GrowthStudioMetric[];
  prospectsResearched: number;
  draftsCreated: number;
  pendingApprovals: number;
  averagePendingWaitSeconds: number;
  actionsExecuted: number;
  conversionRate: number;
  activity: GrowthStudioActivity[];
  policyEffectiveness: GrowthStudioPolicyEffectiveness;
}

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;
const COMPLETED_APPROVAL_STATUSES = new Set<ApprovalSummary['status']>(['Approved', 'Executed']);
const DRAFT_MARKERS = ['draft', 'outbound', 'follow-up', 'sequence', 'email', 'message'];
const GROWTH_MARKERS = [
  'growth',
  '-gs-',
  'prospect',
  'lead',
  'campaign',
  'outbound',
  'inbound',
  'enrichment',
  'retargeting',
  'closed-won',
  'salesforce opportunity',
];

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function includesAny(value: string, markers: readonly string[]): boolean {
  const text = normalize(value);
  return markers.some((marker) => text.includes(marker));
}

function compactText(values: unknown[]): string {
  return values.filter((value): value is string => typeof value === 'string').join(' ');
}

function isExecutionTier(value: string | undefined): value is ExecutionTier {
  return EXECUTION_TIERS.includes(value as ExecutionTier);
}

function tierFor(approval: ApprovalSummary, run?: RunSummary): ExecutionTier {
  if (isExecutionTier(approval.policyRule?.tier)) return approval.policyRule.tier;
  if (isExecutionTier(approval.agentActionProposal?.blastRadiusTier)) {
    return approval.agentActionProposal.blastRadiusTier;
  }
  return run?.executionTier ?? 'HumanApprove';
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m';

  const seconds = Math.round(totalSeconds);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function secondsBetween(startIso: string | undefined, endIso: string | undefined): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return (end - start) / 1000;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function growthTextForWorkItem(item: WorkItemSummary): string {
  return compactText([
    item.workspaceId,
    item.workItemId,
    item.title,
    item.createdByUserId,
    item.ownerUserId,
    ...(item.links?.runIds ?? []),
    ...(item.links?.workflowIds ?? []),
    ...(item.links?.approvalIds ?? []),
    ...(item.links?.externalRefs ?? []).flatMap((ref) => [
      ref.sorName,
      ref.portFamily,
      ref.externalId,
      ref.externalType,
      ref.displayLabel,
    ]),
  ]);
}

function growthTextForRun(run: RunSummary): string {
  return compactText([
    run.workspaceId,
    run.runId,
    run.workflowId,
    run.correlationId,
    run.initiatedByUserId,
    ...(run.agentIds ?? []),
  ]);
}

function growthTextForApproval(approval: ApprovalSummary): string {
  return compactText([
    approval.workspaceId,
    approval.approvalId,
    approval.runId,
    approval.planId,
    approval.workItemId,
    approval.prompt,
    approval.requestedByUserId,
    approval.policyRule?.ruleId,
    approval.policyRule?.trigger,
    approval.agentActionProposal?.agentId,
    approval.agentActionProposal?.toolName,
    approval.agentActionProposal?.rationale,
  ]);
}

function growthTextForEvidence(entry: EvidenceEntry): string {
  return compactText([
    entry.workspaceId,
    entry.evidenceId,
    entry.summary,
    entry.links?.runId,
    entry.links?.workItemId,
    entry.links?.approvalId,
    entry.links?.planId,
    ...(entry.links?.externalRefs ?? []).flatMap((ref) => [
      ref.sorName,
      ref.portFamily,
      ref.externalId,
      ref.externalType,
      ref.displayLabel,
    ]),
  ]);
}

export function isGrowthStudioWorkItem(item: WorkItemSummary): boolean {
  return includesAny(growthTextForWorkItem(item), GROWTH_MARKERS);
}

export function isGrowthStudioRun(run: RunSummary): boolean {
  return includesAny(growthTextForRun(run), GROWTH_MARKERS);
}

export function isGrowthStudioApproval(approval: ApprovalSummary): boolean {
  return includesAny(growthTextForApproval(approval), GROWTH_MARKERS);
}

export function isGrowthStudioEvidence(entry: EvidenceEntry): boolean {
  return includesAny(growthTextForEvidence(entry), GROWTH_MARKERS);
}

function personaFor(approval: ApprovalSummary, run?: RunSummary): string {
  const agentId =
    approval.agentActionProposal?.agentId ?? run?.agentIds?.[0] ?? approval.requestedByUserId;
  if (agentId.includes('003')) return 'ContentCreator';
  if (agentId.includes('002')) return 'Researcher';
  if (agentId.includes('001')) return 'OutreachExecutor';
  if (agentId.includes('growth')) return 'Growth Studio agent';
  return agentId || 'Agent';
}

function actionToolFor(approval: ApprovalSummary): string {
  return (
    approval.agentActionProposal?.toolName ??
    approval.policyRule?.trigger.split(' AND ')[0] ??
    'approval gate'
  );
}

function isDraftSignal(approval: ApprovalSummary, workItem?: WorkItemSummary): boolean {
  return includesAny(
    compactText([
      approval.prompt,
      approval.policyRule?.trigger,
      approval.agentActionProposal?.toolName,
      approval.agentActionProposal?.rationale,
      workItem?.title,
    ]),
    DRAFT_MARKERS,
  );
}

function buildLinkedSets(input: {
  workItems: readonly WorkItemSummary[];
  runs: readonly RunSummary[];
  approvals: readonly ApprovalSummary[];
  evidence: readonly EvidenceEntry[];
}) {
  const workItemIds = new Set(input.workItems.map((item) => item.workItemId));
  const runIds = new Set(input.runs.map((run) => run.runId));
  const approvalIds = new Set(input.approvals.map((approval) => approval.approvalId));
  const evidenceIds = new Set(input.evidence.map((entry) => entry.evidenceId));

  for (const item of input.workItems) {
    item.links?.runIds?.forEach((id) => runIds.add(id));
    item.links?.approvalIds?.forEach((id) => approvalIds.add(id));
    item.links?.evidenceIds?.forEach((id) => evidenceIds.add(id));
  }

  for (const approval of input.approvals) {
    runIds.add(approval.runId);
    if (approval.workItemId) workItemIds.add(approval.workItemId);
  }

  for (const entry of input.evidence) {
    if (entry.links?.runId) runIds.add(entry.links.runId);
    if (entry.links?.workItemId) workItemIds.add(entry.links.workItemId);
    if (entry.links?.approvalId) approvalIds.add(entry.links.approvalId);
  }

  return { workItemIds, runIds, approvalIds, evidenceIds };
}

function statusBreakdown(approvals: readonly ApprovalSummary[]): GrowthStudioPolicyBreakdown {
  return approvals.reduce<GrowthStudioPolicyBreakdown>(
    (breakdown, approval) => {
      if (approval.status === 'Pending') breakdown.pending += 1;
      if (approval.status === 'Denied') breakdown.denied += 1;
      if (approval.status === 'RequestChanges') breakdown.requestChanges += 1;

      if (COMPLETED_APPROVAL_STATUSES.has(approval.status)) {
        const tier = tierFor(approval);
        if (tier === 'Auto') breakdown.autoApproved += 1;
        else breakdown.humanApproved += 1;
      }

      return breakdown;
    },
    { autoApproved: 0, humanApproved: 0, denied: 0, requestChanges: 0, pending: 0 },
  );
}

function latencyByTier(
  approvals: readonly ApprovalSummary[],
  runsById: ReadonlyMap<string, RunSummary>,
): GrowthStudioTierLatency[] {
  const secondsByTier = new Map<ExecutionTier, number[]>();

  for (const approval of approvals) {
    if (!approval.decidedAtIso) continue;
    const tier = tierFor(approval, runsById.get(approval.runId));
    const seconds = secondsBetween(approval.requestedAtIso, approval.decidedAtIso);
    if (seconds <= 0) continue;
    secondsByTier.set(tier, [...(secondsByTier.get(tier) ?? []), seconds]);
  }

  return EXECUTION_TIERS.flatMap((tier) => {
    const samples = secondsByTier.get(tier) ?? [];
    if (samples.length === 0) return [];
    const averageSeconds = average(samples);
    return [
      { tier, averageSeconds, sampleCount: samples.length, label: formatDuration(averageSeconds) },
    ];
  });
}

export function buildGrowthStudioDashboardModel(input: {
  approvals: readonly ApprovalSummary[];
  runs: readonly RunSummary[];
  workItems: readonly WorkItemSummary[];
  evidence?: readonly EvidenceEntry[];
  now?: Date;
}): GrowthStudioDashboardModel {
  const now = input.now ?? new Date();
  const directlyMatched = {
    workItems: input.workItems.filter(isGrowthStudioWorkItem),
    runs: input.runs.filter(isGrowthStudioRun),
    approvals: input.approvals.filter(isGrowthStudioApproval),
    evidence: (input.evidence ?? []).filter(isGrowthStudioEvidence),
  };
  const linkedSets = buildLinkedSets(directlyMatched);

  const workItems = input.workItems.filter(
    (item) =>
      directlyMatched.workItems.includes(item) || linkedSets.workItemIds.has(item.workItemId),
  );
  const runs = input.runs.filter(
    (run) => directlyMatched.runs.includes(run) || linkedSets.runIds.has(run.runId),
  );
  const approvals = input.approvals.filter(
    (approval) =>
      directlyMatched.approvals.includes(approval) ||
      linkedSets.approvalIds.has(approval.approvalId) ||
      linkedSets.runIds.has(approval.runId) ||
      (approval.workItemId ? linkedSets.workItemIds.has(approval.workItemId) : false),
  );
  const evidence = (input.evidence ?? []).filter(
    (entry) =>
      directlyMatched.evidence.includes(entry) ||
      linkedSets.evidenceIds.has(entry.evidenceId) ||
      (entry.links?.runId ? linkedSets.runIds.has(entry.links.runId) : false) ||
      (entry.links?.workItemId ? linkedSets.workItemIds.has(entry.links.workItemId) : false) ||
      (entry.links?.approvalId ? linkedSets.approvalIds.has(entry.links.approvalId) : false),
  );

  const runsById = new Map(runs.map((run) => [run.runId, run]));
  const workItemsById = new Map(workItems.map((item) => [item.workItemId, item]));
  const evidenceByApprovalId = new Map<string, EvidenceEntry[]>();
  for (const entry of evidence) {
    const approvalId = entry.links?.approvalId;
    if (!approvalId) continue;
    evidenceByApprovalId.set(approvalId, [...(evidenceByApprovalId.get(approvalId) ?? []), entry]);
  }

  const pending = approvals.filter((approval) => approval.status === 'Pending');
  const pendingWaitSeconds = pending.map((approval) =>
    secondsBetween(approval.requestedAtIso, now.toISOString()),
  );
  const actionsExecuted = approvals.filter((approval) => approval.status === 'Executed').length;
  const draftsCreated = approvals.filter((approval) =>
    isDraftSignal(
      approval,
      approval.workItemId ? workItemsById.get(approval.workItemId) : undefined,
    ),
  ).length;
  const conversionRate = percentage(actionsExecuted, approvals.length);
  const averagePendingWaitSeconds = average(pendingWaitSeconds);

  const activity = approvals
    .map((approval) => {
      const run = runsById.get(approval.runId);
      const workItem = approval.workItemId ? workItemsById.get(approval.workItemId) : undefined;
      return {
        id: approval.approvalId,
        timestampIso: approval.decidedAtIso ?? approval.requestedAtIso,
        title: approval.prompt,
        persona: personaFor(approval, run),
        tool: actionToolFor(approval),
        tier: tierFor(approval, run),
        outcome: approval.status,
        approval,
        run,
        workItem,
        evidence: evidenceByApprovalId.get(approval.approvalId) ?? [],
      } satisfies GrowthStudioActivity;
    })
    .sort((left, right) => right.timestampIso.localeCompare(left.timestampIso));

  const metrics: GrowthStudioMetric[] = [
    {
      key: 'prospects-researched',
      label: 'Prospects Researched',
      value: String(workItems.length),
      description: `${runs.length} Growth Studio runs linked`,
    },
    {
      key: 'drafts-created',
      label: 'Drafts Created',
      value: String(draftsCreated),
      description: 'Outbound or follow-up approvals',
    },
    {
      key: 'approvals-pending',
      label: 'Approvals Pending',
      value: String(pending.length),
      description: `Avg wait ${formatDuration(averagePendingWaitSeconds)}`,
    },
    {
      key: 'actions-executed',
      label: 'Actions Executed',
      value: String(actionsExecuted),
      description: 'Approved actions completed',
    },
    {
      key: 'conversion-rate',
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      description: 'Executed / proposed actions',
    },
  ];

  return {
    hasGrowthSignals:
      workItems.length > 0 || runs.length > 0 || approvals.length > 0 || evidence.length > 0,
    metrics,
    prospectsResearched: workItems.length,
    draftsCreated,
    pendingApprovals: pending.length,
    averagePendingWaitSeconds,
    actionsExecuted,
    conversionRate,
    activity,
    policyEffectiveness: {
      breakdown: statusBreakdown(approvals),
      latencyByTier: latencyByTier(approvals, runsById),
      sodTriggerCount: approvals.filter((approval) => Boolean(approval.sodEvaluation)).length,
    },
  };
}

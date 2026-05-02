import type {
  ExecutionTier,
  PolicyChangeId as PolicyChangeIdType,
  WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  evaluatePolicyPipeline,
  type ApprovalPipelineInputV1,
  type PolicyEvaluationPipelineResultV1,
  type PolicyPipelineOutcome,
} from './policy-evaluation-pipeline-v1.js';
import type { PolicyV1 } from './policy-v1.js';

export const POLICY_SHADOW_REPLAY_METRIC_NAMES = [
  'approval_count_by_tier',
  'approval_count_by_session',
  'pending_age_ms_p50',
  'pending_age_ms_p95',
  'pending_age_ms_max',
  'resume_latency_ms',
  'blocked_duration_ms',
  'queue_depth_over_time',
  'denial_count',
  'request_changes_count',
  'escalation_count',
  'expiry_count',
  'duplicate_execution_count',
  'evidence_completeness_count',
  'restart_count',
  'successful_resume_count',
] as const;

export type PolicyShadowReplayMetricName = (typeof POLICY_SHADOW_REPLAY_METRIC_NAMES)[number];
export type PolicyShadowReplaySubjectKind = 'Run' | 'Approval' | 'HumanTask';
export type PolicyShadowReplayDecision = 'Allow' | 'NeedsApproval' | 'Deny' | 'Error';

export type PolicyShadowReplaySubjectV1 = Readonly<{
  subjectKind: PolicyShadowReplaySubjectKind;
  subjectId: string;
  runId?: string;
  observedAtIso: string;
  status?: string;
  dueAtIso?: string;
  currentExecutionTier?: ExecutionTier;
  estimatedCostCents?: number;
  policyInput: ApprovalPipelineInputV1;
}>;

export type PolicyShadowReplayOutcomeV1 = Readonly<{
  decision: PolicyShadowReplayDecision;
  executionTier: ExecutionTier;
  policyOutcome: PolicyPipelineOutcome;
  matchedRuleIds: readonly string[];
  explanation: string;
  pipeline: PolicyEvaluationPipelineResultV1;
}>;

export type PolicyShadowReplaySubjectResultV1 = Readonly<{
  subject: PolicyShadowReplaySubjectV1;
  current: PolicyShadowReplayOutcomeV1;
  proposed: PolicyShadowReplayOutcomeV1;
  changes: Readonly<{
    tierChanged: boolean;
    approvalRequirementChanged: boolean;
    blockedChanged: boolean;
    expiryRiskChanged: boolean;
    estimatedCostDeltaCents: number;
  }>;
}>;

export type PolicyShadowReplayReportV1 = Readonly<{
  schemaVersion: 1;
  policyChangeId: PolicyChangeIdType;
  workspaceId: WorkspaceIdType;
  generatedAtIso: string;
  window: Readonly<{ fromIso?: string; toIso: string }>;
  evaluatedSubjectCount: number;
  metrics: Readonly<Record<PolicyShadowReplayMetricName, unknown>>;
  summary: Readonly<{
    tierSelectionChanges: number;
    approvalVolumeDelta: number;
    blockedActionDelta: number;
    expiryRiskDelta: number;
    estimatedCostDeltaCents: number;
  }>;
  results: readonly PolicyShadowReplaySubjectResultV1[];
}>;

export type BuildPolicyShadowReplayReportParams = Readonly<{
  policyChangeId: PolicyChangeIdType;
  workspaceId: WorkspaceIdType;
  currentPolicy: PolicyV1;
  proposedPolicy: PolicyV1;
  subjects: readonly PolicyShadowReplaySubjectV1[];
  generatedAtIso: string;
  fromIso?: string;
}>;

export function buildPolicyShadowReplayReportV1(
  params: BuildPolicyShadowReplayReportParams,
): PolicyShadowReplayReportV1 {
  const results = params.subjects.map((subject) => {
    const current = evaluateSubject(params.currentPolicy, subject, params.generatedAtIso);
    const proposed = evaluateSubject(params.proposedPolicy, subject, params.generatedAtIso);
    return {
      subject,
      current,
      proposed,
      changes: {
        tierChanged: current.executionTier !== proposed.executionTier,
        approvalRequirementChanged:
          requiresApproval(current.decision) !== requiresApproval(proposed.decision),
        blockedChanged: isBlocked(current.decision) !== isBlocked(proposed.decision),
        expiryRiskChanged:
          hasExpiryRisk(subject, current.decision, params.generatedAtIso) !==
          hasExpiryRisk(subject, proposed.decision, params.generatedAtIso),
        estimatedCostDeltaCents:
          costAllowedCents(subject, proposed.decision) -
          costAllowedCents(subject, current.decision),
      },
    } satisfies PolicyShadowReplaySubjectResultV1;
  });

  const currentApprovalCount = results.filter((result) =>
    requiresApproval(result.current.decision),
  ).length;
  const proposedApprovalCount = results.filter((result) =>
    requiresApproval(result.proposed.decision),
  ).length;
  const currentBlockedCount = results.filter((result) => isBlocked(result.current.decision)).length;
  const proposedBlockedCount = results.filter((result) =>
    isBlocked(result.proposed.decision),
  ).length;
  const currentExpiryRisk = results.filter((result) =>
    hasExpiryRisk(result.subject, result.current.decision, params.generatedAtIso),
  ).length;
  const proposedExpiryRisk = results.filter((result) =>
    hasExpiryRisk(result.subject, result.proposed.decision, params.generatedAtIso),
  ).length;

  const metrics = buildMetrics(results, params.generatedAtIso);
  const report: PolicyShadowReplayReportV1 = {
    schemaVersion: 1,
    policyChangeId: params.policyChangeId,
    workspaceId: params.workspaceId,
    generatedAtIso: params.generatedAtIso,
    window: {
      ...(params.fromIso !== undefined ? { fromIso: params.fromIso } : {}),
      toIso: params.generatedAtIso,
    },
    evaluatedSubjectCount: results.length,
    metrics,
    summary: {
      tierSelectionChanges: results.filter((result) => result.changes.tierChanged).length,
      approvalVolumeDelta: proposedApprovalCount - currentApprovalCount,
      blockedActionDelta: proposedBlockedCount - currentBlockedCount,
      expiryRiskDelta: proposedExpiryRisk - currentExpiryRisk,
      estimatedCostDeltaCents: results.reduce(
        (sum, result) => sum + result.changes.estimatedCostDeltaCents,
        0,
      ),
    },
    results,
  };

  return deepFreeze(report);
}

function evaluateSubject(
  policy: PolicyV1,
  subject: PolicyShadowReplaySubjectV1,
  generatedAtIso: string,
): PolicyShadowReplayOutcomeV1 {
  const pipeline = evaluatePolicyPipeline([policy], subject.policyInput, generatedAtIso);
  const decision = toDecision(pipeline.overallOutcome);
  const executionTier = toExecutionTier(pipeline.overallOutcome, subject.currentExecutionTier);
  return {
    decision,
    executionTier,
    policyOutcome: pipeline.overallOutcome,
    matchedRuleIds: matchedRuleIds(pipeline),
    explanation: pipeline.policyResults.map((result) => result.explanation).join(' '),
    pipeline,
  };
}

function toDecision(outcome: PolicyPipelineOutcome): PolicyShadowReplayDecision {
  if (outcome === 'fail') return 'Deny';
  if (outcome === 'needs_human') return 'NeedsApproval';
  if (outcome === 'error') return 'Error';
  return 'Allow';
}

function toExecutionTier(
  outcome: PolicyPipelineOutcome,
  fallbackTier: ExecutionTier | undefined,
): ExecutionTier {
  if (outcome === 'fail') return 'ManualOnly';
  if (outcome === 'needs_human' || outcome === 'error') return 'HumanApprove';
  return fallbackTier ?? 'Auto';
}

function matchedRuleIds(pipeline: PolicyEvaluationPipelineResultV1): readonly string[] {
  return Object.freeze(
    pipeline.policyResults.flatMap((result) =>
      result.ruleTraces.filter((trace) => trace.outcome === 'matched').map((trace) => trace.ruleId),
    ),
  );
}

function buildMetrics(
  results: readonly PolicyShadowReplaySubjectResultV1[],
  generatedAtIso: string,
): Readonly<Record<PolicyShadowReplayMetricName, unknown>> {
  const approvalCountByTier: Record<string, number> = {};
  const approvalCountBySession: Record<string, number> = {};
  const pendingAges = results
    .filter((result) => isQueued(result.subject))
    .map((result) => durationMs(result.subject.observedAtIso, generatedAtIso));
  const blockedDurations = results
    .filter((result) => isBlocked(result.proposed.decision))
    .map((result) => durationMs(result.subject.observedAtIso, generatedAtIso));

  for (const result of results) {
    if (requiresApproval(result.proposed.decision)) {
      increment(approvalCountByTier, result.proposed.executionTier);
      increment(approvalCountBySession, result.subject.runId ?? result.subject.subjectId);
    }
  }

  return {
    approval_count_by_tier: approvalCountByTier,
    approval_count_by_session: approvalCountBySession,
    pending_age_ms_p50: percentile(pendingAges, 50),
    pending_age_ms_p95: percentile(pendingAges, 95),
    pending_age_ms_max: pendingAges.length === 0 ? 0 : Math.max(...pendingAges),
    resume_latency_ms: [],
    blocked_duration_ms: blockedDurations,
    queue_depth_over_time: [
      {
        timestampIso: generatedAtIso,
        depth: results.filter((result) => isQueued(result.subject)).length,
      },
    ],
    denial_count: results.filter((result) => result.proposed.decision === 'Deny').length,
    request_changes_count: results.filter((result) => result.subject.status === 'RequestChanges')
      .length,
    escalation_count: results.filter(
      (result) =>
        result.subject.status === 'escalated' ||
        nonEmptyArray(result.subject.policyInput['escalationChain']),
    ).length,
    expiry_count: results.filter((result) =>
      hasExpiryRisk(result.subject, result.proposed.decision, generatedAtIso),
    ).length,
    duplicate_execution_count: 0,
    evidence_completeness_count: 0,
    restart_count: 0,
    successful_resume_count: 0,
  };
}

function requiresApproval(decision: PolicyShadowReplayDecision): boolean {
  return decision === 'NeedsApproval' || decision === 'Error';
}

function isBlocked(decision: PolicyShadowReplayDecision): boolean {
  return decision === 'Deny';
}

function isQueued(subject: PolicyShadowReplaySubjectV1): boolean {
  return (
    subject.status === 'Pending' ||
    subject.status === 'pending' ||
    subject.status === 'assigned' ||
    subject.status === 'in-progress' ||
    subject.status === 'escalated'
  );
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasExpiryRisk(
  subject: PolicyShadowReplaySubjectV1,
  decision: PolicyShadowReplayDecision,
  generatedAtIso: string,
): boolean {
  if (!requiresApproval(decision)) return false;
  if (subject.dueAtIso === undefined) return false;
  return Date.parse(subject.dueAtIso) <= Date.parse(generatedAtIso);
}

function costAllowedCents(
  subject: PolicyShadowReplaySubjectV1,
  decision: PolicyShadowReplayDecision,
): number {
  if (decision === 'Deny') return 0;
  return subject.estimatedCostCents ?? 0;
}

function durationMs(startIso: string, endIso: string): number {
  return Math.max(0, Date.parse(endIso) - Date.parse(startIso));
}

function percentile(values: readonly number[], percentileRank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

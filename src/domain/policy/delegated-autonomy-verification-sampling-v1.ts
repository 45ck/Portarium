import {
  ActionId,
  EvidenceId,
  RunId,
  WorkspaceId,
  WorkforceQueueId,
  type ActionId as ActionIdType,
  type EvidenceId as EvidenceIdType,
  type ExecutionTier,
  type RunId as RunIdType,
  type WorkspaceId as WorkspaceIdType,
  type WorkforceQueueId as WorkforceQueueIdType,
} from '../primitives/index.js';
import {
  readEnum,
  readInteger,
  readIsoString,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export const VERIFICATION_BLAST_RADIUS_V1 = ['low', 'medium', 'high', 'critical'] as const;
export const VERIFICATION_NOVELTY_V1 = ['routine', 'changed', 'new', 'unclassified'] as const;
export const VERIFICATION_TRACK_RECORD_V1 = ['proven', 'watch', 'degraded', 'unknown'] as const;
export const VERIFICATION_TRIGGERS_V1 = [
  'routine',
  'drift',
  'incident',
  'new-capability-rollout',
  'degraded-provider-posture',
] as const;
export const VERIFICATION_OUTCOMES_V1 = [
  'correct',
  'risky-but-allowed',
  'should-have-escalated',
  'policy-too-strict',
  'evidence-insufficient',
] as const;
export const VERIFICATION_RECOMMENDATION_TARGETS_V1 = [
  'policy-change',
  'runbook-update',
  'prompt-strategy',
  'operator-enablement',
] as const;

export type VerificationBlastRadiusV1 = (typeof VERIFICATION_BLAST_RADIUS_V1)[number];
export type VerificationNoveltyV1 = (typeof VERIFICATION_NOVELTY_V1)[number];
export type VerificationTrackRecordV1 = (typeof VERIFICATION_TRACK_RECORD_V1)[number];
export type VerificationTriggerV1 = (typeof VERIFICATION_TRIGGERS_V1)[number];
export type VerificationOutcomeV1 = (typeof VERIFICATION_OUTCOMES_V1)[number];
export type VerificationRecommendationTargetV1 =
  (typeof VERIFICATION_RECOMMENDATION_TARGETS_V1)[number];

export type VerificationActionClassScopeV1 =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'exact'; actionClass: string }>
  | Readonly<{ kind: 'prefix'; prefix: string }>;

export type VerificationAuditQueueTargetV1 =
  | Readonly<{ kind: 'audit-review' }>
  | Readonly<{ kind: 'policy-owner-review' }>
  | Readonly<{ kind: 'workforce-queue'; workforceQueueId: WorkforceQueueIdType }>;

export type VerificationSamplingTriggerControlV1 = Readonly<{
  trigger: VerificationTriggerV1;
  multiplierPercent: number;
  rationale: string;
}>;

export type VerificationSamplingRuleV1 = Readonly<{
  schemaVersion: 1;
  ruleId: string;
  actionClassScope: VerificationActionClassScopeV1;
  executionTiers?: readonly ExecutionTier[];
  minBlastRadius?: VerificationBlastRadiusV1;
  novelty?: readonly VerificationNoveltyV1[];
  trackRecord?: readonly VerificationTrackRecordV1[];
  baselinePercent: number;
  triggerControls: readonly VerificationSamplingTriggerControlV1[];
  queueTarget: VerificationAuditQueueTargetV1;
  evidenceExpectations: readonly string[];
  rationale: string;
}>;

export type CompletedVerificationSubjectV1 = Readonly<{
  workspaceId: WorkspaceIdType;
  completedAtIso: string;
  actionClass: string;
  executionTier: ExecutionTier;
  blastRadius: VerificationBlastRadiusV1;
  novelty: VerificationNoveltyV1;
  trackRecord: VerificationTrackRecordV1;
  sampleKey: string;
  runId?: RunIdType;
  actionId?: ActionIdType;
  activeTriggers: readonly VerificationTriggerV1[];
}>;

export type VerificationSamplingDecisionV1 = Readonly<{
  schemaVersion: 1;
  subject: CompletedVerificationSubjectV1;
  evaluatedAtIso: string;
  ruleId: string;
  sampleRatePercent: number;
  sampled: boolean;
  reasonCodes: readonly string[];
  queueItem?: VerificationAuditQueueItemV1;
}>;

export type VerificationAuditQueueItemV1 = Readonly<{
  schemaVersion: 1;
  queueItemId: string;
  workspaceId: WorkspaceIdType;
  queuedAtIso: string;
  queueTarget: VerificationAuditQueueTargetV1;
  runId?: RunIdType;
  actionId?: ActionIdType;
  actionClass: string;
  executionTier: ExecutionTier;
  evidenceExpectations: readonly string[];
  status: 'queued';
}>;

export type VerificationAuditFindingV1 = Readonly<{
  schemaVersion: 1;
  findingId: string;
  queueItemId: string;
  workspaceId: WorkspaceIdType;
  reviewedAtIso: string;
  outcome: VerificationOutcomeV1;
  actionClass: string;
  executionTier: ExecutionTier;
  evidenceIds: readonly EvidenceIdType[];
  summary: string;
}>;

export type VerificationFindingRouteV1 = Readonly<{
  schemaVersion: 1;
  findingId: string;
  outcome: VerificationOutcomeV1;
  targets: readonly VerificationRecommendationTargetV1[];
  severity: 'none' | 'low' | 'medium' | 'high';
  rationale: string;
}>;

export type VerificationCoverageObservationV1 = Readonly<{
  actionClass: string;
  executionTier: ExecutionTier;
  completedCount: number;
  sampledCount: number;
  defectFindingCount: number;
}>;

export type VerificationCoverageSummaryV1 = Readonly<{
  schemaVersion: 1;
  actionClass: string;
  executionTier: ExecutionTier;
  completedCount: number;
  sampledCount: number;
  samplingCoveragePercent: number;
  defectRatePercent: number;
  confidence: 'insufficient-data' | 'high' | 'watch' | 'low';
}>;

export class VerificationSamplingParseError extends Error {
  public override readonly name = 'VerificationSamplingParseError';

  public constructor(message: string) {
    super(message);
  }
}

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;
const BLAST_RANK: Readonly<Record<VerificationBlastRadiusV1, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
const DEFAULT_RULE: VerificationSamplingRuleV1 = {
  schemaVersion: 1,
  ruleId: 'platform-default-verification-sampling',
  actionClassScope: { kind: 'all' },
  baselinePercent: 10,
  triggerControls: [
    {
      trigger: 'drift',
      multiplierPercent: 300,
      rationale: 'Capability drift requires increased post-action review.',
    },
    {
      trigger: 'incident',
      multiplierPercent: 500,
      rationale: 'Incidents require increased post-action review.',
    },
    {
      trigger: 'new-capability-rollout',
      multiplierPercent: 400,
      rationale: 'New capability rollout starts with higher sampling.',
    },
    {
      trigger: 'degraded-provider-posture',
      multiplierPercent: 300,
      rationale: 'Provider degradation increases silent-failure risk.',
    },
  ],
  queueTarget: { kind: 'audit-review' },
  evidenceExpectations: ['completed Action or Run evidence', 'Policy decision', 'verified effects'],
  rationale: 'Default delegated-autonomy verification sampling for completed work.',
};

export function evaluateVerificationSamplingV1(params: {
  subject: CompletedVerificationSubjectV1;
  rules: readonly VerificationSamplingRuleV1[];
  evaluatedAtIso: string;
}): VerificationSamplingDecisionV1 {
  const subject = validateCompletedVerificationSubjectV1(params.subject);
  const rule = selectSamplingRule(subject, [
    ...params.rules.map(validateVerificationSamplingRuleV1),
    DEFAULT_RULE,
  ]);
  const sampleRatePercent = computeSamplingRatePercent(rule, subject.activeTriggers);
  const sampled = stableBucket(subject.sampleKey) < sampleRatePercent * 100;
  const reasonCodes = samplingReasonCodes(rule, subject.activeTriggers, sampleRatePercent);

  return {
    schemaVersion: 1,
    subject,
    evaluatedAtIso: readIsoString(
      { evaluatedAtIso: params.evaluatedAtIso },
      'evaluatedAtIso',
      VerificationSamplingParseError,
    ),
    ruleId: rule.ruleId,
    sampleRatePercent,
    sampled,
    reasonCodes,
    ...(sampled
      ? {
          queueItem: {
            schemaVersion: 1,
            queueItemId: `verify:${subject.workspaceId}:${subject.sampleKey}`,
            workspaceId: subject.workspaceId,
            queuedAtIso: params.evaluatedAtIso,
            queueTarget: rule.queueTarget,
            ...(subject.runId !== undefined ? { runId: subject.runId } : {}),
            ...(subject.actionId !== undefined ? { actionId: subject.actionId } : {}),
            actionClass: subject.actionClass,
            executionTier: subject.executionTier,
            evidenceExpectations: rule.evidenceExpectations,
            status: 'queued',
          },
        }
      : {}),
  };
}

export function routeVerificationAuditFindingV1(
  finding: VerificationAuditFindingV1,
): VerificationFindingRouteV1 {
  const parsed = validateVerificationAuditFindingV1(finding);
  const route = routeByOutcome(parsed.outcome);
  return {
    schemaVersion: 1,
    findingId: parsed.findingId,
    outcome: parsed.outcome,
    targets: route.targets,
    severity: route.severity,
    rationale: route.rationale,
  };
}

export function summarizeVerificationCoverageV1(
  observations: readonly VerificationCoverageObservationV1[],
): readonly VerificationCoverageSummaryV1[] {
  const groups = new Map<string, VerificationCoverageObservationV1[]>();
  for (const observation of observations) {
    const key = `${observation.actionClass}\u0000${observation.executionTier}`;
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }

  return [...groups.entries()]
    .map(([, items]) => {
      const first = items[0];
      if (first === undefined) {
        throw new VerificationSamplingParseError('Coverage group must not be empty.');
      }
      const completedCount = sum(items, 'completedCount');
      const sampledCount = sum(items, 'sampledCount');
      const defectFindingCount = sum(items, 'defectFindingCount');
      const samplingCoveragePercent = percent(sampledCount, completedCount);
      const defectRatePercent = percent(defectFindingCount, sampledCount);
      const summary: VerificationCoverageSummaryV1 = {
        schemaVersion: 1,
        actionClass: first.actionClass,
        executionTier: first.executionTier,
        completedCount,
        sampledCount,
        samplingCoveragePercent,
        defectRatePercent,
        confidence: deriveConfidence(completedCount, sampledCount, defectRatePercent),
      };
      return summary;
    })
    .sort(
      (left, right) =>
        left.actionClass.localeCompare(right.actionClass) ||
        left.executionTier.localeCompare(right.executionTier),
    );
}

export function parseVerificationSamplingRuleV1(value: unknown): VerificationSamplingRuleV1 {
  const record = readRecord(value, 'VerificationSamplingRule', VerificationSamplingParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', VerificationSamplingParseError);
  if (schemaVersion !== 1) {
    throw new VerificationSamplingParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }
  const executionTiers = parseOptionalEnums(record, 'executionTiers', EXECUTION_TIERS);
  const minBlastRadius = readOptionalEnumField(
    record,
    'minBlastRadius',
    VERIFICATION_BLAST_RADIUS_V1,
  );
  const novelty = parseOptionalEnums(record, 'novelty', VERIFICATION_NOVELTY_V1);
  const trackRecord = parseOptionalEnums(record, 'trackRecord', VERIFICATION_TRACK_RECORD_V1);

  return validateVerificationSamplingRuleV1({
    schemaVersion: 1,
    ruleId: readString(record, 'ruleId', VerificationSamplingParseError),
    actionClassScope: parseActionClassScope(record['actionClassScope']),
    ...(executionTiers !== undefined ? { executionTiers } : {}),
    ...(minBlastRadius !== undefined ? { minBlastRadius } : {}),
    ...(novelty !== undefined ? { novelty } : {}),
    ...(trackRecord !== undefined ? { trackRecord } : {}),
    baselinePercent: readPercent(record, 'baselinePercent'),
    triggerControls: parseTriggerControls(record['triggerControls']),
    queueTarget: parseQueueTarget(record['queueTarget']),
    evidenceExpectations: readOptionalStringArray(
      record,
      'evidenceExpectations',
      VerificationSamplingParseError,
      { minLength: 1 },
    ) ?? ['completed Action or Run evidence'],
    rationale: readString(record, 'rationale', VerificationSamplingParseError),
  });
}

export function validateVerificationSamplingRuleV1(
  rule: VerificationSamplingRuleV1,
): VerificationSamplingRuleV1 {
  assertNonEmpty(rule.ruleId, 'ruleId');
  assertNonEmpty(rule.rationale, 'rationale');
  if (rule.baselinePercent < 0 || rule.baselinePercent > 100) {
    throw new VerificationSamplingParseError('baselinePercent must be between 0 and 100.');
  }
  if (rule.evidenceExpectations.length === 0) {
    throw new VerificationSamplingParseError('evidenceExpectations must not be empty.');
  }
  for (const control of rule.triggerControls) {
    if (control.multiplierPercent < 100) {
      throw new VerificationSamplingParseError('trigger multiplierPercent must be at least 100.');
    }
  }
  return rule;
}

export function validateCompletedVerificationSubjectV1(
  subject: CompletedVerificationSubjectV1,
): CompletedVerificationSubjectV1 {
  assertNonEmpty(subject.actionClass, 'actionClass');
  assertNonEmpty(subject.sampleKey, 'sampleKey');
  readIsoString(
    { completedAtIso: subject.completedAtIso },
    'completedAtIso',
    VerificationSamplingParseError,
  );
  return subject;
}

export function validateVerificationAuditFindingV1(
  finding: VerificationAuditFindingV1,
): VerificationAuditFindingV1 {
  assertNonEmpty(finding.findingId, 'findingId');
  assertNonEmpty(finding.queueItemId, 'queueItemId');
  assertNonEmpty(finding.actionClass, 'actionClass');
  assertNonEmpty(finding.summary, 'summary');
  readIsoString(
    { reviewedAtIso: finding.reviewedAtIso },
    'reviewedAtIso',
    VerificationSamplingParseError,
  );
  return finding;
}

function selectSamplingRule(
  subject: CompletedVerificationSubjectV1,
  rules: readonly VerificationSamplingRuleV1[],
): VerificationSamplingRuleV1 {
  const applicable = rules
    .filter((rule) => actionClassMatches(rule.actionClassScope, subject.actionClass))
    .filter(
      (rule) =>
        rule.executionTiers === undefined || rule.executionTiers.includes(subject.executionTier),
    )
    .filter(
      (rule) =>
        rule.minBlastRadius === undefined ||
        BLAST_RANK[subject.blastRadius] >= BLAST_RANK[rule.minBlastRadius],
    )
    .filter((rule) => rule.novelty === undefined || rule.novelty.includes(subject.novelty))
    .filter(
      (rule) => rule.trackRecord === undefined || rule.trackRecord.includes(subject.trackRecord),
    )
    .map((rule, index) => ({ rule, index }))
    .sort(
      (left, right) =>
        samplingSpecificity(right.rule) - samplingSpecificity(left.rule) ||
        right.rule.baselinePercent - left.rule.baselinePercent ||
        left.index - right.index,
    );
  const rule = applicable[0]?.rule;
  if (rule === undefined) {
    throw new VerificationSamplingParseError('No verification sampling rule matched.');
  }
  return rule;
}

function computeSamplingRatePercent(
  rule: VerificationSamplingRuleV1,
  activeTriggers: readonly VerificationTriggerV1[],
): number {
  const multiplier = Math.max(
    100,
    ...rule.triggerControls
      .filter((control) => activeTriggers.includes(control.trigger))
      .map((control) => control.multiplierPercent),
  );
  return Math.min(100, Math.ceil((rule.baselinePercent * multiplier) / 100));
}

function samplingReasonCodes(
  rule: VerificationSamplingRuleV1,
  activeTriggers: readonly VerificationTriggerV1[],
  sampleRatePercent: number,
): readonly string[] {
  const triggerCodes = rule.triggerControls
    .filter((control) => activeTriggers.includes(control.trigger))
    .map((control) => `trigger:${control.trigger}`);
  return [`rule:${rule.ruleId}`, `rate:${sampleRatePercent}`, ...triggerCodes];
}

function routeByOutcome(outcome: VerificationOutcomeV1): Readonly<{
  targets: readonly VerificationRecommendationTargetV1[];
  severity: VerificationFindingRouteV1['severity'];
  rationale: string;
}> {
  switch (outcome) {
    case 'correct':
      return {
        targets: [],
        severity: 'none',
        rationale: 'Correct sampled work records confidence without creating governance churn.',
      };
    case 'risky-but-allowed':
      return {
        targets: ['policy-change', 'runbook-update'],
        severity: 'medium',
        rationale: 'Allowed but risky work should tighten reusable Policy or runbook guidance.',
      };
    case 'should-have-escalated':
      return {
        targets: ['policy-change', 'operator-enablement'],
        severity: 'high',
        rationale:
          'Missed escalation requires tiering or routing change plus operator calibration.',
      };
    case 'policy-too-strict':
      return {
        targets: ['policy-change', 'runbook-update'],
        severity: 'low',
        rationale: 'Overly strict Policy should be changed through the governed Policy workflow.',
      };
    case 'evidence-insufficient':
      return {
        targets: ['runbook-update', 'prompt-strategy', 'operator-enablement'],
        severity: 'medium',
        rationale: 'Evidence gaps should improve evidence packet assembly and review habits.',
      };
  }
}

function deriveConfidence(
  completedCount: number,
  sampledCount: number,
  defectRatePercent: number,
): VerificationCoverageSummaryV1['confidence'] {
  if (completedCount === 0 || sampledCount < 5) return 'insufficient-data';
  if (defectRatePercent >= 10) return 'low';
  if (defectRatePercent >= 3) return 'watch';
  return 'high';
}

function samplingSpecificity(rule: VerificationSamplingRuleV1): number {
  const actionScore =
    rule.actionClassScope.kind === 'exact' ? 3 : rule.actionClassScope.kind === 'prefix' ? 2 : 0;
  const tierScore = rule.executionTiers === undefined ? 0 : 1;
  const blastScore = rule.minBlastRadius === undefined ? 0 : 1;
  const noveltyScore = rule.novelty === undefined ? 0 : 1;
  const trackRecordScore = rule.trackRecord === undefined ? 0 : 1;
  return actionScore + tierScore + blastScore + noveltyScore + trackRecordScore;
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 10_000;
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function sum(
  values: readonly VerificationCoverageObservationV1[],
  key: 'completedCount' | 'sampledCount' | 'defectFindingCount',
): number {
  return values.reduce((total, value) => total + value[key], 0);
}

function parseActionClassScope(value: unknown): VerificationActionClassScopeV1 {
  const record = readRecord(value, 'actionClassScope', VerificationSamplingParseError);
  const kind = readEnum(
    record,
    'kind',
    ['all', 'exact', 'prefix'] as const,
    VerificationSamplingParseError,
  );
  if (kind === 'all') return { kind };
  if (kind === 'exact') {
    return { kind, actionClass: readString(record, 'actionClass', VerificationSamplingParseError) };
  }
  return { kind, prefix: readString(record, 'prefix', VerificationSamplingParseError) };
}

function parseQueueTarget(value: unknown): VerificationAuditQueueTargetV1 {
  const record = readRecord(value, 'queueTarget', VerificationSamplingParseError);
  const kind = readEnum(
    record,
    'kind',
    ['audit-review', 'policy-owner-review', 'workforce-queue'] as const,
    VerificationSamplingParseError,
  );
  if (kind === 'workforce-queue') {
    return {
      kind,
      workforceQueueId: WorkforceQueueId(
        readString(record, 'workforceQueueId', VerificationSamplingParseError),
      ),
    };
  }
  return { kind };
}

function parseTriggerControls(value: unknown): readonly VerificationSamplingTriggerControlV1[] {
  if (!Array.isArray(value)) {
    throw new VerificationSamplingParseError('triggerControls must be an array.');
  }
  return value.map((item, index) => {
    const record = readRecord(item, `triggerControls[${index}]`, VerificationSamplingParseError);
    return {
      trigger: readEnum(
        record,
        'trigger',
        VERIFICATION_TRIGGERS_V1,
        VerificationSamplingParseError,
      ),
      multiplierPercent: readInteger(record, 'multiplierPercent', VerificationSamplingParseError),
      rationale: readString(record, 'rationale', VerificationSamplingParseError),
    };
  });
}

function parseOptionalEnums<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): readonly T[] | undefined {
  const values = readOptionalStringArray(record, key, VerificationSamplingParseError);
  if (values === undefined) return undefined;
  return values.map((value, index) => {
    if (!allowed.includes(value as T)) {
      throw new VerificationSamplingParseError(
        `${key}[${index}] must be one of: ${allowed.join(', ')}.`,
      );
    }
    return value as T;
  });
}

function readOptionalEnumField<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = readOptionalString(record, key, VerificationSamplingParseError);
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) {
    throw new VerificationSamplingParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function readPercent(record: Record<string, unknown>, key: string): number {
  const value = readInteger(record, key, VerificationSamplingParseError);
  if (value < 0 || value > 100) {
    throw new VerificationSamplingParseError(`${key} must be between 0 and 100.`);
  }
  return value;
}

function actionClassMatches(scope: VerificationActionClassScopeV1, actionClass: string): boolean {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'exact') return actionClass === scope.actionClass;
  return actionClass.startsWith(scope.prefix);
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim() === '') {
    throw new VerificationSamplingParseError(`${label} must be non-empty.`);
  }
}

export function coerceVerificationFindingIdsV1(params: {
  workspaceId: string;
  reviewedAtIso: string;
  findingId: string;
  queueItemId: string;
  actionClass: string;
  executionTier: ExecutionTier;
  outcome: VerificationOutcomeV1;
  evidenceIds: readonly string[];
  summary: string;
}): VerificationAuditFindingV1 {
  return validateVerificationAuditFindingV1({
    schemaVersion: 1,
    workspaceId: WorkspaceId(params.workspaceId),
    reviewedAtIso: params.reviewedAtIso,
    findingId: params.findingId,
    queueItemId: params.queueItemId,
    actionClass: params.actionClass,
    executionTier: params.executionTier,
    outcome: params.outcome,
    evidenceIds: params.evidenceIds.map(EvidenceId),
    summary: params.summary,
  });
}

export function coerceCompletedVerificationSubjectV1(params: {
  workspaceId: string;
  completedAtIso: string;
  actionClass: string;
  executionTier: ExecutionTier;
  blastRadius: VerificationBlastRadiusV1;
  novelty: VerificationNoveltyV1;
  trackRecord: VerificationTrackRecordV1;
  sampleKey: string;
  activeTriggers: readonly VerificationTriggerV1[];
  runId?: string;
  actionId?: string;
}): CompletedVerificationSubjectV1 {
  return validateCompletedVerificationSubjectV1({
    workspaceId: WorkspaceId(params.workspaceId),
    completedAtIso: params.completedAtIso,
    actionClass: params.actionClass,
    executionTier: params.executionTier,
    blastRadius: params.blastRadius,
    novelty: params.novelty,
    trackRecord: params.trackRecord,
    sampleKey: params.sampleKey,
    activeTriggers: params.activeTriggers,
    ...(params.runId !== undefined ? { runId: RunId(params.runId) } : {}),
    ...(params.actionId !== undefined ? { actionId: ActionId(params.actionId) } : {}),
  });
}

import {
  ActionId,
  ApprovalId,
  EvidenceId,
  RunId,
  UserId,
  WorkItemId,
  WorkspaceId,
  WorkforceQueueId,
  type ActionId as ActionIdType,
  type ApprovalId as ApprovalIdType,
  type EvidenceId as EvidenceIdType,
  type ExecutionTier,
  type RunId as RunIdType,
  type UserId as UserIdType,
  type WorkItemId as WorkItemIdType,
  type WorkspaceId as WorkspaceIdType,
  type WorkforceQueueId as WorkforceQueueIdType,
} from '../primitives/index.js';
import {
  parseNonEmptyString,
  readBoolean,
  readEnum,
  readInteger,
  readIsoString,
  readNonNegativeInteger,
  readOptionalBoolean,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export const AUTONOMY_EXCEPTION_CLASSES_V1 = [
  'policy-violation',
  'evidence-gap',
  'anomaly-signal',
  'execution-failure',
  'capability-drift',
  'budget-threshold',
  'approval-fatigue',
  'stale-or-degraded-state',
  'unknown-risk',
] as const;

export const AUTONOMY_EXCEPTION_SEVERITIES_V1 = [
  'info',
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const AUTONOMY_EXCEPTION_NEXT_STEPS_V1 = [
  'observe',
  'annotate',
  'acknowledge-digest',
  'open-work-item',
  'request-more-evidence',
  'pause-run',
  'reroute',
  'escalate',
  'freeze',
  'emergency-disable',
  'draft-policy-change',
] as const;

export type AutonomyExceptionClassV1 = (typeof AUTONOMY_EXCEPTION_CLASSES_V1)[number];
export type AutonomyExceptionSeverityV1 = (typeof AUTONOMY_EXCEPTION_SEVERITIES_V1)[number];
export type AutonomyExceptionHandlingV1 = 'calm' | 'alert';
export type AutonomyExceptionNextStepV1 = (typeof AUTONOMY_EXCEPTION_NEXT_STEPS_V1)[number];
export type AutonomyEvidenceCategoryV1 =
  | 'Plan'
  | 'Action'
  | 'Approval'
  | 'Policy'
  | 'PolicyViolation'
  | 'System';

export type AutonomyExceptionRoutingTargetV1 =
  | Readonly<{ kind: 'weekly-autonomy-digest' }>
  | Readonly<{ kind: 'work-item'; workItemId?: WorkItemIdType }>
  | Readonly<{ kind: 'workforce-queue'; workforceQueueId: WorkforceQueueIdType }>
  | Readonly<{ kind: 'workspace-user'; userId: UserIdType }>
  | Readonly<{ kind: 'approval-gate'; approvalId?: ApprovalIdType }>
  | Readonly<{ kind: 'policy-owner-review' }>
  | Readonly<{ kind: 'audit-review' }>
  | Readonly<{ kind: 'platform-admin' }>;

export type AutonomyActionClassScopeV1 =
  | Readonly<{ kind: 'all' }>
  | Readonly<{ kind: 'exact'; actionClass: string }>
  | Readonly<{ kind: 'prefix'; prefix: string }>;

export type AutonomyEvidenceExpectationV1 = Readonly<{
  requirementId: string;
  label: string;
  category: AutonomyEvidenceCategoryV1;
  required: boolean;
  minimumCount: number;
}>;

export type AutonomyExceptionEvidencePacketV1 = Readonly<{
  packetId: string;
  assembledAtIso: string;
  evidenceIds: readonly EvidenceIdType[];
  consultedEvidenceIds: readonly EvidenceIdType[];
  missingEvidenceSignals: readonly string[];
}>;

export type AutonomyExceptionEvidenceAssessmentV1 = Readonly<{
  status: 'complete' | 'missing-required';
  missingRequiredLabels: readonly string[];
  missingEvidenceSignals: readonly string[];
  canRouteWithoutMoreEvidence: boolean;
}>;

export type AutonomyExceptionSuppressionV1 = Readonly<{
  enabled: boolean;
  windowMinutes: number;
  suppressAlerts: boolean;
  rationale: string;
}>;

export type AutonomyExceptionDeduplicationV1 = Readonly<{
  enabled: boolean;
  windowMinutes: number;
  requireUnresolvedRoute: boolean;
}>;

export type AutonomyExceptionBatchingV1 = Readonly<{
  enabled: boolean;
  batchKey: 'exception-class' | 'action-class' | 'fingerprint';
  maxBatchSize: number;
  flushAfterMinutes: number;
}>;

export type AutonomyExceptionRoutingRuleV1 = Readonly<{
  schemaVersion: 1;
  ruleId: string;
  exceptionClass: AutonomyExceptionClassV1;
  minSeverity: AutonomyExceptionSeverityV1;
  actionClassScope: AutonomyActionClassScopeV1;
  executionTiers?: readonly ExecutionTier[];
  handling: AutonomyExceptionHandlingV1;
  target: AutonomyExceptionRoutingTargetV1;
  suppression?: AutonomyExceptionSuppressionV1;
  deduplication?: AutonomyExceptionDeduplicationV1;
  batching?: AutonomyExceptionBatchingV1;
  evidenceExpectations: readonly AutonomyEvidenceExpectationV1[];
  nextStepOptions: readonly AutonomyExceptionNextStepV1[];
  rationale: string;
}>;

export type AutonomyAnomalyTriggerV1 = Readonly<{
  schemaVersion: 1;
  triggerId: string;
  workspaceId: WorkspaceIdType;
  observedAtIso: string;
  exceptionClass: AutonomyExceptionClassV1;
  severity: AutonomyExceptionSeverityV1;
  fingerprint: string;
  summary: string;
  actionClass?: string;
  executionTier?: ExecutionTier;
  runId?: RunIdType;
  actionId?: ActionIdType;
  approvalId?: ApprovalIdType;
  evidencePacket: AutonomyExceptionEvidencePacketV1;
}>;

export type AutonomyExceptionRoutingHistoryItemV1 = Readonly<{
  triggerId: string;
  workspaceId: WorkspaceIdType;
  routedAtIso: string;
  exceptionClass: AutonomyExceptionClassV1;
  handling: AutonomyExceptionHandlingV1;
  disposition: AutonomyExceptionRoutingDispositionV1;
  fingerprint: string;
  batchKey?: string;
  unresolved: boolean;
}>;

export type AutonomyExceptionRoutingDispositionV1 =
  | 'route-calm'
  | 'route-alert'
  | 'suppressed'
  | 'deduplicated'
  | 'batched';

export type AutonomyExceptionRoutingDecisionV1 = Readonly<{
  schemaVersion: 1;
  triggerId: string;
  workspaceId: WorkspaceIdType;
  evaluatedAtIso: string;
  ruleId: string;
  handling: AutonomyExceptionHandlingV1;
  disposition: AutonomyExceptionRoutingDispositionV1;
  target: AutonomyExceptionRoutingTargetV1;
  evidence: AutonomyExceptionEvidenceAssessmentV1;
  nextStepOptions: readonly AutonomyExceptionNextStepV1[];
  batchKey?: string;
  duplicateOfTriggerId?: string;
  suppressedUntilIso?: string;
  rationale: string;
}>;

export class DelegatedAutonomyExceptionRoutingParseError extends Error {
  public override readonly name = 'DelegatedAutonomyExceptionRoutingParseError';

  public constructor(message: string) {
    super(message);
  }
}

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;
const EVIDENCE_CATEGORIES = [
  'Plan',
  'Action',
  'Approval',
  'Policy',
  'PolicyViolation',
  'System',
] as const;
const TARGET_KINDS = [
  'weekly-autonomy-digest',
  'work-item',
  'workforce-queue',
  'workspace-user',
  'approval-gate',
  'policy-owner-review',
  'audit-review',
  'platform-admin',
] as const;

const SEVERITY_RANK: Readonly<Record<AutonomyExceptionSeverityV1, number>> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const DEFAULT_ALERT_RULE: AutonomyExceptionRoutingRuleV1 = {
  schemaVersion: 1,
  ruleId: 'platform-default-unknown-risk-alert',
  exceptionClass: 'unknown-risk',
  minSeverity: 'info',
  actionClassScope: { kind: 'all' },
  handling: 'alert',
  target: { kind: 'platform-admin' },
  evidenceExpectations: [
    {
      requirementId: 'exception-summary',
      label: 'Exception summary',
      category: 'System',
      required: true,
      minimumCount: 1,
    },
  ],
  nextStepOptions: ['request-more-evidence', 'escalate', 'freeze'],
  rationale: 'Unknown delegated-autonomy exceptions fail closed to alert routing.',
};

export function routeAutonomyAnomalyTriggerV1(params: {
  trigger: AutonomyAnomalyTriggerV1;
  rules: readonly AutonomyExceptionRoutingRuleV1[];
  evaluatedAtIso: string;
  history?: readonly AutonomyExceptionRoutingHistoryItemV1[];
}): AutonomyExceptionRoutingDecisionV1 {
  validateAutonomyAnomalyTriggerV1(params.trigger);
  const rules = params.rules.map(validateAutonomyExceptionRoutingRuleV1);
  const rule = selectRoutingRule(params.trigger, rules);
  const evidence = assessAutonomyExceptionEvidencePacketV1(
    params.trigger.evidencePacket,
    rule.evidenceExpectations,
  );
  const nextStepOptions = deriveNextStepOptions(rule.nextStepOptions, evidence);
  const history = params.history ?? [];
  const batchKey = computeBatchKey(rule, params.trigger);
  const suppressed = findSuppressionMatch({
    rule,
    trigger: params.trigger,
    evaluatedAtIso: params.evaluatedAtIso,
    history,
  });
  if (suppressed !== undefined) {
    return buildDecision({
      trigger: params.trigger,
      evaluatedAtIso: params.evaluatedAtIso,
      rule,
      evidence,
      nextStepOptions,
      disposition: 'suppressed',
      batchKey,
      suppressedUntilIso: suppressed,
      rationale: `Suppressed duplicate ${params.trigger.exceptionClass} signal for ${rule.suppression?.windowMinutes ?? 0} minutes; evidence must still be recorded.`,
    });
  }

  const duplicate = findDeduplicationMatch({
    rule,
    trigger: params.trigger,
    evaluatedAtIso: params.evaluatedAtIso,
    history,
  });
  if (duplicate !== undefined) {
    return buildDecision({
      trigger: params.trigger,
      evaluatedAtIso: params.evaluatedAtIso,
      rule,
      evidence,
      nextStepOptions,
      disposition: 'deduplicated',
      batchKey,
      duplicateOfTriggerId: duplicate.triggerId,
      rationale: `Deduplicated against unresolved route ${duplicate.triggerId}; do not create a second Approval Gate, Work Item, or alert.`,
    });
  }

  if (
    shouldBatch({ rule, trigger: params.trigger, evaluatedAtIso: params.evaluatedAtIso, history })
  ) {
    return buildDecision({
      trigger: params.trigger,
      evaluatedAtIso: params.evaluatedAtIso,
      rule,
      evidence,
      nextStepOptions,
      disposition: 'batched',
      batchKey,
      rationale: `Batched calm ${params.trigger.exceptionClass} signal under ${batchKey}; it should appear in the next calm review packet unless the batch flushes first.`,
    });
  }

  return buildDecision({
    trigger: params.trigger,
    evaluatedAtIso: params.evaluatedAtIso,
    rule,
    evidence,
    nextStepOptions,
    disposition: rule.handling === 'alert' ? 'route-alert' : 'route-calm',
    batchKey,
    rationale:
      rule.handling === 'alert'
        ? `Alert route selected by ${rule.ruleId}; interrupt the target authority with an evidence packet.`
        : `Calm route selected by ${rule.ruleId}; preserve operations while creating reviewable context.`,
  });
}

export function assessAutonomyExceptionEvidencePacketV1(
  packet: AutonomyExceptionEvidencePacketV1,
  expectations: readonly AutonomyEvidenceExpectationV1[],
): AutonomyExceptionEvidenceAssessmentV1 {
  validateEvidencePacket(packet);
  const missingRequiredLabels = expectations
    .filter((expectation) => expectation.required)
    .filter((expectation) => packet.evidenceIds.length < expectation.minimumCount)
    .map((expectation) => expectation.label);
  const missingEvidenceSignals = [...packet.missingEvidenceSignals];
  const status =
    missingRequiredLabels.length > 0 || missingEvidenceSignals.length > 0
      ? 'missing-required'
      : 'complete';

  return {
    status,
    missingRequiredLabels,
    missingEvidenceSignals,
    canRouteWithoutMoreEvidence: status === 'complete',
  };
}

export function parseAutonomyExceptionRoutingRuleV1(
  value: unknown,
): AutonomyExceptionRoutingRuleV1 {
  const record = readRecord(
    value,
    'AutonomyExceptionRoutingRule',
    DelegatedAutonomyExceptionRoutingParseError,
  );
  const schemaVersion = readInteger(
    record,
    'schemaVersion',
    DelegatedAutonomyExceptionRoutingParseError,
  );
  if (schemaVersion !== 1) {
    throw new DelegatedAutonomyExceptionRoutingParseError(
      `Unsupported schemaVersion: ${schemaVersion}`,
    );
  }

  const executionTiers = readOptionalStringArray(
    record,
    'executionTiers',
    DelegatedAutonomyExceptionRoutingParseError,
  )?.map((tier) => {
    if (!EXECUTION_TIERS.includes(tier as ExecutionTier)) {
      throw new DelegatedAutonomyExceptionRoutingParseError(
        `executionTiers must contain only: ${EXECUTION_TIERS.join(', ')}.`,
      );
    }
    return tier as ExecutionTier;
  });
  const suppression = parseOptionalSuppression(record['suppression']);
  const deduplication = parseOptionalDeduplication(record['deduplication']);
  const batching = parseOptionalBatching(record['batching']);
  const rule: AutonomyExceptionRoutingRuleV1 = {
    schemaVersion: 1,
    ruleId: readString(record, 'ruleId', DelegatedAutonomyExceptionRoutingParseError),
    exceptionClass: readEnum(
      record,
      'exceptionClass',
      AUTONOMY_EXCEPTION_CLASSES_V1,
      DelegatedAutonomyExceptionRoutingParseError,
    ),
    minSeverity: readEnum(
      record,
      'minSeverity',
      AUTONOMY_EXCEPTION_SEVERITIES_V1,
      DelegatedAutonomyExceptionRoutingParseError,
    ),
    actionClassScope: parseActionClassScope(record['actionClassScope']),
    ...(executionTiers !== undefined ? { executionTiers } : {}),
    handling: readEnum(
      record,
      'handling',
      ['calm', 'alert'] as const,
      DelegatedAutonomyExceptionRoutingParseError,
    ),
    target: parseRoutingTarget(record['target']),
    ...(suppression !== undefined ? { suppression } : {}),
    ...(deduplication !== undefined ? { deduplication } : {}),
    ...(batching !== undefined ? { batching } : {}),
    evidenceExpectations: parseEvidenceExpectations(record['evidenceExpectations']),
    nextStepOptions: parseNextStepOptions(record['nextStepOptions']),
    rationale: readString(record, 'rationale', DelegatedAutonomyExceptionRoutingParseError),
  };

  return validateAutonomyExceptionRoutingRuleV1(rule);
}

export function parseAutonomyAnomalyTriggerV1(value: unknown): AutonomyAnomalyTriggerV1 {
  const record = readRecord(
    value,
    'AutonomyAnomalyTrigger',
    DelegatedAutonomyExceptionRoutingParseError,
  );
  const schemaVersion = readInteger(
    record,
    'schemaVersion',
    DelegatedAutonomyExceptionRoutingParseError,
  );
  if (schemaVersion !== 1) {
    throw new DelegatedAutonomyExceptionRoutingParseError(
      `Unsupported schemaVersion: ${schemaVersion}`,
    );
  }

  const actionClass = readOptionalString(
    record,
    'actionClass',
    DelegatedAutonomyExceptionRoutingParseError,
  );
  const executionTier = readOptionalString(
    record,
    'executionTier',
    DelegatedAutonomyExceptionRoutingParseError,
  );
  if (executionTier !== undefined && !EXECUTION_TIERS.includes(executionTier as ExecutionTier)) {
    throw new DelegatedAutonomyExceptionRoutingParseError(
      `executionTier must be one of: ${EXECUTION_TIERS.join(', ')}.`,
    );
  }
  const runId = readOptionalString(record, 'runId', DelegatedAutonomyExceptionRoutingParseError);
  const actionId = readOptionalString(
    record,
    'actionId',
    DelegatedAutonomyExceptionRoutingParseError,
  );
  const approvalId = readOptionalString(
    record,
    'approvalId',
    DelegatedAutonomyExceptionRoutingParseError,
  );

  return validateAutonomyAnomalyTriggerV1({
    schemaVersion: 1,
    triggerId: readString(record, 'triggerId', DelegatedAutonomyExceptionRoutingParseError),
    workspaceId: WorkspaceId(
      readString(record, 'workspaceId', DelegatedAutonomyExceptionRoutingParseError),
    ),
    observedAtIso: readIsoString(
      record,
      'observedAtIso',
      DelegatedAutonomyExceptionRoutingParseError,
    ),
    exceptionClass: readEnum(
      record,
      'exceptionClass',
      AUTONOMY_EXCEPTION_CLASSES_V1,
      DelegatedAutonomyExceptionRoutingParseError,
    ),
    severity: readEnum(
      record,
      'severity',
      AUTONOMY_EXCEPTION_SEVERITIES_V1,
      DelegatedAutonomyExceptionRoutingParseError,
    ),
    fingerprint: readString(record, 'fingerprint', DelegatedAutonomyExceptionRoutingParseError),
    summary: readString(record, 'summary', DelegatedAutonomyExceptionRoutingParseError),
    ...(actionClass !== undefined ? { actionClass } : {}),
    ...(executionTier !== undefined ? { executionTier: executionTier as ExecutionTier } : {}),
    ...(runId !== undefined ? { runId: RunId(runId) } : {}),
    ...(actionId !== undefined ? { actionId: ActionId(actionId) } : {}),
    ...(approvalId !== undefined ? { approvalId: ApprovalId(approvalId) } : {}),
    evidencePacket: parseEvidencePacket(record['evidencePacket']),
  });
}

export function validateAutonomyExceptionRoutingRuleV1(
  rule: AutonomyExceptionRoutingRuleV1,
): AutonomyExceptionRoutingRuleV1 {
  assertNonEmpty(rule.ruleId, 'ruleId');
  assertNonEmpty(rule.rationale, 'rationale');
  if (rule.evidenceExpectations.length === 0) {
    throw new DelegatedAutonomyExceptionRoutingParseError(
      'evidenceExpectations must not be empty.',
    );
  }
  if (rule.nextStepOptions.length === 0) {
    throw new DelegatedAutonomyExceptionRoutingParseError('nextStepOptions must not be empty.');
  }
  assertTargetCompatible(rule.handling, rule.target);
  if (rule.handling === 'alert' && rule.batching?.enabled === true) {
    throw new DelegatedAutonomyExceptionRoutingParseError(
      'Alert routes cannot enable batching; they must route immediately or deduplicate.',
    );
  }
  return rule;
}

export function validateAutonomyAnomalyTriggerV1(
  trigger: AutonomyAnomalyTriggerV1,
): AutonomyAnomalyTriggerV1 {
  assertNonEmpty(trigger.triggerId, 'triggerId');
  assertNonEmpty(trigger.fingerprint, 'fingerprint');
  assertNonEmpty(trigger.summary, 'summary');
  if (trigger.actionClass !== undefined) assertNonEmpty(trigger.actionClass, 'actionClass');
  readIsoString(
    { observedAtIso: trigger.observedAtIso },
    'observedAtIso',
    DelegatedAutonomyExceptionRoutingParseError,
  );
  validateEvidencePacket(trigger.evidencePacket);
  return trigger;
}

function selectRoutingRule(
  trigger: AutonomyAnomalyTriggerV1,
  rules: readonly AutonomyExceptionRoutingRuleV1[],
): AutonomyExceptionRoutingRuleV1 {
  const applicable = rules
    .filter((rule) => rule.exceptionClass === trigger.exceptionClass)
    .filter((rule) => severityMatches(trigger.severity, rule.minSeverity))
    .filter((rule) => actionClassMatches(rule.actionClassScope, trigger.actionClass))
    .filter(
      (rule) =>
        rule.executionTiers === undefined ||
        (trigger.executionTier !== undefined &&
          rule.executionTiers.includes(trigger.executionTier)),
    )
    .map((rule, index) => ({ rule, index }))
    .sort(
      (left, right) =>
        routingRuleSpecificity(right.rule) - routingRuleSpecificity(left.rule) ||
        SEVERITY_RANK[right.rule.minSeverity] - SEVERITY_RANK[left.rule.minSeverity] ||
        left.index - right.index,
    );

  return (
    applicable[0]?.rule ?? {
      ...DEFAULT_ALERT_RULE,
      exceptionClass: trigger.exceptionClass,
    }
  );
}

function findSuppressionMatch(params: {
  rule: AutonomyExceptionRoutingRuleV1;
  trigger: AutonomyAnomalyTriggerV1;
  evaluatedAtIso: string;
  history: readonly AutonomyExceptionRoutingHistoryItemV1[];
}): string | undefined {
  const suppression = params.rule.suppression;
  if (suppression?.enabled !== true) return undefined;
  if (params.rule.handling === 'alert' && !suppression.suppressAlerts) return undefined;
  if (params.trigger.severity === 'critical' && !suppression.suppressAlerts) return undefined;
  const match = params.history.find(
    (item) =>
      item.workspaceId === params.trigger.workspaceId &&
      item.fingerprint === params.trigger.fingerprint &&
      item.exceptionClass === params.trigger.exceptionClass &&
      isWithinMinutes(item.routedAtIso, params.evaluatedAtIso, suppression.windowMinutes),
  );
  if (match === undefined) return undefined;
  return addMinutes(match.routedAtIso, suppression.windowMinutes);
}

function findDeduplicationMatch(params: {
  rule: AutonomyExceptionRoutingRuleV1;
  trigger: AutonomyAnomalyTriggerV1;
  evaluatedAtIso: string;
  history: readonly AutonomyExceptionRoutingHistoryItemV1[];
}): AutonomyExceptionRoutingHistoryItemV1 | undefined {
  const deduplication = params.rule.deduplication;
  if (deduplication?.enabled !== true) return undefined;
  return params.history.find(
    (item) =>
      item.workspaceId === params.trigger.workspaceId &&
      item.fingerprint === params.trigger.fingerprint &&
      item.exceptionClass === params.trigger.exceptionClass &&
      isWithinMinutes(item.routedAtIso, params.evaluatedAtIso, deduplication.windowMinutes) &&
      (!deduplication.requireUnresolvedRoute || item.unresolved),
  );
}

function shouldBatch(params: {
  rule: AutonomyExceptionRoutingRuleV1;
  trigger: AutonomyAnomalyTriggerV1;
  evaluatedAtIso: string;
  history: readonly AutonomyExceptionRoutingHistoryItemV1[];
}): boolean {
  const batching = params.rule.batching;
  if (params.rule.handling !== 'calm' || batching?.enabled !== true) return false;
  const batchKey = computeBatchKey(params.rule, params.trigger);
  const sameBatch = params.history.filter(
    (item) => item.workspaceId === params.trigger.workspaceId && item.batchKey === batchKey,
  );
  const oldest = sameBatch
    .map((item) => item.routedAtIso)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const flushByAge =
    oldest !== undefined &&
    !isWithinMinutes(oldest, params.evaluatedAtIso, batching.flushAfterMinutes);
  const activeBatchSize = sameBatch.filter((item) =>
    isWithinMinutes(item.routedAtIso, params.evaluatedAtIso, batching.flushAfterMinutes),
  ).length;
  const flushBySize = activeBatchSize + 1 >= batching.maxBatchSize;
  return !flushByAge && !flushBySize;
}

function buildDecision(params: {
  trigger: AutonomyAnomalyTriggerV1;
  evaluatedAtIso: string;
  rule: AutonomyExceptionRoutingRuleV1;
  evidence: AutonomyExceptionEvidenceAssessmentV1;
  nextStepOptions: readonly AutonomyExceptionNextStepV1[];
  disposition: AutonomyExceptionRoutingDispositionV1;
  batchKey?: string;
  duplicateOfTriggerId?: string;
  suppressedUntilIso?: string;
  rationale: string;
}): AutonomyExceptionRoutingDecisionV1 {
  return {
    schemaVersion: 1,
    triggerId: params.trigger.triggerId,
    workspaceId: params.trigger.workspaceId,
    evaluatedAtIso: params.evaluatedAtIso,
    ruleId: params.rule.ruleId,
    handling: params.rule.handling,
    disposition: params.disposition,
    target: params.rule.target,
    evidence: params.evidence,
    nextStepOptions: params.nextStepOptions,
    ...(params.batchKey !== undefined ? { batchKey: params.batchKey } : {}),
    ...(params.duplicateOfTriggerId !== undefined
      ? { duplicateOfTriggerId: params.duplicateOfTriggerId }
      : {}),
    ...(params.suppressedUntilIso !== undefined
      ? { suppressedUntilIso: params.suppressedUntilIso }
      : {}),
    rationale: params.rationale,
  };
}

function deriveNextStepOptions(
  configured: readonly AutonomyExceptionNextStepV1[],
  evidence: AutonomyExceptionEvidenceAssessmentV1,
): readonly AutonomyExceptionNextStepV1[] {
  if (evidence.status === 'complete') return configured;
  return uniqueNextSteps(['request-more-evidence', 'escalate', ...configured]);
}

function uniqueNextSteps(
  values: readonly AutonomyExceptionNextStepV1[],
): readonly AutonomyExceptionNextStepV1[] {
  return [...new Set(values)];
}

function computeBatchKey(
  rule: AutonomyExceptionRoutingRuleV1,
  trigger: AutonomyAnomalyTriggerV1,
): string {
  const key = rule.batching?.batchKey ?? 'fingerprint';
  if (key === 'exception-class') return `${trigger.workspaceId}:${trigger.exceptionClass}`;
  if (key === 'action-class') {
    return `${trigger.workspaceId}:${trigger.exceptionClass}:${trigger.actionClass ?? 'unclassified'}`;
  }
  return `${trigger.workspaceId}:${trigger.fingerprint}`;
}

function routingRuleSpecificity(rule: AutonomyExceptionRoutingRuleV1): number {
  const actionScore =
    rule.actionClassScope.kind === 'exact' ? 2 : rule.actionClassScope.kind === 'prefix' ? 1 : 0;
  const tierScore = rule.executionTiers === undefined ? 0 : 1;
  return actionScore + tierScore;
}

function severityMatches(
  severity: AutonomyExceptionSeverityV1,
  minSeverity: AutonomyExceptionSeverityV1,
): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minSeverity];
}

function actionClassMatches(
  scope: AutonomyActionClassScopeV1,
  actionClass: string | undefined,
): boolean {
  if (scope.kind === 'all') return true;
  if (actionClass === undefined) return false;
  if (scope.kind === 'exact') return actionClass === scope.actionClass;
  return actionClass.startsWith(scope.prefix);
}

function isWithinMinutes(startIso: string, evaluatedAtIso: string, minutes: number): boolean {
  const deltaMs = Date.parse(evaluatedAtIso) - Date.parse(startIso);
  return deltaMs >= 0 && deltaMs < minutes * 60_000;
}

function addMinutes(valueIso: string, minutes: number): string {
  return new Date(Date.parse(valueIso) + minutes * 60_000).toISOString();
}

function parseActionClassScope(value: unknown): AutonomyActionClassScopeV1 {
  const record = readRecord(value, 'actionClassScope', DelegatedAutonomyExceptionRoutingParseError);
  const kind = readEnum(
    record,
    'kind',
    ['all', 'exact', 'prefix'] as const,
    DelegatedAutonomyExceptionRoutingParseError,
  );
  if (kind === 'all') return { kind };
  if (kind === 'exact') {
    return {
      kind,
      actionClass: readString(record, 'actionClass', DelegatedAutonomyExceptionRoutingParseError),
    };
  }
  return {
    kind,
    prefix: readString(record, 'prefix', DelegatedAutonomyExceptionRoutingParseError),
  };
}

function parseRoutingTarget(value: unknown): AutonomyExceptionRoutingTargetV1 {
  const record = readRecord(value, 'target', DelegatedAutonomyExceptionRoutingParseError);
  const kind = readEnum(record, 'kind', TARGET_KINDS, DelegatedAutonomyExceptionRoutingParseError);
  if (kind === 'work-item') {
    const workItemId = readOptionalString(
      record,
      'workItemId',
      DelegatedAutonomyExceptionRoutingParseError,
    );
    return {
      kind,
      ...(workItemId !== undefined ? { workItemId: WorkItemId(workItemId) } : {}),
    };
  }
  if (kind === 'workforce-queue') {
    return {
      kind,
      workforceQueueId: WorkforceQueueId(
        readString(record, 'workforceQueueId', DelegatedAutonomyExceptionRoutingParseError),
      ),
    };
  }
  if (kind === 'workspace-user') {
    return {
      kind,
      userId: UserId(readString(record, 'userId', DelegatedAutonomyExceptionRoutingParseError)),
    };
  }
  if (kind === 'approval-gate') {
    const approvalId = readOptionalString(
      record,
      'approvalId',
      DelegatedAutonomyExceptionRoutingParseError,
    );
    return {
      kind,
      ...(approvalId !== undefined ? { approvalId: ApprovalId(approvalId) } : {}),
    };
  }
  return { kind };
}

function parseOptionalSuppression(value: unknown): AutonomyExceptionSuppressionV1 | undefined {
  if (value === undefined) return undefined;
  const record = readRecord(value, 'suppression', DelegatedAutonomyExceptionRoutingParseError);
  return {
    enabled: readBoolean(record, 'enabled', DelegatedAutonomyExceptionRoutingParseError),
    windowMinutes: readPositiveInteger(record, 'windowMinutes'),
    suppressAlerts:
      readOptionalBoolean(record, 'suppressAlerts', DelegatedAutonomyExceptionRoutingParseError) ??
      false,
    rationale: readString(record, 'rationale', DelegatedAutonomyExceptionRoutingParseError),
  };
}

function parseOptionalDeduplication(value: unknown): AutonomyExceptionDeduplicationV1 | undefined {
  if (value === undefined) return undefined;
  const record = readRecord(value, 'deduplication', DelegatedAutonomyExceptionRoutingParseError);
  return {
    enabled: readBoolean(record, 'enabled', DelegatedAutonomyExceptionRoutingParseError),
    windowMinutes: readPositiveInteger(record, 'windowMinutes'),
    requireUnresolvedRoute:
      readOptionalBoolean(
        record,
        'requireUnresolvedRoute',
        DelegatedAutonomyExceptionRoutingParseError,
      ) ?? true,
  };
}

function parseOptionalBatching(value: unknown): AutonomyExceptionBatchingV1 | undefined {
  if (value === undefined) return undefined;
  const record = readRecord(value, 'batching', DelegatedAutonomyExceptionRoutingParseError);
  return {
    enabled: readBoolean(record, 'enabled', DelegatedAutonomyExceptionRoutingParseError),
    batchKey: readEnum(
      record,
      'batchKey',
      ['exception-class', 'action-class', 'fingerprint'] as const,
      DelegatedAutonomyExceptionRoutingParseError,
    ),
    maxBatchSize: readPositiveInteger(record, 'maxBatchSize'),
    flushAfterMinutes: readPositiveInteger(record, 'flushAfterMinutes'),
  };
}

function parseEvidenceExpectations(value: unknown): readonly AutonomyEvidenceExpectationV1[] {
  if (!Array.isArray(value)) {
    throw new DelegatedAutonomyExceptionRoutingParseError('evidenceExpectations must be an array.');
  }
  return value.map((item, index) => {
    const record = readRecord(
      item,
      `evidenceExpectations[${index}]`,
      DelegatedAutonomyExceptionRoutingParseError,
    );
    return {
      requirementId: readString(
        record,
        'requirementId',
        DelegatedAutonomyExceptionRoutingParseError,
      ),
      label: readString(record, 'label', DelegatedAutonomyExceptionRoutingParseError),
      category: readEnum(
        record,
        'category',
        EVIDENCE_CATEGORIES,
        DelegatedAutonomyExceptionRoutingParseError,
      ),
      required: readBoolean(record, 'required', DelegatedAutonomyExceptionRoutingParseError),
      minimumCount: readPositiveInteger(record, 'minimumCount'),
    };
  });
}

function parseNextStepOptions(value: unknown): readonly AutonomyExceptionNextStepV1[] {
  if (!Array.isArray(value)) {
    throw new DelegatedAutonomyExceptionRoutingParseError('nextStepOptions must be an array.');
  }
  return value.map((item, index) => {
    const raw = parseNonEmptyString(
      item,
      `nextStepOptions[${index}]`,
      DelegatedAutonomyExceptionRoutingParseError,
    );
    if (!AUTONOMY_EXCEPTION_NEXT_STEPS_V1.includes(raw as AutonomyExceptionNextStepV1)) {
      throw new DelegatedAutonomyExceptionRoutingParseError(
        `nextStepOptions[${index}] must be one of: ${AUTONOMY_EXCEPTION_NEXT_STEPS_V1.join(', ')}.`,
      );
    }
    return raw as AutonomyExceptionNextStepV1;
  });
}

function parseEvidencePacket(value: unknown): AutonomyExceptionEvidencePacketV1 {
  const record = readRecord(value, 'evidencePacket', DelegatedAutonomyExceptionRoutingParseError);
  const evidenceIds = parseEvidenceIds(record['evidenceIds'], 'evidenceIds');
  const consultedEvidenceIds = parseEvidenceIds(
    record['consultedEvidenceIds'],
    'consultedEvidenceIds',
  );
  const packet: AutonomyExceptionEvidencePacketV1 = {
    packetId: readString(record, 'packetId', DelegatedAutonomyExceptionRoutingParseError),
    assembledAtIso: readIsoString(
      record,
      'assembledAtIso',
      DelegatedAutonomyExceptionRoutingParseError,
    ),
    evidenceIds,
    consultedEvidenceIds,
    missingEvidenceSignals:
      readOptionalStringArray(
        record,
        'missingEvidenceSignals',
        DelegatedAutonomyExceptionRoutingParseError,
      ) ?? [],
  };
  validateEvidencePacket(packet);
  return packet;
}

function parseEvidenceIds(value: unknown, label: string): readonly EvidenceIdType[] {
  if (!Array.isArray(value)) {
    throw new DelegatedAutonomyExceptionRoutingParseError(`${label} must be an array.`);
  }
  return value.map((item, index) =>
    EvidenceId(
      parseNonEmptyString(item, `${label}[${index}]`, DelegatedAutonomyExceptionRoutingParseError),
    ),
  );
}

function validateEvidencePacket(packet: AutonomyExceptionEvidencePacketV1): void {
  assertNonEmpty(packet.packetId, 'evidencePacket.packetId');
  readIsoString(
    { assembledAtIso: packet.assembledAtIso },
    'assembledAtIso',
    DelegatedAutonomyExceptionRoutingParseError,
  );
}

function assertTargetCompatible(
  handling: AutonomyExceptionHandlingV1,
  target: AutonomyExceptionRoutingTargetV1,
): void {
  const calmTargets: readonly AutonomyExceptionRoutingTargetV1['kind'][] = [
    'weekly-autonomy-digest',
    'work-item',
    'audit-review',
  ];
  if (handling === 'calm' && !calmTargets.includes(target.kind)) {
    throw new DelegatedAutonomyExceptionRoutingParseError(
      'Calm handling may route only to weekly-autonomy-digest, work-item, or audit-review targets.',
    );
  }
}

function readPositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = readNonNegativeInteger(record, key, DelegatedAutonomyExceptionRoutingParseError);
  if (value === 0) {
    throw new DelegatedAutonomyExceptionRoutingParseError(`${key} must be greater than zero.`);
  }
  return value;
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim() === '') {
    throw new DelegatedAutonomyExceptionRoutingParseError(`${label} must be non-empty.`);
  }
}

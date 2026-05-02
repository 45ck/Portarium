import {
  ArtifactId,
  HashSha256,
  UserId,
  WorkspaceId,
  type ArtifactId as ArtifactIdType,
  type ExecutionTier,
  type HashSha256 as HashSha256Type,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readEnum,
  readInteger,
  readIsoString,
  readNonNegativeInteger,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export const WEEKLY_AUTONOMY_DIGEST_SCHEMA_VERSION = 1 as const;

export const DIGEST_EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove'] as const;
export type DigestExecutionTier = (typeof DIGEST_EXECUTION_TIERS)[number];

export type PolicyAdjustmentKind = 'promote' | 'demote';

export type WeeklyAutonomyDigestActionObservationV1 = Readonly<{
  actionClass: string;
  executionTier: DigestExecutionTier;
  occurredAtIso: string;
  anomaly: boolean;
  reversal: boolean;
}>;

export type WeeklyAutonomyDigestTierMetricsV1 = Readonly<{
  actions: number;
  anomalies: number;
  reversals: number;
  anomalyRate: number;
  reversalRate: number;
}>;

export type WeeklyAutonomyDigestActionClassSummaryV1 = Readonly<{
  actionClass: string;
  currentTier: DigestExecutionTier;
  weekly: Readonly<Record<DigestExecutionTier, WeeklyAutonomyDigestTierMetricsV1>>;
  weeklyTotals: WeeklyAutonomyDigestTierMetricsV1;
  historyActions: number;
  historyAnomalies: number;
  historyReversals: number;
  historyAnomalyRate: number;
  historyReversalRate: number;
}>;

export type WeeklyAutonomyDigestPolicyAdjustmentV1 = Readonly<{
  recommendationId: string;
  actionClass: string;
  adjustment: PolicyAdjustmentKind;
  currentTier: DigestExecutionTier;
  recommendedTier: DigestExecutionTier;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  historyWindowDays: number;
  evidence: Readonly<{
    actions: number;
    anomalies: number;
    reversals: number;
    anomalyRate: number;
    reversalRate: number;
  }>;
  shortcut: Readonly<{
    kind: 'policy-calibration-shortcut';
    effect: 'draft-policy-change-only';
    requiresHumanApproval: true;
  }>;
}>;

export type WeeklyAutonomyDigestAcknowledgementV1 = Readonly<{
  required: true;
  status: 'Unacknowledged' | 'Acknowledged';
  acknowledgedAtIso?: string;
  acknowledgedByUserId?: UserIdType;
  acknowledgementEvidenceId?: string;
}>;

export type WeeklyAutonomyDigestEvidenceSemanticsV1 = Readonly<{
  artifactPayloadRefKind: 'Artifact';
  artifactContentType: 'text/markdown';
  immutablePayloadRequired: true;
  acknowledgementEvidenceCategory: 'System';
  acknowledgementRecordsDigestHash: true;
  policyShortcutEvidenceCategory: 'Policy';
  policyShortcutEffect: 'draft-policy-change-only';
  policyShortcutRecordsRecommendationId: true;
}>;

export type WeeklyAutonomyDigestArtifactV1 = Readonly<{
  schemaVersion: 1;
  artifactId: ArtifactIdType;
  workspaceId: WorkspaceIdType;
  periodStartIso: string;
  periodEndIso: string;
  historyWindowStartIso: string;
  historyWindowDays: number;
  generatedAtIso: string;
  digestHashSha256?: HashSha256Type;
  overall: Readonly<Record<DigestExecutionTier, WeeklyAutonomyDigestTierMetricsV1>>;
  actionClasses: readonly WeeklyAutonomyDigestActionClassSummaryV1[];
  recommendedPolicyAdjustments: readonly WeeklyAutonomyDigestPolicyAdjustmentV1[];
  acknowledgement: WeeklyAutonomyDigestAcknowledgementV1;
  evidenceSemantics: WeeklyAutonomyDigestEvidenceSemanticsV1;
}>;

export class WeeklyAutonomyDigestParseError extends Error {
  public override readonly name = 'WeeklyAutonomyDigestParseError';

  public constructor(message: string) {
    super(message);
  }
}

export type BuildWeeklyAutonomyDigestInputV1 = Readonly<{
  artifactId: string;
  workspaceId: string;
  periodStartIso: string;
  periodEndIso: string;
  historyWindowStartIso: string;
  generatedAtIso: string;
  observations: readonly WeeklyAutonomyDigestActionObservationV1[];
  currentPolicyTiers?: Readonly<Record<string, DigestExecutionTier>>;
  digestHashSha256?: string;
  acknowledgedAtIso?: string;
  acknowledgedByUserId?: string;
  acknowledgementEvidenceId?: string;
}>;

const ZERO_TIER_METRICS: WeeklyAutonomyDigestTierMetricsV1 = {
  actions: 0,
  anomalies: 0,
  reversals: 0,
  anomalyRate: 0,
  reversalRate: 0,
};

const EVIDENCE_SEMANTICS: WeeklyAutonomyDigestEvidenceSemanticsV1 = {
  artifactPayloadRefKind: 'Artifact',
  artifactContentType: 'text/markdown',
  immutablePayloadRequired: true,
  acknowledgementEvidenceCategory: 'System',
  acknowledgementRecordsDigestHash: true,
  policyShortcutEvidenceCategory: 'Policy',
  policyShortcutEffect: 'draft-policy-change-only',
  policyShortcutRecordsRecommendationId: true,
};

const PROMOTION_MIN_ACTIONS = 30;
const PROMOTION_MAX_ANOMALY_RATE = 0.005;
const PROMOTION_MAX_REVERSAL_RATE = 0;
const DEMOTION_MIN_ACTIONS = 10;
const DEMOTION_MIN_ANOMALY_RATE = 0.05;
const DEMOTION_MIN_REVERSAL_RATE = 0.02;

export function buildWeeklyAutonomyDigestArtifactV1(
  input: BuildWeeklyAutonomyDigestInputV1,
): WeeklyAutonomyDigestArtifactV1 {
  const parsedDates = parseDigestWindow(input);
  const observations = input.observations.map(validateObservation);
  const weeklyObservations = observations.filter((observation) =>
    isWithinClosedOpen(observation.occurredAtIso, input.periodStartIso, input.periodEndIso),
  );
  const historyObservations = observations.filter((observation) =>
    isWithinClosedOpen(observation.occurredAtIso, input.historyWindowStartIso, input.periodEndIso),
  );

  const actionClasses = [
    ...new Set([
      ...weeklyObservations.map((observation) => observation.actionClass),
      ...historyObservations.map((observation) => observation.actionClass),
      ...Object.keys(input.currentPolicyTiers ?? {}),
    ]),
  ].sort((left, right) => left.localeCompare(right));

  const summaries = actionClasses.map((actionClass) => {
    const currentTier = input.currentPolicyTiers?.[actionClass];
    return buildActionClassSummary({
      actionClass,
      weeklyObservations,
      historyObservations,
      ...(currentTier !== undefined ? { currentTier } : {}),
    });
  });

  const acknowledged =
    input.acknowledgedAtIso !== undefined && input.acknowledgedByUserId !== undefined;

  return {
    schemaVersion: 1,
    artifactId: ArtifactId(input.artifactId),
    workspaceId: WorkspaceId(input.workspaceId),
    periodStartIso: input.periodStartIso,
    periodEndIso: input.periodEndIso,
    historyWindowStartIso: input.historyWindowStartIso,
    historyWindowDays: parsedDates.historyWindowDays,
    generatedAtIso: input.generatedAtIso,
    ...(input.digestHashSha256 !== undefined
      ? { digestHashSha256: HashSha256(input.digestHashSha256) }
      : {}),
    overall: buildTierMetrics(weeklyObservations),
    actionClasses: summaries,
    recommendedPolicyAdjustments: summaries
      .map(buildPolicyAdjustmentRecommendation)
      .filter((item): item is WeeklyAutonomyDigestPolicyAdjustmentV1 => item !== null),
    acknowledgement: {
      required: true,
      status: acknowledged ? 'Acknowledged' : 'Unacknowledged',
      ...(input.acknowledgedAtIso !== undefined
        ? { acknowledgedAtIso: input.acknowledgedAtIso }
        : {}),
      ...(input.acknowledgedByUserId !== undefined
        ? { acknowledgedByUserId: UserId(input.acknowledgedByUserId) }
        : {}),
      ...(input.acknowledgementEvidenceId !== undefined
        ? { acknowledgementEvidenceId: input.acknowledgementEvidenceId }
        : {}),
    },
    evidenceSemantics: EVIDENCE_SEMANTICS,
  };
}

export function parseWeeklyAutonomyDigestArtifactV1(
  value: unknown,
): WeeklyAutonomyDigestArtifactV1 {
  const record = readRecord(value, 'WeeklyAutonomyDigestArtifact', WeeklyAutonomyDigestParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', WeeklyAutonomyDigestParseError);
  if (schemaVersion !== 1) {
    throw new WeeklyAutonomyDigestParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const artifactId = ArtifactId(readString(record, 'artifactId', WeeklyAutonomyDigestParseError));
  const workspaceId = WorkspaceId(
    readString(record, 'workspaceId', WeeklyAutonomyDigestParseError),
  );
  const periodStartIso = readIsoString(record, 'periodStartIso', WeeklyAutonomyDigestParseError);
  const periodEndIso = readIsoString(record, 'periodEndIso', WeeklyAutonomyDigestParseError);
  const historyWindowStartIso = readIsoString(
    record,
    'historyWindowStartIso',
    WeeklyAutonomyDigestParseError,
  );
  const historyWindowDays = readNonNegativeInteger(
    record,
    'historyWindowDays',
    WeeklyAutonomyDigestParseError,
  );
  const generatedAtIso = readIsoString(record, 'generatedAtIso', WeeklyAutonomyDigestParseError);
  const digestHashRaw = readOptionalString(
    record,
    'digestHashSha256',
    WeeklyAutonomyDigestParseError,
  );
  const overall = parseTierMetricsRecord(record['overall'], 'overall');
  const actionClasses = parseActionClassSummaries(record['actionClasses']);
  const recommendedPolicyAdjustments = parseRecommendations(record['recommendedPolicyAdjustments']);
  const acknowledgement = parseAcknowledgement(record['acknowledgement']);
  const evidenceSemantics = parseEvidenceSemantics(record['evidenceSemantics']);

  return {
    schemaVersion: 1,
    artifactId,
    workspaceId,
    periodStartIso,
    periodEndIso,
    historyWindowStartIso,
    historyWindowDays,
    generatedAtIso,
    ...(digestHashRaw !== undefined ? { digestHashSha256: HashSha256(digestHashRaw) } : {}),
    overall,
    actionClasses,
    recommendedPolicyAdjustments,
    acknowledgement,
    evidenceSemantics,
  };
}

export function renderWeeklyAutonomyDigestMarkdown(digest: WeeklyAutonomyDigestArtifactV1): string {
  const lines: string[] = [
    `# Weekly Autonomy Digest: ${shortDate(digest.periodStartIso)} -> ${shortDate(digest.periodEndIso)}`,
    '',
    '| Action class | Tier | Actions | Anomalies | Reversals | Anomaly rate | Reversal rate |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const summary of digest.actionClasses) {
    for (const tier of DIGEST_EXECUTION_TIERS) {
      const metrics = summary.weekly[tier];
      if (metrics.actions === 0) continue;
      lines.push(
        `| \`${summary.actionClass}\` | ${formatTier(tier)} | ${metrics.actions} | ${formatCount(metrics.anomalies)} | ${formatCount(metrics.reversals)} | ${formatRate(metrics.anomalyRate)} | ${formatRate(metrics.reversalRate)} |`,
      );
    }
  }

  if (digest.actionClasses.every((summary) => summary.weeklyTotals.actions === 0)) {
    lines.push('| _No activity_ | - | 0 | 0 | 0 | 0.00% | 0.00% |');
  }

  lines.push('', '## Recommended policy adjustments', '');
  if (digest.recommendedPolicyAdjustments.length === 0) {
    lines.push('- No policy calibration shortcut crossed the deterministic threshold.');
  } else {
    for (const recommendation of digest.recommendedPolicyAdjustments) {
      lines.push(
        `- \`${recommendation.actionClass}\`: ${recommendation.adjustment} ${formatTier(recommendation.currentTier)} -> ${formatTier(recommendation.recommendedTier)} (${recommendation.evidence.actions} actions, ${formatRate(recommendation.evidence.anomalyRate)} anomaly rate, ${formatRate(recommendation.evidence.reversalRate)} reversal rate over ${recommendation.historyWindowDays} days). ${recommendation.rationale}`,
      );
    }
  }

  lines.push(
    '',
    '## Acknowledgement and evidence',
    '',
    `- Acknowledgement required: ${digest.acknowledgement.required ? 'yes' : 'no'}`,
    `- Acknowledgement status: ${digest.acknowledgement.status}`,
    `- Artifact payload ref kind: ${digest.evidenceSemantics.artifactPayloadRefKind}`,
    `- Policy shortcut effect: ${digest.evidenceSemantics.policyShortcutEffect}`,
  );

  return `${lines.join('\n')}\n`;
}

function parseDigestWindow(input: BuildWeeklyAutonomyDigestInputV1): { historyWindowDays: number } {
  const start = parseDate(input.periodStartIso, 'periodStartIso');
  const end = parseDate(input.periodEndIso, 'periodEndIso');
  const historyStart = parseDate(input.historyWindowStartIso, 'historyWindowStartIso');
  parseDate(input.generatedAtIso, 'generatedAtIso');
  if (end <= start) {
    throw new WeeklyAutonomyDigestParseError('periodEndIso must be after periodStartIso.');
  }
  if (historyStart > start) {
    throw new WeeklyAutonomyDigestParseError(
      'historyWindowStartIso must not be after periodStartIso.',
    );
  }
  if (input.digestHashSha256?.trim() === '') {
    throw new WeeklyAutonomyDigestParseError(
      'digestHashSha256 must be a non-empty string when provided.',
    );
  }
  if (input.acknowledgedAtIso !== undefined) {
    parseDate(input.acknowledgedAtIso, 'acknowledgedAtIso');
  }
  if (
    input.acknowledgedAtIso !== undefined &&
    (input.acknowledgedByUserId === undefined || input.acknowledgedByUserId.trim() === '')
  ) {
    throw new WeeklyAutonomyDigestParseError(
      'acknowledgedByUserId is required when acknowledgedAtIso is provided.',
    );
  }
  const historyWindowDays = Math.round((end.getTime() - historyStart.getTime()) / 86_400_000);
  return { historyWindowDays };
}

function validateObservation(
  observation: WeeklyAutonomyDigestActionObservationV1,
): WeeklyAutonomyDigestActionObservationV1 {
  if (observation.actionClass.trim() === '') {
    throw new WeeklyAutonomyDigestParseError('actionClass must be a non-empty string.');
  }
  if (!DIGEST_EXECUTION_TIERS.includes(observation.executionTier)) {
    throw new WeeklyAutonomyDigestParseError(
      `executionTier must be one of: ${DIGEST_EXECUTION_TIERS.join(', ')}.`,
    );
  }
  parseDate(observation.occurredAtIso, 'occurredAtIso');
  if (typeof observation.anomaly !== 'boolean' || typeof observation.reversal !== 'boolean') {
    throw new WeeklyAutonomyDigestParseError('anomaly and reversal must be boolean values.');
  }
  return observation;
}

function buildActionClassSummary(params: {
  actionClass: string;
  weeklyObservations: readonly WeeklyAutonomyDigestActionObservationV1[];
  historyObservations: readonly WeeklyAutonomyDigestActionObservationV1[];
  currentTier?: DigestExecutionTier;
}): WeeklyAutonomyDigestActionClassSummaryV1 {
  const weeklyForClass = params.weeklyObservations.filter(
    (observation) => observation.actionClass === params.actionClass,
  );
  const historyForClass = params.historyObservations.filter(
    (observation) => observation.actionClass === params.actionClass,
  );
  const historyTotals = metricsFor(historyForClass);

  return {
    actionClass: params.actionClass,
    currentTier: params.currentTier ?? inferCurrentTier(historyForClass),
    weekly: buildTierMetrics(weeklyForClass),
    weeklyTotals: metricsFor(weeklyForClass),
    historyActions: historyTotals.actions,
    historyAnomalies: historyTotals.anomalies,
    historyReversals: historyTotals.reversals,
    historyAnomalyRate: historyTotals.anomalyRate,
    historyReversalRate: historyTotals.reversalRate,
  };
}

function buildTierMetrics(
  observations: readonly WeeklyAutonomyDigestActionObservationV1[],
): Readonly<Record<DigestExecutionTier, WeeklyAutonomyDigestTierMetricsV1>> {
  return {
    Auto: metricsFor(observations.filter((observation) => observation.executionTier === 'Auto')),
    Assisted: metricsFor(
      observations.filter((observation) => observation.executionTier === 'Assisted'),
    ),
    HumanApprove: metricsFor(
      observations.filter((observation) => observation.executionTier === 'HumanApprove'),
    ),
  };
}

function metricsFor(
  observations: readonly WeeklyAutonomyDigestActionObservationV1[],
): WeeklyAutonomyDigestTierMetricsV1 {
  const actions = observations.length;
  if (actions === 0) return ZERO_TIER_METRICS;
  const anomalies = observations.filter((observation) => observation.anomaly).length;
  const reversals = observations.filter((observation) => observation.reversal).length;
  return {
    actions,
    anomalies,
    reversals,
    anomalyRate: anomalies / actions,
    reversalRate: reversals / actions,
  };
}

function inferCurrentTier(
  observations: readonly WeeklyAutonomyDigestActionObservationV1[],
): DigestExecutionTier {
  const counts = buildTierMetrics(observations);
  return [...DIGEST_EXECUTION_TIERS].sort((left, right) => {
    const countDiff = counts[right].actions - counts[left].actions;
    if (countDiff !== 0) return countDiff;
    return tierRank(right) - tierRank(left);
  })[0]!;
}

function buildPolicyAdjustmentRecommendation(
  summary: WeeklyAutonomyDigestActionClassSummaryV1,
): WeeklyAutonomyDigestPolicyAdjustmentV1 | null {
  if (summary.historyActions < DEMOTION_MIN_ACTIONS) return null;

  if (
    (summary.historyAnomalyRate >= DEMOTION_MIN_ANOMALY_RATE ||
      summary.historyReversalRate >= DEMOTION_MIN_REVERSAL_RATE) &&
    summary.currentTier !== 'HumanApprove'
  ) {
    return recommendationFor(summary, 'demote', nextStricterTier(summary.currentTier));
  }

  if (
    summary.historyActions >= PROMOTION_MIN_ACTIONS &&
    summary.historyAnomalyRate <= PROMOTION_MAX_ANOMALY_RATE &&
    summary.historyReversalRate <= PROMOTION_MAX_REVERSAL_RATE &&
    summary.currentTier !== 'Auto'
  ) {
    return recommendationFor(summary, 'promote', nextLessStrictTier(summary.currentTier));
  }

  return null;
}

function recommendationFor(
  summary: WeeklyAutonomyDigestActionClassSummaryV1,
  adjustment: PolicyAdjustmentKind,
  recommendedTier: DigestExecutionTier,
): WeeklyAutonomyDigestPolicyAdjustmentV1 {
  const stableKey = summary.actionClass.replaceAll(/[^a-zA-Z0-9:_-]/g, '-').toLowerCase();
  return {
    recommendationId: `${adjustment}:${stableKey}:${summary.currentTier}->${recommendedTier}`,
    actionClass: summary.actionClass,
    adjustment,
    currentTier: summary.currentTier,
    recommendedTier,
    confidence: summary.historyActions >= 60 ? 'high' : 'medium',
    rationale:
      adjustment === 'promote'
        ? '90-day history shows enough low-noise activity to reduce operator friction.'
        : '90-day history shows anomaly or reversal signal above the calibration threshold.',
    historyWindowDays: 90,
    evidence: {
      actions: summary.historyActions,
      anomalies: summary.historyAnomalies,
      reversals: summary.historyReversals,
      anomalyRate: summary.historyAnomalyRate,
      reversalRate: summary.historyReversalRate,
    },
    shortcut: {
      kind: 'policy-calibration-shortcut',
      effect: 'draft-policy-change-only',
      requiresHumanApproval: true,
    },
  };
}

function nextStricterTier(tier: DigestExecutionTier): DigestExecutionTier {
  if (tier === 'Auto') return 'Assisted';
  return 'HumanApprove';
}

function nextLessStrictTier(tier: DigestExecutionTier): DigestExecutionTier {
  if (tier === 'HumanApprove') return 'Assisted';
  return 'Auto';
}

function tierRank(tier: DigestExecutionTier): number {
  if (tier === 'Auto') return 0;
  if (tier === 'Assisted') return 1;
  return 2;
}

function isWithinClosedOpen(valueIso: string, startIso: string, endIso: string): boolean {
  const value = new Date(valueIso).getTime();
  return value >= new Date(startIso).getTime() && value < new Date(endIso).getTime();
}

function parseDate(value: string, label: string): Date {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new WeeklyAutonomyDigestParseError(`${label} must be a non-empty ISO timestamp.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new WeeklyAutonomyDigestParseError(`${label} must be a valid ISO timestamp.`);
  }
  return parsed;
}

function parseTierMetricsRecord(
  value: unknown,
  pathLabel: string,
): Readonly<Record<DigestExecutionTier, WeeklyAutonomyDigestTierMetricsV1>> {
  const record = readRecord(value, pathLabel, WeeklyAutonomyDigestParseError);
  return {
    Auto: parseTierMetrics(record['Auto'], `${pathLabel}.Auto`),
    Assisted: parseTierMetrics(record['Assisted'], `${pathLabel}.Assisted`),
    HumanApprove: parseTierMetrics(record['HumanApprove'], `${pathLabel}.HumanApprove`),
  };
}

function parseTierMetrics(value: unknown, pathLabel: string): WeeklyAutonomyDigestTierMetricsV1 {
  const record = readRecord(value, pathLabel, WeeklyAutonomyDigestParseError);
  const actions = readNonNegativeInteger(record, 'actions', WeeklyAutonomyDigestParseError);
  const anomalies = readNonNegativeInteger(record, 'anomalies', WeeklyAutonomyDigestParseError);
  const reversals = readNonNegativeInteger(record, 'reversals', WeeklyAutonomyDigestParseError);
  const anomalyRate = readRate(record, 'anomalyRate');
  const reversalRate = readRate(record, 'reversalRate');
  if (anomalies > actions || reversals > actions) {
    throw new WeeklyAutonomyDigestParseError(
      `${pathLabel} anomaly and reversal counts cannot exceed actions.`,
    );
  }
  return { actions, anomalies, reversals, anomalyRate, reversalRate };
}

function readRate(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new WeeklyAutonomyDigestParseError(`${key} must be a number between 0 and 1.`);
  }
  return value;
}

function parseActionClassSummaries(
  value: unknown,
): readonly WeeklyAutonomyDigestActionClassSummaryV1[] {
  if (!Array.isArray(value)) {
    throw new WeeklyAutonomyDigestParseError('actionClasses must be an array.');
  }
  return value.map((item, index) => {
    const record = readRecord(item, `actionClasses[${index}]`, WeeklyAutonomyDigestParseError);
    return {
      actionClass: readString(record, 'actionClass', WeeklyAutonomyDigestParseError),
      currentTier: readEnum(
        record,
        'currentTier',
        DIGEST_EXECUTION_TIERS,
        WeeklyAutonomyDigestParseError,
      ),
      weekly: parseTierMetricsRecord(record['weekly'], `actionClasses[${index}].weekly`),
      weeklyTotals: parseTierMetrics(
        record['weeklyTotals'],
        `actionClasses[${index}].weeklyTotals`,
      ),
      historyActions: readNonNegativeInteger(
        record,
        'historyActions',
        WeeklyAutonomyDigestParseError,
      ),
      historyAnomalies: readNonNegativeInteger(
        record,
        'historyAnomalies',
        WeeklyAutonomyDigestParseError,
      ),
      historyReversals: readNonNegativeInteger(
        record,
        'historyReversals',
        WeeklyAutonomyDigestParseError,
      ),
      historyAnomalyRate: readRate(record, 'historyAnomalyRate'),
      historyReversalRate: readRate(record, 'historyReversalRate'),
    };
  });
}

function parseRecommendations(value: unknown): readonly WeeklyAutonomyDigestPolicyAdjustmentV1[] {
  if (!Array.isArray(value)) {
    throw new WeeklyAutonomyDigestParseError('recommendedPolicyAdjustments must be an array.');
  }
  return value.map((item, index) => {
    const record = readRecord(
      item,
      `recommendedPolicyAdjustments[${index}]`,
      WeeklyAutonomyDigestParseError,
    );
    const evidence = readRecord(record['evidence'], 'evidence', WeeklyAutonomyDigestParseError);
    const shortcut = readRecord(record['shortcut'], 'shortcut', WeeklyAutonomyDigestParseError);
    return {
      recommendationId: readString(record, 'recommendationId', WeeklyAutonomyDigestParseError),
      actionClass: readString(record, 'actionClass', WeeklyAutonomyDigestParseError),
      adjustment: readEnum(
        record,
        'adjustment',
        ['promote', 'demote'] as const,
        WeeklyAutonomyDigestParseError,
      ),
      currentTier: readEnum(
        record,
        'currentTier',
        DIGEST_EXECUTION_TIERS,
        WeeklyAutonomyDigestParseError,
      ),
      recommendedTier: readEnum(
        record,
        'recommendedTier',
        DIGEST_EXECUTION_TIERS,
        WeeklyAutonomyDigestParseError,
      ),
      confidence: readEnum(
        record,
        'confidence',
        ['low', 'medium', 'high'] as const,
        WeeklyAutonomyDigestParseError,
      ),
      rationale: readString(record, 'rationale', WeeklyAutonomyDigestParseError),
      historyWindowDays: readNonNegativeInteger(
        record,
        'historyWindowDays',
        WeeklyAutonomyDigestParseError,
      ),
      evidence: {
        actions: readNonNegativeInteger(evidence, 'actions', WeeklyAutonomyDigestParseError),
        anomalies: readNonNegativeInteger(evidence, 'anomalies', WeeklyAutonomyDigestParseError),
        reversals: readNonNegativeInteger(evidence, 'reversals', WeeklyAutonomyDigestParseError),
        anomalyRate: readRate(evidence, 'anomalyRate'),
        reversalRate: readRate(evidence, 'reversalRate'),
      },
      shortcut: {
        kind: readEnum(
          shortcut,
          'kind',
          ['policy-calibration-shortcut'] as const,
          WeeklyAutonomyDigestParseError,
        ),
        effect: readEnum(
          shortcut,
          'effect',
          ['draft-policy-change-only'] as const,
          WeeklyAutonomyDigestParseError,
        ),
        requiresHumanApproval: true,
      },
    };
  });
}

function parseAcknowledgement(value: unknown): WeeklyAutonomyDigestAcknowledgementV1 {
  const record = readRecord(value, 'acknowledgement', WeeklyAutonomyDigestParseError);
  const status = readEnum(
    record,
    'status',
    ['Unacknowledged', 'Acknowledged'] as const,
    WeeklyAutonomyDigestParseError,
  );
  const acknowledgedAtIso = readOptionalIsoString(
    record,
    'acknowledgedAtIso',
    WeeklyAutonomyDigestParseError,
  );
  const acknowledgedByRaw = readOptionalString(
    record,
    'acknowledgedByUserId',
    WeeklyAutonomyDigestParseError,
  );
  const acknowledgementEvidenceId = readOptionalString(
    record,
    'acknowledgementEvidenceId',
    WeeklyAutonomyDigestParseError,
  );
  if (
    status === 'Acknowledged' &&
    (acknowledgedAtIso === undefined || acknowledgedByRaw === undefined)
  ) {
    throw new WeeklyAutonomyDigestParseError(
      'Acknowledged digest requires acknowledgedAtIso and acknowledgedByUserId.',
    );
  }
  return {
    required: true,
    status,
    ...(acknowledgedAtIso !== undefined ? { acknowledgedAtIso } : {}),
    ...(acknowledgedByRaw !== undefined ? { acknowledgedByUserId: UserId(acknowledgedByRaw) } : {}),
    ...(acknowledgementEvidenceId !== undefined ? { acknowledgementEvidenceId } : {}),
  };
}

function parseEvidenceSemantics(value: unknown): WeeklyAutonomyDigestEvidenceSemanticsV1 {
  const record = readRecord(value, 'evidenceSemantics', WeeklyAutonomyDigestParseError);
  const artifactPayloadRefKind = readEnum(
    record,
    'artifactPayloadRefKind',
    ['Artifact'] as const,
    WeeklyAutonomyDigestParseError,
  );
  const artifactContentType = readEnum(
    record,
    'artifactContentType',
    ['text/markdown'] as const,
    WeeklyAutonomyDigestParseError,
  );
  const acknowledgementEvidenceCategory = readEnum(
    record,
    'acknowledgementEvidenceCategory',
    ['System'] as const,
    WeeklyAutonomyDigestParseError,
  );
  const policyShortcutEvidenceCategory = readEnum(
    record,
    'policyShortcutEvidenceCategory',
    ['Policy'] as const,
    WeeklyAutonomyDigestParseError,
  );
  const policyShortcutEffect = readEnum(
    record,
    'policyShortcutEffect',
    ['draft-policy-change-only'] as const,
    WeeklyAutonomyDigestParseError,
  );
  return {
    artifactPayloadRefKind,
    artifactContentType,
    immutablePayloadRequired: true,
    acknowledgementEvidenceCategory,
    acknowledgementRecordsDigestHash: true,
    policyShortcutEvidenceCategory,
    policyShortcutEffect,
    policyShortcutRecordsRecommendationId: true,
  };
}

function shortDate(value: string): string {
  return value.slice(0, 10);
}

function formatTier(tier: ExecutionTier): string {
  if (tier === 'HumanApprove') return 'HUMAN-APPROVE';
  return tier.toUpperCase();
}

function formatCount(value: number): string {
  return value === 0 ? '0' : String(value);
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

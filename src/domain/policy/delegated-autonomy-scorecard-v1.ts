import type {
  ActionId as ActionIdType,
  ExecutionTier,
  PolicyChangeId as PolicyChangeIdType,
  PolicyId as PolicyIdType,
  RunId as RunIdType,
  WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export const AUTONOMY_DELEGATION_OUTCOMES_V1 = [
  'auto-resolved',
  'exception-routed',
  'human-approved',
  'manual-only',
  'emergency-stop',
] as const;

export const AUTONOMY_DECISION_CONTEXTS_V1 = [
  'routine-approval',
  'exception-escalation',
  'policy-change',
] as const;

export const AUTONOMY_POLICY_LEARNING_OUTCOMES_V1 = [
  'policy-improvement',
  'policy-regression',
  'operator-load',
  'unclassified',
] as const;

export const AUTONOMY_POLICY_LEARNING_EVENT_KINDS_V1 = [
  'policy-created',
  'policy-updated',
  'policy-retired',
  'precedent-created',
  'precedent-converted',
  'replay-improvement',
  'replay-regression',
] as const;

export const AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1 = [
  'auto_resolved_action_count',
  'auto_resolved_action_ratio',
  'exception_routed_action_count',
  'exception_routed_action_ratio',
  'human_approved_action_count',
  'human_approved_action_ratio',
  'manual_only_action_count',
  'manual_only_action_ratio',
  'emergency_stop_count',
  'emergency_stop_ratio',
  'approval_volume_delta',
  'approval_volume_delta_percent',
  'repeated_exception_hotspot_count',
  'policy_churn_count',
  'precedent_to_policy_conversion_rate',
  'routine_approval_decision_ms_p50',
  'routine_approval_decision_ms_p95',
  'routine_approval_resume_ms_p50',
  'routine_approval_resume_ms_p95',
  'exception_escalation_decision_ms_p50',
  'exception_escalation_decision_ms_p95',
  'exception_escalation_resume_ms_p50',
  'exception_escalation_resume_ms_p95',
  'policy_change_decision_ms_p50',
  'policy_change_decision_ms_p95',
  'policy_change_resume_ms_p50',
  'policy_change_resume_ms_p95',
  'unsafe_action_escape_rate',
  'policy_violation_escape_rate',
  'false_escalation_rate',
] as const;

export type AutonomyDelegationOutcomeV1 = (typeof AUTONOMY_DELEGATION_OUTCOMES_V1)[number];
export type AutonomyDecisionContextV1 = (typeof AUTONOMY_DECISION_CONTEXTS_V1)[number];
export type AutonomyPolicyLearningOutcomeV1 = (typeof AUTONOMY_POLICY_LEARNING_OUTCOMES_V1)[number];
export type AutonomyPolicyLearningEventKindV1 =
  (typeof AUTONOMY_POLICY_LEARNING_EVENT_KINDS_V1)[number];
export type AutonomyDelegationScorecardMetricNameV1 =
  (typeof AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1)[number];

export type AutonomyDelegationObservationV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: WorkspaceIdType;
  observedAtIso: string;
  actionClass: string;
  executionTier: ExecutionTier;
  outcome: AutonomyDelegationOutcomeV1;
  actionId?: ActionIdType;
  runId?: RunIdType;
  decisionContext?: AutonomyDecisionContextV1;
  requestedAtIso?: string;
  decidedAtIso?: string;
  resumedAtIso?: string;
  exceptionClass?: string;
  exceptionFingerprint?: string;
  unsafeEscape?: boolean;
  policyViolationEscape?: boolean;
  falseEscalation?: boolean;
}>;

export type AutonomyPolicyLearningEventV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: WorkspaceIdType;
  occurredAtIso: string;
  eventKind: AutonomyPolicyLearningEventKindV1;
  policyId?: PolicyIdType;
  policyChangeId?: PolicyChangeIdType;
  actionClass?: string;
  exceptionFingerprint?: string;
  learningOutcome?: AutonomyPolicyLearningOutcomeV1;
}>;

export type AutonomyDelegationCountSummaryV1 = Readonly<{
  totalActions: number;
  autoResolvedActions: number;
  exceptionRoutedActions: number;
  humanApprovedActions: number;
  manualOnlyActions: number;
  emergencyStops: number;
}>;

export type AutonomyDelegationRatioSummaryV1 = Readonly<{
  autoResolvedActionRatio: number;
  exceptionRoutedActionRatio: number;
  humanApprovedActionRatio: number;
  manualOnlyActionRatio: number;
  emergencyStopRatio: number;
}>;

export type AutonomyApprovalVolumeTrendV1 = Readonly<{
  currentApprovalActions: number;
  previousApprovalActions: number;
  delta: number;
  deltaPercent: number;
  direction: 'shrinking' | 'growing' | 'flat';
}>;

export type AutonomyExceptionHotspotV1 = Readonly<{
  exceptionFingerprint: string;
  actionClass: string;
  exceptionClass?: string;
  count: number;
  learningOutcome: AutonomyPolicyLearningOutcomeV1;
  linkedPolicyChangeCount: number;
}>;

export type AutonomyPolicyChurnSummaryV1 = Readonly<{
  churnCount: number;
  createdCount: number;
  updatedCount: number;
  retiredCount: number;
  replayImprovementCount: number;
  replayRegressionCount: number;
  policyIds: readonly string[];
}>;

export type AutonomyPrecedentConversionSummaryV1 = Readonly<{
  precedentCreatedCount: number;
  precedentConvertedCount: number;
  conversionRate: number;
}>;

export type AutonomyDecisionTimingSummaryV1 = Readonly<{
  context: AutonomyDecisionContextV1;
  sampleCount: number;
  timeToDecisionMsP50: number;
  timeToDecisionMsP95: number;
  timeToResumeMsP50: number;
  timeToResumeMsP95: number;
}>;

export type AutonomyEscapeIndicatorsV1 = Readonly<{
  unsafeEscapeCount: number;
  unsafeActionEscapeRate: number;
  policyViolationEscapeCount: number;
  policyViolationEscapeRate: number;
  falseEscalationCount: number;
  falseEscalationRate: number;
}>;

export type AutonomyCockpitExportMetricRowV1 = Readonly<{
  metricName: AutonomyDelegationScorecardMetricNameV1;
  label: string;
  value: number;
  unit: 'count' | 'ratio' | 'milliseconds' | 'percent';
  posture: 'healthy' | 'watch' | 'risk';
}>;

export type AutonomyCockpitExportSeriesV1 = Readonly<{
  seriesName: string;
  points: readonly Readonly<{ timestampIso: string; value: number }>[];
}>;

export type AutonomyCockpitScorecardExportV1 = Readonly<{
  contentType: 'application/vnd.portarium.autonomy-delegation-scorecard+json';
  routeHint: '/cockpit/governance/autonomy-scorecard';
  metricRows: readonly AutonomyCockpitExportMetricRowV1[];
  trendSeries: readonly AutonomyCockpitExportSeriesV1[];
  hotspotRows: readonly AutonomyExceptionHotspotV1[];
}>;

export type AutonomyDelegationScorecardV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: WorkspaceIdType;
  generatedAtIso: string;
  window: Readonly<{ fromIso?: string; toIso: string }>;
  metricNames: readonly AutonomyDelegationScorecardMetricNameV1[];
  metrics: Readonly<Record<AutonomyDelegationScorecardMetricNameV1, number>>;
  counts: AutonomyDelegationCountSummaryV1;
  ratios: AutonomyDelegationRatioSummaryV1;
  approvalVolumeTrend: AutonomyApprovalVolumeTrendV1;
  repeatedExceptionHotspots: readonly AutonomyExceptionHotspotV1[];
  policyChurn: AutonomyPolicyChurnSummaryV1;
  precedentConversion: AutonomyPrecedentConversionSummaryV1;
  timeBreakdown: readonly AutonomyDecisionTimingSummaryV1[];
  escapeIndicators: AutonomyEscapeIndicatorsV1;
  cockpitExport: AutonomyCockpitScorecardExportV1;
}>;

export type BuildAutonomyDelegationScorecardParamsV1 = Readonly<{
  workspaceId: WorkspaceIdType;
  generatedAtIso: string;
  observations: readonly AutonomyDelegationObservationV1[];
  policyLearningEvents?: readonly AutonomyPolicyLearningEventV1[];
  previousWindowObservations?: readonly AutonomyDelegationObservationV1[];
  fromIso?: string;
  hotspotMinimumCount?: number;
}>;

const DECISION_CONTEXTS = AUTONOMY_DECISION_CONTEXTS_V1;
const APPROVAL_OUTCOMES: readonly AutonomyDelegationOutcomeV1[] = [
  'exception-routed',
  'human-approved',
];
const CHURN_EVENTS: readonly AutonomyPolicyLearningEventKindV1[] = [
  'policy-created',
  'policy-updated',
  'policy-retired',
];

export function buildAutonomyDelegationScorecardV1(
  params: BuildAutonomyDelegationScorecardParamsV1,
): AutonomyDelegationScorecardV1 {
  const observations = filterWindow(
    params.observations.filter((observation) => observation.workspaceId === params.workspaceId),
    params.fromIso,
    params.generatedAtIso,
    (observation) => observation.observedAtIso,
  );
  const previousObservations = (params.previousWindowObservations ?? []).filter(
    (observation) => observation.workspaceId === params.workspaceId,
  );
  const learningEvents = filterWindow(
    (params.policyLearningEvents ?? []).filter((event) => event.workspaceId === params.workspaceId),
    params.fromIso,
    params.generatedAtIso,
    (event) => event.occurredAtIso,
  );

  const counts = buildCounts(observations);
  const ratios = buildRatios(counts);
  const approvalVolumeTrend = buildApprovalVolumeTrend(observations, previousObservations);
  const repeatedExceptionHotspots = buildHotspots({
    observations,
    learningEvents,
    hotspotMinimumCount: params.hotspotMinimumCount ?? 2,
  });
  const policyChurn = buildPolicyChurn(learningEvents);
  const precedentConversion = buildPrecedentConversion(learningEvents);
  const timeBreakdown = DECISION_CONTEXTS.map((context) =>
    buildTimingSummary(context, observations),
  );
  const escapeIndicators = buildEscapeIndicators(observations);
  const metrics = buildMetrics({
    counts,
    ratios,
    approvalVolumeTrend,
    repeatedExceptionHotspots,
    policyChurn,
    precedentConversion,
    timeBreakdown,
    escapeIndicators,
  });
  const scorecardWithoutExport = {
    schemaVersion: 1,
    workspaceId: params.workspaceId,
    generatedAtIso: params.generatedAtIso,
    window: {
      ...(params.fromIso !== undefined ? { fromIso: params.fromIso } : {}),
      toIso: params.generatedAtIso,
    },
    metricNames: AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1,
    metrics,
    counts,
    ratios,
    approvalVolumeTrend,
    repeatedExceptionHotspots,
    policyChurn,
    precedentConversion,
    timeBreakdown,
    escapeIndicators,
  } satisfies Omit<AutonomyDelegationScorecardV1, 'cockpitExport'>;

  return deepFreeze({
    ...scorecardWithoutExport,
    cockpitExport: buildCockpitScorecardExportV1(scorecardWithoutExport),
  });
}

export function buildCockpitScorecardExportV1(
  scorecard: Omit<AutonomyDelegationScorecardV1, 'cockpitExport'>,
): AutonomyCockpitScorecardExportV1 {
  return {
    contentType: 'application/vnd.portarium.autonomy-delegation-scorecard+json',
    routeHint: '/cockpit/governance/autonomy-scorecard',
    metricRows: scorecard.metricNames.map((metricName) =>
      metricRow(
        metricName,
        labelForMetric(metricName),
        scorecard.metrics[metricName],
        unitForMetric(metricName),
        postureForMetric(scorecard, metricName),
      ),
    ),
    trendSeries: [
      {
        seriesName: 'approval_volume',
        points: [
          {
            timestampIso: scorecard.generatedAtIso,
            value: scorecard.approvalVolumeTrend.currentApprovalActions,
          },
        ],
      },
      {
        seriesName: 'policy_churn',
        points: [
          { timestampIso: scorecard.generatedAtIso, value: scorecard.policyChurn.churnCount },
        ],
      },
    ],
    hotspotRows: scorecard.repeatedExceptionHotspots,
  };
}

function buildMetrics(input: {
  counts: AutonomyDelegationCountSummaryV1;
  ratios: AutonomyDelegationRatioSummaryV1;
  approvalVolumeTrend: AutonomyApprovalVolumeTrendV1;
  repeatedExceptionHotspots: readonly AutonomyExceptionHotspotV1[];
  policyChurn: AutonomyPolicyChurnSummaryV1;
  precedentConversion: AutonomyPrecedentConversionSummaryV1;
  timeBreakdown: readonly AutonomyDecisionTimingSummaryV1[];
  escapeIndicators: AutonomyEscapeIndicatorsV1;
}): Readonly<Record<AutonomyDelegationScorecardMetricNameV1, number>> {
  const routine = timingFor(input.timeBreakdown, 'routine-approval');
  const exception = timingFor(input.timeBreakdown, 'exception-escalation');
  const policyChange = timingFor(input.timeBreakdown, 'policy-change');
  return {
    auto_resolved_action_count: input.counts.autoResolvedActions,
    auto_resolved_action_ratio: input.ratios.autoResolvedActionRatio,
    exception_routed_action_count: input.counts.exceptionRoutedActions,
    exception_routed_action_ratio: input.ratios.exceptionRoutedActionRatio,
    human_approved_action_count: input.counts.humanApprovedActions,
    human_approved_action_ratio: input.ratios.humanApprovedActionRatio,
    manual_only_action_count: input.counts.manualOnlyActions,
    manual_only_action_ratio: input.ratios.manualOnlyActionRatio,
    emergency_stop_count: input.counts.emergencyStops,
    emergency_stop_ratio: input.ratios.emergencyStopRatio,
    approval_volume_delta: input.approvalVolumeTrend.delta,
    approval_volume_delta_percent: input.approvalVolumeTrend.deltaPercent,
    repeated_exception_hotspot_count: input.repeatedExceptionHotspots.length,
    policy_churn_count: input.policyChurn.churnCount,
    precedent_to_policy_conversion_rate: input.precedentConversion.conversionRate,
    routine_approval_decision_ms_p50: routine.timeToDecisionMsP50,
    routine_approval_decision_ms_p95: routine.timeToDecisionMsP95,
    routine_approval_resume_ms_p50: routine.timeToResumeMsP50,
    routine_approval_resume_ms_p95: routine.timeToResumeMsP95,
    exception_escalation_decision_ms_p50: exception.timeToDecisionMsP50,
    exception_escalation_decision_ms_p95: exception.timeToDecisionMsP95,
    exception_escalation_resume_ms_p50: exception.timeToResumeMsP50,
    exception_escalation_resume_ms_p95: exception.timeToResumeMsP95,
    policy_change_decision_ms_p50: policyChange.timeToDecisionMsP50,
    policy_change_decision_ms_p95: policyChange.timeToDecisionMsP95,
    policy_change_resume_ms_p50: policyChange.timeToResumeMsP50,
    policy_change_resume_ms_p95: policyChange.timeToResumeMsP95,
    unsafe_action_escape_rate: input.escapeIndicators.unsafeActionEscapeRate,
    policy_violation_escape_rate: input.escapeIndicators.policyViolationEscapeRate,
    false_escalation_rate: input.escapeIndicators.falseEscalationRate,
  };
}

function buildCounts(
  observations: readonly AutonomyDelegationObservationV1[],
): AutonomyDelegationCountSummaryV1 {
  return {
    totalActions: observations.length,
    autoResolvedActions: countOutcome(observations, 'auto-resolved'),
    exceptionRoutedActions: countOutcome(observations, 'exception-routed'),
    humanApprovedActions: countOutcome(observations, 'human-approved'),
    manualOnlyActions: countOutcome(observations, 'manual-only'),
    emergencyStops: countOutcome(observations, 'emergency-stop'),
  };
}

function buildRatios(counts: AutonomyDelegationCountSummaryV1): AutonomyDelegationRatioSummaryV1 {
  return {
    autoResolvedActionRatio: ratio(counts.autoResolvedActions, counts.totalActions),
    exceptionRoutedActionRatio: ratio(counts.exceptionRoutedActions, counts.totalActions),
    humanApprovedActionRatio: ratio(counts.humanApprovedActions, counts.totalActions),
    manualOnlyActionRatio: ratio(counts.manualOnlyActions, counts.totalActions),
    emergencyStopRatio: ratio(counts.emergencyStops, counts.totalActions),
  };
}

function buildApprovalVolumeTrend(
  observations: readonly AutonomyDelegationObservationV1[],
  previousObservations: readonly AutonomyDelegationObservationV1[],
): AutonomyApprovalVolumeTrendV1 {
  const currentApprovalActions = countApprovalActions(observations);
  const previousApprovalActions = countApprovalActions(previousObservations);
  const delta = currentApprovalActions - previousApprovalActions;
  return {
    currentApprovalActions,
    previousApprovalActions,
    delta,
    deltaPercent: ratio(delta, previousApprovalActions),
    direction: delta < 0 ? 'shrinking' : delta > 0 ? 'growing' : 'flat',
  };
}

function buildHotspots(params: {
  observations: readonly AutonomyDelegationObservationV1[];
  learningEvents: readonly AutonomyPolicyLearningEventV1[];
  hotspotMinimumCount: number;
}): readonly AutonomyExceptionHotspotV1[] {
  const groups = new Map<string, AutonomyDelegationObservationV1[]>();
  for (const observation of params.observations) {
    if (observation.exceptionFingerprint === undefined) continue;
    groups.set(observation.exceptionFingerprint, [
      ...(groups.get(observation.exceptionFingerprint) ?? []),
      observation,
    ]);
  }

  return [...groups.entries()]
    .map(([exceptionFingerprint, observations]) => {
      const first = observations[0];
      if (first === undefined) {
        throw new Error('Exception hotspot group must not be empty.');
      }
      const linkedEvents = params.learningEvents.filter(
        (event) => event.exceptionFingerprint === exceptionFingerprint,
      );
      const learningOutcome =
        linkedEvents.find((event) => event.learningOutcome !== undefined)?.learningOutcome ??
        inferLearningOutcome(observations);
      return {
        exceptionFingerprint,
        actionClass: first.actionClass,
        ...(first.exceptionClass !== undefined ? { exceptionClass: first.exceptionClass } : {}),
        count: observations.length,
        learningOutcome,
        linkedPolicyChangeCount: linkedEvents.filter((event) => event.policyChangeId !== undefined)
          .length,
      };
    })
    .filter((hotspot) => hotspot.count >= params.hotspotMinimumCount)
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.exceptionFingerprint.localeCompare(right.exceptionFingerprint),
    );
}

function buildPolicyChurn(
  learningEvents: readonly AutonomyPolicyLearningEventV1[],
): AutonomyPolicyChurnSummaryV1 {
  const churnEvents = learningEvents.filter((event) => CHURN_EVENTS.includes(event.eventKind));
  const policyIds = new Set<string>();
  for (const event of churnEvents) {
    if (event.policyId !== undefined) policyIds.add(String(event.policyId));
  }
  return {
    churnCount: churnEvents.length,
    createdCount: learningEvents.filter((event) => event.eventKind === 'policy-created').length,
    updatedCount: learningEvents.filter((event) => event.eventKind === 'policy-updated').length,
    retiredCount: learningEvents.filter((event) => event.eventKind === 'policy-retired').length,
    replayImprovementCount: learningEvents.filter(
      (event) => event.eventKind === 'replay-improvement',
    ).length,
    replayRegressionCount: learningEvents.filter((event) => event.eventKind === 'replay-regression')
      .length,
    policyIds: [...policyIds].sort(),
  };
}

function buildPrecedentConversion(
  learningEvents: readonly AutonomyPolicyLearningEventV1[],
): AutonomyPrecedentConversionSummaryV1 {
  const precedentCreatedCount = learningEvents.filter(
    (event) => event.eventKind === 'precedent-created',
  ).length;
  const precedentConvertedCount = learningEvents.filter(
    (event) => event.eventKind === 'precedent-converted',
  ).length;
  return {
    precedentCreatedCount,
    precedentConvertedCount,
    conversionRate: ratio(precedentConvertedCount, precedentCreatedCount),
  };
}

function buildTimingSummary(
  context: AutonomyDecisionContextV1,
  observations: readonly AutonomyDelegationObservationV1[],
): AutonomyDecisionTimingSummaryV1 {
  const relevant = observations.filter((observation) => observation.decisionContext === context);
  const decisionDurations = relevant
    .map((observation) => durationBetween(observation.requestedAtIso, observation.decidedAtIso))
    .filter((value): value is number => value !== undefined);
  const resumeDurations = relevant
    .map((observation) => durationBetween(observation.decidedAtIso, observation.resumedAtIso))
    .filter((value): value is number => value !== undefined);
  return {
    context,
    sampleCount: relevant.length,
    timeToDecisionMsP50: percentile(decisionDurations, 50),
    timeToDecisionMsP95: percentile(decisionDurations, 95),
    timeToResumeMsP50: percentile(resumeDurations, 50),
    timeToResumeMsP95: percentile(resumeDurations, 95),
  };
}

function buildEscapeIndicators(
  observations: readonly AutonomyDelegationObservationV1[],
): AutonomyEscapeIndicatorsV1 {
  const governedCount = observations.length;
  const escalatedCount = observations.filter((observation) =>
    APPROVAL_OUTCOMES.includes(observation.outcome),
  ).length;
  const unsafeEscapeCount = observations.filter((observation) => observation.unsafeEscape).length;
  const policyViolationEscapeCount = observations.filter(
    (observation) => observation.policyViolationEscape,
  ).length;
  const falseEscalationCount = observations.filter(
    (observation) => observation.falseEscalation,
  ).length;
  return {
    unsafeEscapeCount,
    unsafeActionEscapeRate: ratio(unsafeEscapeCount, governedCount),
    policyViolationEscapeCount,
    policyViolationEscapeRate: ratio(policyViolationEscapeCount, governedCount),
    falseEscalationCount,
    falseEscalationRate: ratio(falseEscalationCount, escalatedCount),
  };
}

function inferLearningOutcome(
  observations: readonly AutonomyDelegationObservationV1[],
): AutonomyPolicyLearningOutcomeV1 {
  if (observations.some((observation) => observation.unsafeEscape)) return 'policy-regression';
  if (observations.some((observation) => observation.falseEscalation)) return 'operator-load';
  return 'unclassified';
}

function filterWindow<T>(
  items: readonly T[],
  fromIso: string | undefined,
  toIso: string,
  getIso: (item: T) => string,
): readonly T[] {
  return items.filter((item) => {
    const timestamp = Date.parse(getIso(item));
    return (
      (fromIso === undefined || timestamp >= Date.parse(fromIso)) && timestamp <= Date.parse(toIso)
    );
  });
}

function countOutcome(
  observations: readonly AutonomyDelegationObservationV1[],
  outcome: AutonomyDelegationOutcomeV1,
): number {
  return observations.filter((observation) => observation.outcome === outcome).length;
}

function countApprovalActions(observations: readonly AutonomyDelegationObservationV1[]): number {
  return observations.filter((observation) => APPROVAL_OUTCOMES.includes(observation.outcome))
    .length;
}

function durationBetween(
  startIso: string | undefined,
  endIso: string | undefined,
): number | undefined {
  if (startIso === undefined || endIso === undefined) return undefined;
  return Math.max(0, Date.parse(endIso) - Date.parse(startIso));
}

function percentile(values: readonly number[], percentileRank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

function metricRow(
  metricName: AutonomyDelegationScorecardMetricNameV1,
  label: string,
  value: number,
  unit: AutonomyCockpitExportMetricRowV1['unit'],
  posture: AutonomyCockpitExportMetricRowV1['posture'],
): AutonomyCockpitExportMetricRowV1 {
  return { metricName, label, value, unit, posture };
}

function timingFor(
  summaries: readonly AutonomyDecisionTimingSummaryV1[],
  context: AutonomyDecisionContextV1,
): AutonomyDecisionTimingSummaryV1 {
  const summary = summaries.find((item) => item.context === context);
  if (summary === undefined) {
    return {
      context,
      sampleCount: 0,
      timeToDecisionMsP50: 0,
      timeToDecisionMsP95: 0,
      timeToResumeMsP50: 0,
      timeToResumeMsP95: 0,
    };
  }
  return summary;
}

function labelForMetric(metricName: AutonomyDelegationScorecardMetricNameV1): string {
  const labels: Readonly<Record<AutonomyDelegationScorecardMetricNameV1, string>> = {
    auto_resolved_action_count: 'Auto-resolved Actions',
    auto_resolved_action_ratio: 'Auto-resolved Action ratio',
    exception_routed_action_count: 'Exception-routed Actions',
    exception_routed_action_ratio: 'Exception-routed Action ratio',
    human_approved_action_count: 'Human-approved Actions',
    human_approved_action_ratio: 'Human-approved Action ratio',
    manual_only_action_count: 'Manual-only Actions',
    manual_only_action_ratio: 'Manual-only Action ratio',
    emergency_stop_count: 'Emergency stops',
    emergency_stop_ratio: 'Emergency-stop ratio',
    approval_volume_delta: 'Approval-volume delta',
    approval_volume_delta_percent: 'Approval-volume delta percent',
    repeated_exception_hotspot_count: 'Repeated exception hotspots',
    policy_churn_count: 'Policy churn',
    precedent_to_policy_conversion_rate: 'Precedent-to-policy conversion',
    routine_approval_decision_ms_p50: 'Routine approval decision p50',
    routine_approval_decision_ms_p95: 'Routine approval decision p95',
    routine_approval_resume_ms_p50: 'Routine approval resume p50',
    routine_approval_resume_ms_p95: 'Routine approval resume p95',
    exception_escalation_decision_ms_p50: 'Exception escalation decision p50',
    exception_escalation_decision_ms_p95: 'Exception escalation decision p95',
    exception_escalation_resume_ms_p50: 'Exception escalation resume p50',
    exception_escalation_resume_ms_p95: 'Exception escalation resume p95',
    policy_change_decision_ms_p50: 'Policy change decision p50',
    policy_change_decision_ms_p95: 'Policy change decision p95',
    policy_change_resume_ms_p50: 'Policy change resume p50',
    policy_change_resume_ms_p95: 'Policy change resume p95',
    unsafe_action_escape_rate: 'Unsafe-action escape rate',
    policy_violation_escape_rate: 'Policy-violation escape rate',
    false_escalation_rate: 'False-escalation rate',
  };
  return labels[metricName];
}

function unitForMetric(
  metricName: AutonomyDelegationScorecardMetricNameV1,
): AutonomyCockpitExportMetricRowV1['unit'] {
  if (metricName.endsWith('_count') || metricName === 'approval_volume_delta') return 'count';
  if (metricName.includes('_ms_')) return 'milliseconds';
  return 'ratio';
}

function postureForMetric(
  scorecard: Omit<AutonomyDelegationScorecardV1, 'cockpitExport'>,
  metricName: AutonomyDelegationScorecardMetricNameV1,
): AutonomyCockpitExportMetricRowV1['posture'] {
  if (
    metricName === 'unsafe_action_escape_rate' ||
    metricName === 'policy_violation_escape_rate' ||
    metricName === 'emergency_stop_count' ||
    metricName === 'emergency_stop_ratio'
  ) {
    return scorecard.metrics[metricName] === 0 ? 'healthy' : 'risk';
  }
  if (metricName === 'false_escalation_rate') {
    return scorecard.metrics[metricName] <= 0.1 ? 'healthy' : 'watch';
  }
  if (metricName === 'precedent_to_policy_conversion_rate') {
    return scorecard.precedentConversion.precedentCreatedCount === 0 ||
      scorecard.metrics[metricName] >= 0.25
      ? 'healthy'
      : 'watch';
  }
  if (metricName === 'human_approved_action_count') {
    return scorecard.approvalVolumeTrend.direction === 'shrinking' ? 'healthy' : 'watch';
  }
  return 'healthy';
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

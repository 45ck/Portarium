import type {
  RunId as RunIdType,
  WorkflowId as WorkflowIdType,
  WorkforceMemberId as WorkforceMemberIdType,
  WorkItemId as WorkItemIdType,
  WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export const GOVERNED_PILOT_USEFULNESS_SCORECARD_METRIC_NAMES_V1 = [
  'operator_minutes_per_run',
  'approval_latency_ms_p50',
  'approval_latency_ms_p95',
  'blocked_duration_ms_p50',
  'blocked_duration_ms_p95',
  'throughput_per_operator_per_day',
  'throughput_per_workspace_per_day',
  'denial_rate',
  'rework_rate',
  'duplicate_execution_rate',
  'unsafe_action_escape_rate',
  'policy_violation_escape_rate',
  'cost_per_useful_outcome',
  'model_cost_per_useful_outcome',
  'tool_cost_per_useful_outcome',
  'operator_cost_per_useful_outcome',
  'business_kpi_delta_primary',
  'business_kpi_delta_secondary',
  'useful_outcome_count',
  'baseline_comparison_confidence',
  'baseline_sample_size_runs',
  'pilot_sample_size_runs',
] as const;

export type GovernedPilotUsefulnessMetricNameV1 =
  (typeof GOVERNED_PILOT_USEFULNESS_SCORECARD_METRIC_NAMES_V1)[number];

export type GovernedPilotRatingV1 = 'Success' | 'Concern' | 'Failure';
export type BaselineComparisonConfidenceV1 = 'high' | 'medium' | 'low';
export type GovernedPilotMetricValueV1 = number | BaselineComparisonConfidenceV1;
export type GovernedPilotMetricPostureV1 = 'healthy' | 'watch' | 'risk';

export type GovernedPilotObservationV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: WorkspaceIdType;
  workflowId: WorkflowIdType;
  workflowName: string;
  observedAtIso: string;
  usefulOutcomeAccepted: boolean;
  activeOperatorMinutes: number;
  runId?: RunIdType;
  workItemId?: WorkItemIdType;
  operatorId?: WorkforceMemberIdType;
  workingDayIso?: string;
  approvalLatencyMs?: number;
  blockedDurationMs?: number;
  decidedApprovalCount?: number;
  deniedApprovalCount?: number;
  requestChangesCount?: number;
  reworkCount?: number;
  externallyEffectfulActionCount?: number;
  duplicateExternallyEffectfulActionCount?: number;
  governedActionCount?: number;
  unsafeActionEscapeCount?: number;
  policyViolationEscapeCount?: number;
  modelCost?: number;
  toolCost?: number;
  operatorCost?: number;
  businessKpiPrimaryValue?: number;
  businessKpiSecondaryValue?: number;
  dataSource?: string;
}>;

export type GovernedPilotWorkflowDefinitionV1 = Readonly<{
  workflowName: string;
  workflowId?: WorkflowIdType;
  usefulOutcomeDefinition: string;
  processOwner: string;
  includedActionClasses: readonly string[];
  excludedActionClasses: readonly string[];
  primaryBusinessKpi: string;
  secondaryBusinessKpi?: string;
}>;

export type GovernedPilotMetricRowV1 = Readonly<{
  metricName: GovernedPilotUsefulnessMetricNameV1;
  label: string;
  unit: 'minutes' | 'milliseconds' | 'outcomes_per_day' | 'ratio' | 'currency' | 'count' | 'enum';
  baselineValue?: GovernedPilotMetricValueV1;
  pilotValue: GovernedPilotMetricValueV1;
  delta?: number;
  rating: GovernedPilotRatingV1;
  posture: GovernedPilotMetricPostureV1;
  dataSource: string;
}>;

export type GovernedPilotGuardrailSummaryV1 = Readonly<{
  duplicateExecutionRate: number;
  unsafeActionEscapeRate: number;
  policyViolationEscapeRate: number;
  vetoTriggered: boolean;
}>;

export type GovernedPilotScorecardExportV1 = Readonly<{
  contentType: 'application/vnd.portarium.governed-pilot-usefulness-scorecard+json';
  routeHint: '/cockpit/governance/pilot-usefulness-scorecard';
  metricRows: readonly GovernedPilotMetricRowV1[];
  guardrails: GovernedPilotGuardrailSummaryV1;
  finalRating: GovernedPilotRatingV1;
  concernAndFailureRows: readonly GovernedPilotMetricRowV1[];
}>;

export type GovernedPilotUsefulnessScorecardV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: WorkspaceIdType;
  generatedAtIso: string;
  workflow: GovernedPilotWorkflowDefinitionV1;
  baselineWindow: Readonly<{ fromIso?: string; toIso?: string }>;
  pilotWindow: Readonly<{ fromIso?: string; toIso: string }>;
  metricNames: readonly GovernedPilotUsefulnessMetricNameV1[];
  metrics: Readonly<Record<GovernedPilotUsefulnessMetricNameV1, GovernedPilotMetricValueV1>>;
  metricRows: readonly GovernedPilotMetricRowV1[];
  guardrails: GovernedPilotGuardrailSummaryV1;
  baselineComparisonConfidence: BaselineComparisonConfidenceV1;
  finalRating: GovernedPilotRatingV1;
  decisionRationale: readonly string[];
  cockpitExport: GovernedPilotScorecardExportV1;
}>;

export type BuildGovernedPilotUsefulnessScorecardParamsV1 = Readonly<{
  workspaceId: WorkspaceIdType;
  generatedAtIso: string;
  workflow: GovernedPilotWorkflowDefinitionV1;
  baselineObservations: readonly GovernedPilotObservationV1[];
  pilotObservations: readonly GovernedPilotObservationV1[];
  pilotFromIso?: string;
  baselineFromIso?: string;
  baselineToIso?: string;
  dataSource?: string;
}>;

type PhaseSummary = Readonly<{
  sampleSizeRuns: number;
  usefulOutcomeCount: number;
  operatorMinutesPerRun: number;
  approvalLatencyMsP50: number;
  approvalLatencyMsP95: number;
  blockedDurationMsP50: number;
  blockedDurationMsP95: number;
  throughputPerOperatorPerDay: number;
  throughputPerWorkspacePerDay: number;
  denialRate: number;
  reworkRate: number;
  duplicateExecutionRate: number;
  unsafeActionEscapeRate: number;
  policyViolationEscapeRate: number;
  costPerUsefulOutcome: number;
  modelCostPerUsefulOutcome: number;
  toolCostPerUsefulOutcome: number;
  operatorCostPerUsefulOutcome: number;
  primaryBusinessKpiAverage: number;
  secondaryBusinessKpiAverage: number;
}>;

const SAFETY_VETO_METRICS: readonly GovernedPilotUsefulnessMetricNameV1[] = [
  'duplicate_execution_rate',
  'unsafe_action_escape_rate',
  'policy_violation_escape_rate',
];

export function buildGovernedPilotUsefulnessScorecardV1(
  params: BuildGovernedPilotUsefulnessScorecardParamsV1,
): GovernedPilotUsefulnessScorecardV1 {
  const baselineObservations = filterWindow(
    params.baselineObservations.filter(
      (observation) => observation.workspaceId === params.workspaceId,
    ),
    params.baselineFromIso,
    params.baselineToIso,
    (observation) => observation.observedAtIso,
  );
  const pilotObservations = filterWindow(
    params.pilotObservations.filter(
      (observation) => observation.workspaceId === params.workspaceId,
    ),
    params.pilotFromIso,
    params.generatedAtIso,
    (observation) => observation.observedAtIso,
  );
  const baseline = summarizePhase(baselineObservations);
  const pilot = summarizePhase(pilotObservations);
  const baselineComparisonConfidence = inferBaselineComparisonConfidence(baselineObservations);
  const metrics = buildMetrics({ baseline, pilot, baselineComparisonConfidence });
  const guardrails = buildGuardrails(pilot);
  const metricRows = buildMetricRows({
    baseline,
    pilot,
    metrics,
    baselineComparisonConfidence,
    dataSource: params.dataSource ?? summarizeDataSources(baselineObservations, pilotObservations),
  });
  const finalRating = decideFinalRating({
    baseline,
    pilot,
    baselineComparisonConfidence,
    guardrails,
  });
  const decisionRationale = buildDecisionRationale({
    baseline,
    pilot,
    baselineComparisonConfidence,
    guardrails,
    finalRating,
  });
  const scorecardWithoutExport = {
    schemaVersion: 1,
    workspaceId: params.workspaceId,
    generatedAtIso: params.generatedAtIso,
    workflow: params.workflow,
    baselineWindow: windowObject(params.baselineFromIso, params.baselineToIso),
    pilotWindow: {
      ...(params.pilotFromIso ? { fromIso: params.pilotFromIso } : {}),
      toIso: params.generatedAtIso,
    },
    metricNames: GOVERNED_PILOT_USEFULNESS_SCORECARD_METRIC_NAMES_V1,
    metrics,
    metricRows,
    guardrails,
    baselineComparisonConfidence,
    finalRating,
    decisionRationale,
  } satisfies Omit<GovernedPilotUsefulnessScorecardV1, 'cockpitExport'>;

  return deepFreeze({
    ...scorecardWithoutExport,
    cockpitExport: buildGovernedPilotScorecardExportV1(scorecardWithoutExport),
  });
}

export function buildGovernedPilotScorecardExportV1(
  scorecard: Omit<GovernedPilotUsefulnessScorecardV1, 'cockpitExport'>,
): GovernedPilotScorecardExportV1 {
  return {
    contentType: 'application/vnd.portarium.governed-pilot-usefulness-scorecard+json',
    routeHint: '/cockpit/governance/pilot-usefulness-scorecard',
    metricRows: scorecard.metricRows,
    guardrails: scorecard.guardrails,
    finalRating: scorecard.finalRating,
    concernAndFailureRows: scorecard.metricRows.filter((row) => row.rating !== 'Success'),
  };
}

function buildMetrics(input: {
  baseline: PhaseSummary;
  pilot: PhaseSummary;
  baselineComparisonConfidence: BaselineComparisonConfidenceV1;
}): Readonly<Record<GovernedPilotUsefulnessMetricNameV1, GovernedPilotMetricValueV1>> {
  return {
    operator_minutes_per_run: input.pilot.operatorMinutesPerRun,
    approval_latency_ms_p50: input.pilot.approvalLatencyMsP50,
    approval_latency_ms_p95: input.pilot.approvalLatencyMsP95,
    blocked_duration_ms_p50: input.pilot.blockedDurationMsP50,
    blocked_duration_ms_p95: input.pilot.blockedDurationMsP95,
    throughput_per_operator_per_day: input.pilot.throughputPerOperatorPerDay,
    throughput_per_workspace_per_day: input.pilot.throughputPerWorkspacePerDay,
    denial_rate: input.pilot.denialRate,
    rework_rate: input.pilot.reworkRate,
    duplicate_execution_rate: input.pilot.duplicateExecutionRate,
    unsafe_action_escape_rate: input.pilot.unsafeActionEscapeRate,
    policy_violation_escape_rate: input.pilot.policyViolationEscapeRate,
    cost_per_useful_outcome: input.pilot.costPerUsefulOutcome,
    model_cost_per_useful_outcome: input.pilot.modelCostPerUsefulOutcome,
    tool_cost_per_useful_outcome: input.pilot.toolCostPerUsefulOutcome,
    operator_cost_per_useful_outcome: input.pilot.operatorCostPerUsefulOutcome,
    business_kpi_delta_primary: relativeDelta(
      input.pilot.primaryBusinessKpiAverage,
      input.baseline.primaryBusinessKpiAverage,
    ),
    business_kpi_delta_secondary: relativeDelta(
      input.pilot.secondaryBusinessKpiAverage,
      input.baseline.secondaryBusinessKpiAverage,
    ),
    useful_outcome_count: input.pilot.usefulOutcomeCount,
    baseline_comparison_confidence: input.baselineComparisonConfidence,
    baseline_sample_size_runs: input.baseline.sampleSizeRuns,
    pilot_sample_size_runs: input.pilot.sampleSizeRuns,
  };
}

function summarizePhase(observations: readonly GovernedPilotObservationV1[]): PhaseSummary {
  const usefulOutcomeCount = observations.filter(
    (observation) => observation.usefulOutcomeAccepted,
  ).length;
  const externallyEffectfulActionCount = sum(observations, 'externallyEffectfulActionCount');
  const governedActionCount = sum(observations, 'governedActionCount');
  const totalCost =
    sum(observations, 'modelCost') +
    sum(observations, 'toolCost') +
    sum(observations, 'operatorCost');
  return {
    sampleSizeRuns: observations.length,
    usefulOutcomeCount,
    operatorMinutesPerRun: average(
      observations.map((observation) => observation.activeOperatorMinutes),
    ),
    approvalLatencyMsP50: percentile(
      compactNumbers(observations.map((observation) => observation.approvalLatencyMs)),
      50,
    ),
    approvalLatencyMsP95: percentile(
      compactNumbers(observations.map((observation) => observation.approvalLatencyMs)),
      95,
    ),
    blockedDurationMsP50: percentile(
      compactNumbers(observations.map((observation) => observation.blockedDurationMs)),
      50,
    ),
    blockedDurationMsP95: percentile(
      compactNumbers(observations.map((observation) => observation.blockedDurationMs)),
      95,
    ),
    throughputPerOperatorPerDay: ratio(
      usefulOutcomeCount,
      distinctOperatorWorkingDays(observations),
    ),
    throughputPerWorkspacePerDay: ratio(
      usefulOutcomeCount,
      distinctWorkspaceWorkingDays(observations),
    ),
    denialRate: ratio(
      sum(observations, 'deniedApprovalCount'),
      sum(observations, 'decidedApprovalCount'),
    ),
    reworkRate: ratio(
      sum(observations, 'reworkCount') + sum(observations, 'requestChangesCount'),
      observations.length,
    ),
    duplicateExecutionRate: ratio(
      sum(observations, 'duplicateExternallyEffectfulActionCount'),
      externallyEffectfulActionCount,
    ),
    unsafeActionEscapeRate: ratio(
      sum(observations, 'unsafeActionEscapeCount'),
      governedActionCount,
    ),
    policyViolationEscapeRate: ratio(
      sum(observations, 'policyViolationEscapeCount'),
      governedActionCount,
    ),
    costPerUsefulOutcome: ratio(totalCost, usefulOutcomeCount),
    modelCostPerUsefulOutcome: ratio(sum(observations, 'modelCost'), usefulOutcomeCount),
    toolCostPerUsefulOutcome: ratio(sum(observations, 'toolCost'), usefulOutcomeCount),
    operatorCostPerUsefulOutcome: ratio(sum(observations, 'operatorCost'), usefulOutcomeCount),
    primaryBusinessKpiAverage: average(
      compactNumbers(observations.map((observation) => observation.businessKpiPrimaryValue)),
    ),
    secondaryBusinessKpiAverage: average(
      compactNumbers(observations.map((observation) => observation.businessKpiSecondaryValue)),
    ),
  };
}

function buildMetricRows(input: {
  baseline: PhaseSummary;
  pilot: PhaseSummary;
  metrics: Readonly<Record<GovernedPilotUsefulnessMetricNameV1, GovernedPilotMetricValueV1>>;
  baselineComparisonConfidence: BaselineComparisonConfidenceV1;
  dataSource: string;
}): readonly GovernedPilotMetricRowV1[] {
  return GOVERNED_PILOT_USEFULNESS_SCORECARD_METRIC_NAMES_V1.map((metricName) => {
    const baselineValue = baselineValueForMetric(metricName, input.baseline);
    const pilotValue = input.metrics[metricName];
    const delta =
      typeof baselineValue === 'number' && typeof pilotValue === 'number'
        ? relativeDelta(pilotValue, baselineValue)
        : undefined;
    const row = {
      metricName,
      label: labelForMetric(metricName),
      unit: unitForMetric(metricName),
      ...(baselineValue !== undefined ? { baselineValue } : {}),
      pilotValue,
      ...(delta !== undefined ? { delta } : {}),
      rating: ratingForMetric({
        metricName,
        baselineValue,
        pilotValue,
        baselineComparisonConfidence: input.baselineComparisonConfidence,
      }),
      posture: postureForMetric(metricName, pilotValue),
      dataSource: input.dataSource,
    };
    return row;
  });
}

function decideFinalRating(input: {
  baseline: PhaseSummary;
  pilot: PhaseSummary;
  baselineComparisonConfidence: BaselineComparisonConfidenceV1;
  guardrails: GovernedPilotGuardrailSummaryV1;
}): GovernedPilotRatingV1 {
  const operatorMinutesReduction = relativeImprovementLowerIsBetter(
    input.baseline.operatorMinutesPerRun,
    input.pilot.operatorMinutesPerRun,
  );
  const throughputGain = relativeDelta(
    input.pilot.throughputPerOperatorPerDay,
    input.baseline.throughputPerOperatorPerDay,
  );
  const primaryKpiDelta = relativeDelta(
    input.pilot.primaryBusinessKpiAverage,
    input.baseline.primaryBusinessKpiAverage,
  );
  const costDelta = relativeDelta(
    input.pilot.costPerUsefulOutcome,
    input.baseline.costPerUsefulOutcome,
  );

  if (
    input.baselineComparisonConfidence === 'low' ||
    input.guardrails.vetoTriggered ||
    primaryKpiDelta < -0.05 ||
    (costDelta > 0.15 && primaryKpiDelta <= 0) ||
    Math.max(operatorMinutesReduction, throughputGain) < 0.05
  ) {
    return 'Failure';
  }

  if ((operatorMinutesReduction >= 0.2 || throughputGain >= 0.2) && primaryKpiDelta >= 0) {
    return 'Success';
  }

  return 'Concern';
}

function buildDecisionRationale(input: {
  baseline: PhaseSummary;
  pilot: PhaseSummary;
  baselineComparisonConfidence: BaselineComparisonConfidenceV1;
  guardrails: GovernedPilotGuardrailSummaryV1;
  finalRating: GovernedPilotRatingV1;
}): readonly string[] {
  const rationales: string[] = [`Final rating: ${input.finalRating}.`];
  if (input.baselineComparisonConfidence === 'low') {
    rationales.push('Baseline comparison confidence is low, so the pilot cannot claim Success.');
  }
  if (input.guardrails.vetoTriggered) {
    rationales.push(
      'Duplicate execution, unsafe-action escape, or policy-violation escape triggered a safety veto.',
    );
  }
  const operatorMinutesReduction = relativeImprovementLowerIsBetter(
    input.baseline.operatorMinutesPerRun,
    input.pilot.operatorMinutesPerRun,
  );
  const throughputGain = relativeDelta(
    input.pilot.throughputPerOperatorPerDay,
    input.baseline.throughputPerOperatorPerDay,
  );
  rationales.push(`Operator-minutes reduction: ${operatorMinutesReduction}.`);
  rationales.push(`Throughput-per-operator delta: ${throughputGain}.`);
  return rationales;
}

function buildGuardrails(pilot: PhaseSummary): GovernedPilotGuardrailSummaryV1 {
  return {
    duplicateExecutionRate: pilot.duplicateExecutionRate,
    unsafeActionEscapeRate: pilot.unsafeActionEscapeRate,
    policyViolationEscapeRate: pilot.policyViolationEscapeRate,
    vetoTriggered:
      pilot.duplicateExecutionRate > 0 ||
      pilot.unsafeActionEscapeRate > 0 ||
      pilot.policyViolationEscapeRate > 0,
  };
}

function ratingForMetric(input: {
  metricName: GovernedPilotUsefulnessMetricNameV1;
  baselineValue: GovernedPilotMetricValueV1 | undefined;
  pilotValue: GovernedPilotMetricValueV1;
  baselineComparisonConfidence: BaselineComparisonConfidenceV1;
}): GovernedPilotRatingV1 {
  if (input.metricName === 'baseline_comparison_confidence') {
    if (input.baselineComparisonConfidence === 'high') return 'Success';
    if (input.baselineComparisonConfidence === 'medium') return 'Concern';
    return 'Failure';
  }
  if (SAFETY_VETO_METRICS.includes(input.metricName)) {
    return input.pilotValue === 0 ? 'Success' : 'Failure';
  }
  if (input.metricName === 'business_kpi_delta_primary') {
    return typeof input.pilotValue === 'number' && input.pilotValue < -0.05 ? 'Failure' : 'Success';
  }
  if (input.metricName === 'operator_minutes_per_run') {
    return relativeMetricRating(
      input.baselineValue,
      input.pilotValue,
      'lower-is-better',
      0.2,
      0.05,
    );
  }
  if (
    input.metricName === 'throughput_per_operator_per_day' ||
    input.metricName === 'throughput_per_workspace_per_day'
  ) {
    return relativeMetricRating(
      input.baselineValue,
      input.pilotValue,
      'higher-is-better',
      0.2,
      0.05,
    );
  }
  if (
    input.metricName === 'cost_per_useful_outcome' ||
    input.metricName === 'model_cost_per_useful_outcome' ||
    input.metricName === 'tool_cost_per_useful_outcome' ||
    input.metricName === 'operator_cost_per_useful_outcome'
  ) {
    return relativeMetricRating(
      input.baselineValue,
      input.pilotValue,
      'lower-is-better',
      0.1,
      -0.15,
    );
  }
  return 'Success';
}

function relativeMetricRating(
  baselineValue: GovernedPilotMetricValueV1 | undefined,
  pilotValue: GovernedPilotMetricValueV1,
  direction: 'lower-is-better' | 'higher-is-better',
  successThreshold: number,
  concernThreshold: number,
): GovernedPilotRatingV1 {
  if (typeof baselineValue !== 'number' || typeof pilotValue !== 'number') return 'Concern';
  const improvement =
    direction === 'lower-is-better'
      ? relativeImprovementLowerIsBetter(baselineValue, pilotValue)
      : relativeDelta(pilotValue, baselineValue);
  if (improvement >= successThreshold) return 'Success';
  if (improvement >= concernThreshold) return 'Concern';
  return 'Failure';
}

function inferBaselineComparisonConfidence(
  baselineObservations: readonly GovernedPilotObservationV1[],
): BaselineComparisonConfidenceV1 {
  const sampleSize = baselineObservations.length;
  const workingDays = distinctWorkspaceWorkingDays(baselineObservations);
  if (sampleSize >= 30 && workingDays >= 10) return 'high';
  if (sampleSize >= 10 && workingDays >= 5) return 'medium';
  return 'low';
}

function baselineValueForMetric(
  metricName: GovernedPilotUsefulnessMetricNameV1,
  baseline: PhaseSummary,
): GovernedPilotMetricValueV1 | undefined {
  const values: Partial<Record<GovernedPilotUsefulnessMetricNameV1, GovernedPilotMetricValueV1>> = {
    operator_minutes_per_run: baseline.operatorMinutesPerRun,
    approval_latency_ms_p50: baseline.approvalLatencyMsP50,
    approval_latency_ms_p95: baseline.approvalLatencyMsP95,
    blocked_duration_ms_p50: baseline.blockedDurationMsP50,
    blocked_duration_ms_p95: baseline.blockedDurationMsP95,
    throughput_per_operator_per_day: baseline.throughputPerOperatorPerDay,
    throughput_per_workspace_per_day: baseline.throughputPerWorkspacePerDay,
    denial_rate: baseline.denialRate,
    rework_rate: baseline.reworkRate,
    duplicate_execution_rate: baseline.duplicateExecutionRate,
    unsafe_action_escape_rate: baseline.unsafeActionEscapeRate,
    policy_violation_escape_rate: baseline.policyViolationEscapeRate,
    cost_per_useful_outcome: baseline.costPerUsefulOutcome,
    model_cost_per_useful_outcome: baseline.modelCostPerUsefulOutcome,
    tool_cost_per_useful_outcome: baseline.toolCostPerUsefulOutcome,
    operator_cost_per_useful_outcome: baseline.operatorCostPerUsefulOutcome,
    useful_outcome_count: baseline.usefulOutcomeCount,
    baseline_sample_size_runs: baseline.sampleSizeRuns,
  };
  return values[metricName];
}

function postureForMetric(
  metricName: GovernedPilotUsefulnessMetricNameV1,
  value: GovernedPilotMetricValueV1,
): GovernedPilotMetricPostureV1 {
  if (SAFETY_VETO_METRICS.includes(metricName)) {
    return value === 0 ? 'healthy' : 'risk';
  }
  if (metricName === 'baseline_comparison_confidence') {
    if (value === 'high') return 'healthy';
    if (value === 'medium') return 'watch';
    return 'risk';
  }
  return 'healthy';
}

function summarizeDataSources(
  baselineObservations: readonly GovernedPilotObservationV1[],
  pilotObservations: readonly GovernedPilotObservationV1[],
): string {
  const sources = new Set(
    [...baselineObservations, ...pilotObservations]
      .map((observation) => observation.dataSource)
      .filter((source): source is string => source !== undefined && source.trim().length > 0),
  );
  return sources.size > 0 ? [...sources].sort().join(', ') : 'operator-team-observations';
}

function filterWindow<T>(
  items: readonly T[],
  fromIso: string | undefined,
  toIso: string | undefined,
  getIso: (item: T) => string,
): readonly T[] {
  return items.filter((item) => {
    const timestamp = Date.parse(getIso(item));
    return (
      (fromIso === undefined || timestamp >= Date.parse(fromIso)) &&
      (toIso === undefined || timestamp <= Date.parse(toIso))
    );
  });
}

function windowObject(
  fromIso: string | undefined,
  toIso: string | undefined,
): Readonly<{ fromIso?: string; toIso?: string }> {
  return {
    ...(fromIso ? { fromIso } : {}),
    ...(toIso ? { toIso } : {}),
  };
}

function distinctOperatorWorkingDays(observations: readonly GovernedPilotObservationV1[]): number {
  const keys = new Set<string>();
  for (const observation of observations) {
    const operatorId =
      observation.operatorId === undefined ? 'operator-unknown' : String(observation.operatorId);
    keys.add(`${operatorId}:${workingDayFor(observation)}`);
  }
  return keys.size;
}

function distinctWorkspaceWorkingDays(observations: readonly GovernedPilotObservationV1[]): number {
  return new Set(observations.map((observation) => workingDayFor(observation))).size;
}

function workingDayFor(observation: GovernedPilotObservationV1): string {
  return observation.workingDayIso ?? observation.observedAtIso.slice(0, 10);
}

function sum(
  observations: readonly GovernedPilotObservationV1[],
  key: keyof Pick<
    GovernedPilotObservationV1,
    | 'decidedApprovalCount'
    | 'deniedApprovalCount'
    | 'requestChangesCount'
    | 'reworkCount'
    | 'externallyEffectfulActionCount'
    | 'duplicateExternallyEffectfulActionCount'
    | 'governedActionCount'
    | 'unsafeActionEscapeCount'
    | 'policyViolationEscapeCount'
    | 'modelCost'
    | 'toolCost'
    | 'operatorCost'
  >,
): number {
  return observations.reduce((total, observation) => total + (observation[key] ?? 0), 0);
}

function compactNumbers(values: readonly (number | undefined)[]): readonly number[] {
  return values.filter((value): value is number => value !== undefined);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((total, value) => total + value, 0) / values.length);
}

function percentile(values: readonly number[], percentileRank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return round(numerator / denominator);
}

function relativeDelta(pilotValue: number, baselineValue: number): number {
  if (baselineValue === 0) return pilotValue === 0 ? 0 : round(pilotValue);
  return round((pilotValue - baselineValue) / Math.abs(baselineValue));
}

function relativeImprovementLowerIsBetter(baselineValue: number, pilotValue: number): number {
  if (baselineValue === 0) return pilotValue === 0 ? 0 : round(-pilotValue);
  return round((baselineValue - pilotValue) / Math.abs(baselineValue));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function labelForMetric(metricName: GovernedPilotUsefulnessMetricNameV1): string {
  const labels: Readonly<Record<GovernedPilotUsefulnessMetricNameV1, string>> = {
    operator_minutes_per_run: 'Operator minutes per Run',
    approval_latency_ms_p50: 'Approval latency p50',
    approval_latency_ms_p95: 'Approval latency p95',
    blocked_duration_ms_p50: 'Blocked duration p50',
    blocked_duration_ms_p95: 'Blocked duration p95',
    throughput_per_operator_per_day: 'Throughput per operator per day',
    throughput_per_workspace_per_day: 'Throughput per Workspace per day',
    denial_rate: 'Denial rate',
    rework_rate: 'Rework rate',
    duplicate_execution_rate: 'Duplicate execution rate',
    unsafe_action_escape_rate: 'Unsafe-action escape rate',
    policy_violation_escape_rate: 'Policy-violation escape rate',
    cost_per_useful_outcome: 'Cost per useful outcome',
    model_cost_per_useful_outcome: 'Model cost per useful outcome',
    tool_cost_per_useful_outcome: 'Tool cost per useful outcome',
    operator_cost_per_useful_outcome: 'Operator cost per useful outcome',
    business_kpi_delta_primary: 'Primary business KPI delta',
    business_kpi_delta_secondary: 'Secondary business KPI delta',
    useful_outcome_count: 'Useful outcome count',
    baseline_comparison_confidence: 'Baseline comparison confidence',
    baseline_sample_size_runs: 'Baseline sample size',
    pilot_sample_size_runs: 'Pilot sample size',
  };
  return labels[metricName];
}

function unitForMetric(
  metricName: GovernedPilotUsefulnessMetricNameV1,
): GovernedPilotMetricRowV1['unit'] {
  if (metricName === 'baseline_comparison_confidence') return 'enum';
  if (metricName === 'operator_minutes_per_run') return 'minutes';
  if (metricName.includes('_latency_ms_') || metricName.includes('_duration_ms_'))
    return 'milliseconds';
  if (metricName.startsWith('throughput_')) return 'outcomes_per_day';
  if (metricName.includes('_cost_') || metricName === 'cost_per_useful_outcome') return 'currency';
  if (metricName.endsWith('_count') || metricName.endsWith('_runs')) return 'count';
  return 'ratio';
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

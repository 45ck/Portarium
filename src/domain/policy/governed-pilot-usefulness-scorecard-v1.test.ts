import { describe, expect, it } from 'vitest';

import {
  RunId,
  WorkflowId,
  WorkforceMemberId,
  WorkItemId,
  WorkspaceId,
} from '../primitives/index.js';
import {
  GOVERNED_PILOT_USEFULNESS_SCORECARD_METRIC_NAMES_V1,
  buildGovernedPilotUsefulnessScorecardV1,
  type GovernedPilotObservationV1,
} from './governed-pilot-usefulness-scorecard-v1.js';

const WORKSPACE_ID = WorkspaceId('workspace-pilot');
const OTHER_WORKSPACE_ID = WorkspaceId('workspace-other');
const WORKFLOW_ID = WorkflowId('workflow-customer-renewal-review');
const GENERATED_AT = '2026-04-30T18:00:00.000Z';

const WORKFLOW = {
  workflowId: WORKFLOW_ID,
  workflowName: 'Customer renewal exception review',
  usefulOutcomeDefinition:
    'Renewal exception closed and accepted by the process owner after audit check.',
  processOwner: 'Revenue operations lead',
  includedActionClasses: ['crm.opportunity:review', 'billing.invoice:prepare', 'comms.email:draft'],
  excludedActionClasses: ['billing.invoice:send', 'payments.charge:capture'],
  primaryBusinessKpi: 'accepted renewal exceptions per day',
  secondaryBusinessKpi: 'owner-accepted first-pass quality',
};

function baselineObservation(index: number): GovernedPilotObservationV1 {
  const day = Math.floor(index / 3) + 1;
  const operator = index % 3;
  return {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    workflowId: WORKFLOW_ID,
    workflowName: WORKFLOW.workflowName,
    observedAtIso: `2026-04-${String(day).padStart(2, '0')}T10:00:00.000Z`,
    workingDayIso: `2026-04-${String(day).padStart(2, '0')}`,
    runId: RunId(`baseline-run-${index}`),
    workItemId: WorkItemId(`baseline-work-item-${index}`),
    operatorId: WorkforceMemberId(`operator-${operator}`),
    usefulOutcomeAccepted: true,
    activeOperatorMinutes: 60,
    approvalLatencyMs: 900_000,
    blockedDurationMs: 1_200_000,
    decidedApprovalCount: 1,
    deniedApprovalCount: 0,
    requestChangesCount: 0,
    reworkCount: 0,
    externallyEffectfulActionCount: 1,
    duplicateExternallyEffectfulActionCount: 0,
    governedActionCount: 3,
    unsafeActionEscapeCount: 0,
    policyViolationEscapeCount: 0,
    modelCost: 4,
    toolCost: 12,
    operatorCost: 84,
    businessKpiPrimaryValue: 1,
    businessKpiSecondaryValue: 0.86,
    dataSource: 'pre-pilot-ticket-history',
  };
}

function pilotObservation(
  index: number,
  overrides: Partial<GovernedPilotObservationV1> = {},
): GovernedPilotObservationV1 {
  const day = Math.floor(index / 3) + 21;
  const operator = index % 3;
  return {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    workflowId: WORKFLOW_ID,
    workflowName: WORKFLOW.workflowName,
    observedAtIso: `2026-04-${String(day).padStart(2, '0')}T11:00:00.000Z`,
    workingDayIso: `2026-04-${String(day).padStart(2, '0')}`,
    runId: RunId(`pilot-run-${index}`),
    workItemId: WorkItemId(`pilot-work-item-${index}`),
    operatorId: WorkforceMemberId(`operator-${operator}`),
    usefulOutcomeAccepted: true,
    activeOperatorMinutes: 42,
    approvalLatencyMs: 420_000,
    blockedDurationMs: 600_000,
    decidedApprovalCount: 1,
    deniedApprovalCount: 0,
    requestChangesCount: 0,
    reworkCount: 0,
    externallyEffectfulActionCount: 1,
    duplicateExternallyEffectfulActionCount: 0,
    governedActionCount: 3,
    unsafeActionEscapeCount: 0,
    policyViolationEscapeCount: 0,
    modelCost: 6,
    toolCost: 10,
    operatorCost: 58,
    businessKpiPrimaryValue: 1.1,
    businessKpiSecondaryValue: 0.92,
    dataSource: 'cockpit-evidence-log',
    ...overrides,
  };
}

function buildScorecard(
  overrides: {
    baseline?: readonly GovernedPilotObservationV1[];
    pilot?: readonly GovernedPilotObservationV1[];
  } = {},
) {
  return buildGovernedPilotUsefulnessScorecardV1({
    workspaceId: WORKSPACE_ID,
    generatedAtIso: GENERATED_AT,
    workflow: WORKFLOW,
    baselineFromIso: '2026-04-01T00:00:00.000Z',
    baselineToIso: '2026-04-10T23:59:59.999Z',
    pilotFromIso: '2026-04-21T00:00:00.000Z',
    baselineObservations:
      overrides.baseline ?? Array.from({ length: 30 }, (_, index) => baselineObservation(index)),
    pilotObservations: overrides.pilot ?? [
      ...Array.from({ length: 12 }, (_, index) => pilotObservation(index)),
      pilotObservation(99, { workspaceId: OTHER_WORKSPACE_ID }),
    ],
  });
}

describe('governed pilot usefulness scorecard v1', () => {
  it('publishes stable metric names for the controlled operator-team pilot export', () => {
    expect(GOVERNED_PILOT_USEFULNESS_SCORECARD_METRIC_NAMES_V1).toEqual([
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
    ]);
  });

  it('rates a bounded operator-team workflow successful when efficiency improves and guardrails stay clean', () => {
    const scorecard = buildScorecard();

    expect(scorecard.finalRating).toBe('Success');
    expect(scorecard.baselineComparisonConfidence).toBe('high');
    expect(scorecard.metrics).toMatchObject({
      operator_minutes_per_run: 42,
      approval_latency_ms_p50: 420_000,
      approval_latency_ms_p95: 420_000,
      blocked_duration_ms_p50: 600_000,
      blocked_duration_ms_p95: 600_000,
      duplicate_execution_rate: 0,
      unsafe_action_escape_rate: 0,
      policy_violation_escape_rate: 0,
      business_kpi_delta_primary: 0.1,
      baseline_sample_size_runs: 30,
      pilot_sample_size_runs: 12,
    });
    expect(scorecard.guardrails).toEqual({
      duplicateExecutionRate: 0,
      unsafeActionEscapeRate: 0,
      policyViolationEscapeRate: 0,
      vetoTriggered: false,
    });
    expect(scorecard.cockpitExport).toMatchObject({
      contentType: 'application/vnd.portarium.governed-pilot-usefulness-scorecard+json',
      routeHint: '/cockpit/governance/pilot-usefulness-scorecard',
      finalRating: 'Success',
    });
    expect(scorecard.cockpitExport.metricRows).toHaveLength(
      GOVERNED_PILOT_USEFULNESS_SCORECARD_METRIC_NAMES_V1.length,
    );
  });

  it('does not average away duplicate execution or governance escape failures', () => {
    const scorecard = buildScorecard({
      pilot: [
        ...Array.from({ length: 11 }, (_, index) => pilotObservation(index)),
        pilotObservation(11, {
          duplicateExternallyEffectfulActionCount: 1,
          unsafeActionEscapeCount: 1,
          policyViolationEscapeCount: 1,
        }),
      ],
    });

    expect(scorecard.finalRating).toBe('Failure');
    expect(scorecard.guardrails.vetoTriggered).toBe(true);
    expect(scorecard.metrics.duplicate_execution_rate).toBe(0.0833);
    expect(scorecard.metrics.unsafe_action_escape_rate).toBe(0.0278);
    expect(scorecard.cockpitExport.concernAndFailureRows).toContainEqual(
      expect.objectContaining({
        metricName: 'duplicate_execution_rate',
        rating: 'Failure',
        posture: 'risk',
      }),
    );
    expect(scorecard.decisionRationale).toContain(
      'Duplicate execution, unsafe-action escape, or policy-violation escape triggered a safety veto.',
    );
  });

  it('blocks Success when the baseline sample is too weak to compare against normal work', () => {
    const scorecard = buildScorecard({
      baseline: Array.from({ length: 5 }, (_, index) => baselineObservation(index)),
    });

    expect(scorecard.baselineComparisonConfidence).toBe('low');
    expect(scorecard.finalRating).toBe('Failure');
    expect(scorecard.metricRows).toContainEqual(
      expect.objectContaining({
        metricName: 'baseline_comparison_confidence',
        pilotValue: 'low',
        rating: 'Failure',
        posture: 'risk',
      }),
    );
  });

  it('freezes the longitudinal export snapshot', () => {
    const scorecard = buildScorecard();

    expect(Object.isFrozen(scorecard)).toBe(true);
    expect(Object.isFrozen(scorecard.metricRows[0])).toBe(true);
    expect(Object.isFrozen(scorecard.cockpitExport.concernAndFailureRows)).toBe(true);
  });
});

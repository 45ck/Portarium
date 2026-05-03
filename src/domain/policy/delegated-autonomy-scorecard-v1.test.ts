import { describe, expect, it } from 'vitest';

import { PolicyChangeId, PolicyId, WorkspaceId } from '../primitives/index.js';
import {
  AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1,
  buildAutonomyDelegationScorecardV1,
  type AutonomyDelegationObservationV1,
  type AutonomyPolicyLearningEventV1,
} from './delegated-autonomy-scorecard-v1.js';

const WORKSPACE_ID = WorkspaceId('ws-1');
const OTHER_WORKSPACE_ID = WorkspaceId('ws-2');
const GENERATED_AT = '2026-04-10T12:00:00.000Z';
const FROM = '2026-04-10T00:00:00.000Z';

function observation(
  overrides: Partial<AutonomyDelegationObservationV1> = {},
): AutonomyDelegationObservationV1 {
  return {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    observedAtIso: '2026-04-10T10:00:00.000Z',
    actionClass: 'payments.transfer',
    executionTier: 'Auto',
    outcome: 'auto-resolved',
    ...overrides,
  };
}

function learningEvent(
  overrides: Partial<AutonomyPolicyLearningEventV1> = {},
): AutonomyPolicyLearningEventV1 {
  return {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    occurredAtIso: '2026-04-10T11:00:00.000Z',
    eventKind: 'policy-updated',
    policyId: PolicyId('policy-1'),
    ...overrides,
  };
}

describe('delegated autonomy scorecard v1', () => {
  it('publishes stable scorecard metric names for Cockpit and pilot exports', () => {
    expect(AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1).toContain('unsafe_action_escape_rate');
    expect(AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1).toContain(
      'precedent_to_policy_conversion_rate',
    );
    expect(AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1).toContain(
      'exception_escalation_decision_ms_p50',
    );
    expect(AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1).toContain(
      'exception_escalation_decision_ms_p95',
    );
  });

  it('summarizes delegation counts, ratios, trend, timing, and Cockpit export rows', () => {
    const scorecard = buildAutonomyDelegationScorecardV1({
      workspaceId: WORKSPACE_ID,
      generatedAtIso: GENERATED_AT,
      fromIso: FROM,
      previousWindowObservations: [
        observation({ outcome: 'human-approved' }),
        observation({ outcome: 'human-approved' }),
        observation({ outcome: 'exception-routed' }),
      ],
      observations: [
        observation({ outcome: 'auto-resolved' }),
        observation({
          outcome: 'exception-routed',
          executionTier: 'HumanApprove',
          decisionContext: 'exception-escalation',
          requestedAtIso: '2026-04-10T09:00:00.000Z',
          decidedAtIso: '2026-04-10T09:05:00.000Z',
          resumedAtIso: '2026-04-10T09:07:00.000Z',
          exceptionClass: 'anomaly-signal',
          exceptionFingerprint: 'payments.transfer:vendor-mismatch',
        }),
        observation({
          outcome: 'exception-routed',
          executionTier: 'HumanApprove',
          decisionContext: 'exception-escalation',
          requestedAtIso: '2026-04-10T10:00:00.000Z',
          decidedAtIso: '2026-04-10T10:15:00.000Z',
          resumedAtIso: '2026-04-10T10:18:00.000Z',
          exceptionClass: 'anomaly-signal',
          exceptionFingerprint: 'payments.transfer:vendor-mismatch',
          falseEscalation: true,
        }),
        observation({
          outcome: 'human-approved',
          executionTier: 'HumanApprove',
          decisionContext: 'routine-approval',
          requestedAtIso: '2026-04-10T08:00:00.000Z',
          decidedAtIso: '2026-04-10T08:04:00.000Z',
          resumedAtIso: '2026-04-10T08:05:00.000Z',
        }),
        observation({ outcome: 'manual-only', executionTier: 'ManualOnly' }),
        observation({
          outcome: 'emergency-stop',
          executionTier: 'ManualOnly',
          unsafeEscape: true,
          policyViolationEscape: true,
        }),
        observation({
          workspaceId: OTHER_WORKSPACE_ID,
          outcome: 'human-approved',
        }),
      ],
      policyLearningEvents: [
        learningEvent({
          eventKind: 'policy-updated',
          policyId: PolicyId('policy-risk'),
          policyChangeId: PolicyChangeId('policy-change-1'),
          exceptionFingerprint: 'payments.transfer:vendor-mismatch',
          learningOutcome: 'policy-improvement',
        }),
        learningEvent({ eventKind: 'precedent-created' }),
        learningEvent({ eventKind: 'precedent-created' }),
        learningEvent({ eventKind: 'precedent-converted' }),
        learningEvent({ eventKind: 'replay-improvement' }),
        learningEvent({
          workspaceId: OTHER_WORKSPACE_ID,
          eventKind: 'policy-retired',
          policyId: PolicyId('other-policy'),
        }),
      ],
    });

    expect(scorecard.counts).toMatchObject({
      totalActions: 6,
      autoResolvedActions: 1,
      exceptionRoutedActions: 2,
      humanApprovedActions: 1,
      manualOnlyActions: 1,
      emergencyStops: 1,
    });
    expect(scorecard.ratios.autoResolvedActionRatio).toBe(0.1667);
    expect(scorecard.metrics).toMatchObject({
      auto_resolved_action_count: 1,
      exception_routed_action_ratio: 0.3333,
      exception_escalation_decision_ms_p95: 900_000,
      exception_escalation_resume_ms_p95: 180_000,
      repeated_exception_hotspot_count: 1,
      unsafe_action_escape_rate: 0.1667,
    });
    expect(Object.keys(scorecard.metrics).sort()).toEqual(
      [...AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1].sort(),
    );
    expect(scorecard.approvalVolumeTrend).toMatchObject({
      currentApprovalActions: 3,
      previousApprovalActions: 3,
      delta: 0,
      direction: 'flat',
    });
    expect(scorecard.repeatedExceptionHotspots).toEqual([
      {
        exceptionFingerprint: 'payments.transfer:vendor-mismatch',
        actionClass: 'payments.transfer',
        exceptionClass: 'anomaly-signal',
        count: 2,
        learningOutcome: 'policy-improvement',
        linkedPolicyChangeCount: 1,
      },
    ]);
    expect(scorecard.policyChurn).toMatchObject({
      churnCount: 1,
      updatedCount: 1,
      replayImprovementCount: 1,
      replayRegressionCount: 0,
      policyIds: ['policy-risk'],
    });
    expect(scorecard.precedentConversion).toEqual({
      precedentCreatedCount: 2,
      precedentConvertedCount: 1,
      conversionRate: 0.5,
    });
    expect(scorecard.timeBreakdown).toContainEqual({
      context: 'exception-escalation',
      sampleCount: 2,
      timeToDecisionMsP50: 300_000,
      timeToDecisionMsP95: 900_000,
      timeToResumeMsP50: 120_000,
      timeToResumeMsP95: 180_000,
    });
    expect(scorecard.escapeIndicators).toEqual({
      unsafeEscapeCount: 1,
      unsafeActionEscapeRate: 0.1667,
      policyViolationEscapeCount: 1,
      policyViolationEscapeRate: 0.1667,
      falseEscalationCount: 1,
      falseEscalationRate: 0.3333,
    });
    expect(scorecard.cockpitExport).toMatchObject({
      contentType: 'application/vnd.portarium.autonomy-delegation-scorecard+json',
      routeHint: '/cockpit/governance/autonomy-scorecard',
      hotspotRows: scorecard.repeatedExceptionHotspots,
    });
    expect(scorecard.cockpitExport.metricRows).toHaveLength(
      AUTONOMY_DELEGATION_SCORECARD_METRIC_NAMES_V1.length,
    );
    expect(scorecard.cockpitExport.metricRows).toContainEqual(
      expect.objectContaining({
        metricName: 'emergency_stop_count',
        value: 1,
        posture: 'risk',
      }),
    );
  });

  it('freezes scorecard output so longitudinal exports remain immutable snapshots', () => {
    const scorecard = buildAutonomyDelegationScorecardV1({
      workspaceId: WORKSPACE_ID,
      generatedAtIso: GENERATED_AT,
      observations: [observation()],
    });

    expect(Object.isFrozen(scorecard)).toBe(true);
    expect(Object.isFrozen(scorecard.cockpitExport.metricRows[0])).toBe(true);
    expect(Object.isFrozen(scorecard.metricNames)).toBe(true);
  });
});

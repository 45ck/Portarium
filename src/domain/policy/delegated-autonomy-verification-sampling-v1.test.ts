import { describe, expect, it } from 'vitest';

import {
  coerceCompletedVerificationSubjectV1,
  coerceVerificationFindingIdsV1,
  evaluateVerificationSamplingV1,
  parseVerificationSamplingRuleV1,
  routeVerificationAuditFindingV1,
  summarizeVerificationCoverageV1,
  type VerificationSamplingRuleV1,
} from './delegated-autonomy-verification-sampling-v1.js';

const NOW = '2026-04-01T12:00:00.000Z';

function paymentsRule(
  overrides: Partial<VerificationSamplingRuleV1> = {},
): VerificationSamplingRuleV1 {
  return {
    schemaVersion: 1,
    ruleId: 'payments-auto-verification',
    actionClassScope: { kind: 'prefix', prefix: 'payments.' },
    executionTiers: ['Auto', 'Assisted'],
    minBlastRadius: 'medium',
    novelty: ['changed', 'new', 'unclassified'],
    trackRecord: ['watch', 'degraded', 'unknown'],
    baselinePercent: 25,
    triggerControls: [
      {
        trigger: 'drift',
        multiplierPercent: 300,
        rationale: 'Payment drift increases silent-failure risk.',
      },
      {
        trigger: 'incident',
        multiplierPercent: 500,
        rationale: 'Incident response samples more completed work.',
      },
      {
        trigger: 'new-capability-rollout',
        multiplierPercent: 400,
        rationale: 'New payment capability rollout starts with more review.',
      },
      {
        trigger: 'degraded-provider-posture',
        multiplierPercent: 300,
        rationale: 'Provider degradation requires more post-action checking.',
      },
    ],
    queueTarget: { kind: 'audit-review' },
    evidenceExpectations: ['Action evidence', 'Policy decision', 'verified effects'],
    rationale: 'Sample delegated payment Actions after completion.',
    ...overrides,
  };
}

describe('delegated autonomy verification sampling v1', () => {
  it('samples completed delegated Actions without changing the blocking Execution Tier', () => {
    const subject = coerceCompletedVerificationSubjectV1({
      workspaceId: 'ws-1',
      completedAtIso: NOW,
      actionClass: 'payments.transfer',
      executionTier: 'Auto',
      blastRadius: 'high',
      novelty: 'new',
      trackRecord: 'unknown',
      sampleKey: 'run-1:act-1',
      activeTriggers: ['routine'],
      runId: 'run-1',
      actionId: 'act-1',
    });

    const decision = evaluateVerificationSamplingV1({
      subject,
      rules: [paymentsRule({ baselinePercent: 100 })],
      evaluatedAtIso: NOW,
    });

    expect(decision.sampled).toBe(true);
    expect(decision.sampleRatePercent).toBe(100);
    expect(decision.subject.executionTier).toBe('Auto');
    expect(decision.queueItem).toMatchObject({
      status: 'queued',
      queueTarget: { kind: 'audit-review' },
      actionClass: 'payments.transfer',
      evidenceExpectations: ['Action evidence', 'Policy decision', 'verified effects'],
    });
  });

  it('increases sampling during drift, incidents, rollout, and degraded provider posture', () => {
    const subject = coerceCompletedVerificationSubjectV1({
      workspaceId: 'ws-1',
      completedAtIso: NOW,
      actionClass: 'payments.transfer',
      executionTier: 'Auto',
      blastRadius: 'high',
      novelty: 'new',
      trackRecord: 'degraded',
      sampleKey: 'run-2:act-2',
      activeTriggers: ['drift', 'new-capability-rollout', 'degraded-provider-posture'],
    });

    const decision = evaluateVerificationSamplingV1({
      subject,
      rules: [paymentsRule({ baselinePercent: 20 })],
      evaluatedAtIso: NOW,
    });

    expect(decision.ruleId).toBe('payments-auto-verification');
    expect(decision.sampleRatePercent).toBe(80);
    expect(decision.reasonCodes).toEqual([
      'rule:payments-auto-verification',
      'rate:80',
      'trigger:drift',
      'trigger:new-capability-rollout',
      'trigger:degraded-provider-posture',
    ]);
  });

  it('routes structured audit outcomes into reusable governance change targets', () => {
    const baseFinding = {
      workspaceId: 'ws-1',
      reviewedAtIso: NOW,
      queueItemId: 'verify:ws-1:run-1:act-1',
      actionClass: 'payments.transfer',
      executionTier: 'Auto' as const,
      evidenceIds: ['ev-1'],
      summary: 'Sampled review finding.',
    };

    expect(
      routeVerificationAuditFindingV1(
        coerceVerificationFindingIdsV1({
          ...baseFinding,
          findingId: 'finding-escalate',
          outcome: 'should-have-escalated',
        }),
      ),
    ).toMatchObject({
      severity: 'high',
      targets: ['policy-change', 'operator-enablement'],
    });

    expect(
      routeVerificationAuditFindingV1(
        coerceVerificationFindingIdsV1({
          ...baseFinding,
          findingId: 'finding-strict',
          outcome: 'policy-too-strict',
        }),
      ),
    ).toMatchObject({
      severity: 'low',
      targets: ['policy-change', 'runbook-update'],
    });

    expect(
      routeVerificationAuditFindingV1(
        coerceVerificationFindingIdsV1({
          ...baseFinding,
          findingId: 'finding-evidence',
          outcome: 'evidence-insufficient',
        }),
      ),
    ).toMatchObject({
      severity: 'medium',
      targets: ['runbook-update', 'prompt-strategy', 'operator-enablement'],
    });
  });

  it('summarizes Cockpit sampling coverage and confidence by Action class and Execution Tier', () => {
    const summaries = summarizeVerificationCoverageV1([
      {
        actionClass: 'payments.transfer',
        executionTier: 'Auto',
        completedCount: 100,
        sampledCount: 12,
        defectFindingCount: 0,
      },
      {
        actionClass: 'payments.transfer',
        executionTier: 'Auto',
        completedCount: 50,
        sampledCount: 8,
        defectFindingCount: 2,
      },
      {
        actionClass: 'crm.email',
        executionTier: 'Assisted',
        completedCount: 30,
        sampledCount: 2,
        defectFindingCount: 0,
      },
    ]);

    expect(summaries).toEqual([
      {
        schemaVersion: 1,
        actionClass: 'crm.email',
        executionTier: 'Assisted',
        completedCount: 30,
        sampledCount: 2,
        samplingCoveragePercent: 6.67,
        defectRatePercent: 0,
        confidence: 'insufficient-data',
      },
      {
        schemaVersion: 1,
        actionClass: 'payments.transfer',
        executionTier: 'Auto',
        completedCount: 150,
        sampledCount: 20,
        samplingCoveragePercent: 13.33,
        defectRatePercent: 10,
        confidence: 'low',
      },
    ]);
  });

  it('parses sampling rules with queue targets and rejects multipliers below baseline', () => {
    const parsed = parseVerificationSamplingRuleV1({
      schemaVersion: 1,
      ruleId: 'parsed-rule',
      actionClassScope: { kind: 'exact', actionClass: 'crm.email' },
      executionTiers: ['Auto'],
      minBlastRadius: 'low',
      novelty: ['routine'],
      trackRecord: ['proven'],
      baselinePercent: 5,
      triggerControls: [
        {
          trigger: 'incident',
          multiplierPercent: 1000,
          rationale: 'Incident mode samples all routine email Actions.',
        },
      ],
      queueTarget: { kind: 'workforce-queue', workforceQueueId: 'queue-audit' },
      evidenceExpectations: ['send receipt'],
      rationale: 'Routine outbound email sampling.',
    });

    expect(parsed).toMatchObject({
      ruleId: 'parsed-rule',
      queueTarget: { kind: 'workforce-queue', workforceQueueId: 'queue-audit' },
    });

    expect(() =>
      parseVerificationSamplingRuleV1({
        ...parsed,
        triggerControls: [
          {
            trigger: 'drift',
            multiplierPercent: 50,
            rationale: 'Invalid decrease.',
          },
        ],
      }),
    ).toThrow(/at least 100/);
  });
});

import { describe, expect, it } from 'vitest';

import {
  EvidenceId,
  WorkspaceId,
  WorkforceQueueId,
  type ExecutionTier,
} from '../primitives/index.js';
import {
  AUTONOMY_EXCEPTION_CLASSES_V1,
  DelegatedAutonomyExceptionRoutingParseError,
  parseAutonomyAnomalyTriggerV1,
  parseAutonomyExceptionRoutingRuleV1,
  routeAutonomyAnomalyTriggerV1,
  type AutonomyAnomalyTriggerV1,
  type AutonomyExceptionClassV1,
  type AutonomyExceptionRoutingHistoryItemV1,
  type AutonomyExceptionRoutingRuleV1,
  type AutonomyExceptionSeverityV1,
} from './delegated-autonomy-exceptions-v1.js';

const WORKSPACE_ID = WorkspaceId('ws-1');
const QUEUE_ID = WorkforceQueueId('queue-risk');
const NOW = '2026-04-01T12:00:00.000Z';

type RoutingRuleOverrides = Omit<
  Partial<AutonomyExceptionRoutingRuleV1>,
  'batching' | 'deduplication' | 'suppression'
> & {
  batching?: AutonomyExceptionRoutingRuleV1['batching'] | undefined;
  deduplication?: AutonomyExceptionRoutingRuleV1['deduplication'] | undefined;
  suppression?: AutonomyExceptionRoutingRuleV1['suppression'] | undefined;
};

function trigger(overrides: Partial<AutonomyAnomalyTriggerV1> = {}): AutonomyAnomalyTriggerV1 {
  return {
    schemaVersion: 1,
    triggerId: 'trg-1',
    workspaceId: WORKSPACE_ID,
    observedAtIso: NOW,
    exceptionClass: 'anomaly-signal',
    severity: 'medium',
    fingerprint: 'payments.transfer:vendor-mismatch',
    summary: 'Vendor name and bank account mismatch crossed threshold.',
    actionClass: 'payments.transfer',
    executionTier: 'Auto',
    evidencePacket: {
      packetId: 'packet-1',
      assembledAtIso: NOW,
      evidenceIds: [EvidenceId('ev-1')],
      consultedEvidenceIds: [EvidenceId('ev-1')],
      missingEvidenceSignals: [],
    },
    ...overrides,
  };
}

function routingRule(overrides: RoutingRuleOverrides = {}): AutonomyExceptionRoutingRuleV1 {
  const base = {
    schemaVersion: 1,
    ruleId: 'rule-risk-queue',
    exceptionClass: 'anomaly-signal',
    minSeverity: 'high',
    actionClassScope: { kind: 'exact', actionClass: 'payments.transfer' },
    executionTiers: ['Auto'],
    handling: 'alert',
    target: { kind: 'workforce-queue', workforceQueueId: QUEUE_ID },
    deduplication: {
      enabled: true,
      windowMinutes: 30,
      requireUnresolvedRoute: true,
    },
    evidenceExpectations: [
      {
        requirementId: 'packet',
        label: 'Decision evidence packet',
        category: 'System',
        required: true,
        minimumCount: 1,
      },
    ],
    nextStepOptions: ['request-more-evidence', 'pause-run', 'escalate'],
    rationale: 'High-severity payment anomalies require live risk queue review.',
  } satisfies AutonomyExceptionRoutingRuleV1;
  const withOptionalPolicy = {
    ...base,
    ...overrides,
  } as AutonomyExceptionRoutingRuleV1 & {
    batching?: AutonomyExceptionRoutingRuleV1['batching'] | undefined;
    deduplication?: AutonomyExceptionRoutingRuleV1['deduplication'] | undefined;
    suppression?: AutonomyExceptionRoutingRuleV1['suppression'] | undefined;
  };
  if ('batching' in overrides && overrides.batching === undefined) {
    delete withOptionalPolicy.batching;
  }
  if ('deduplication' in overrides && overrides.deduplication === undefined) {
    delete withOptionalPolicy.deduplication;
  }
  if ('suppression' in overrides && overrides.suppression === undefined) {
    delete withOptionalPolicy.suppression;
  }
  return withOptionalPolicy;
}

function history(
  overrides: Partial<AutonomyExceptionRoutingHistoryItemV1> = {},
): AutonomyExceptionRoutingHistoryItemV1 {
  return {
    triggerId: 'trg-previous',
    workspaceId: WORKSPACE_ID,
    routedAtIso: '2026-04-01T11:50:00.000Z',
    exceptionClass: 'anomaly-signal',
    handling: 'alert',
    disposition: 'route-alert',
    fingerprint: 'payments.transfer:vendor-mismatch',
    unresolved: true,
    ...overrides,
  };
}

describe('delegated autonomy exception routing v1', () => {
  it('publishes the delegated-autonomy exception class taxonomy', () => {
    expect(AUTONOMY_EXCEPTION_CLASSES_V1).toEqual([
      'policy-violation',
      'evidence-gap',
      'anomaly-signal',
      'execution-failure',
      'capability-drift',
      'budget-threshold',
      'approval-fatigue',
      'stale-or-degraded-state',
      'unknown-risk',
    ]);
  });

  it('routes high-severity anomaly triggers to alert targets with evidence expectations', () => {
    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({ severity: 'high' }),
      rules: [routingRule()],
      evaluatedAtIso: NOW,
    });

    expect(decision).toMatchObject({
      disposition: 'route-alert',
      handling: 'alert',
      target: { kind: 'workforce-queue', workforceQueueId: QUEUE_ID },
      evidence: { status: 'complete', canRouteWithoutMoreEvidence: true },
      nextStepOptions: ['request-more-evidence', 'pause-run', 'escalate'],
    });
  });

  it('keeps low-severity repetitive anomalies calm by batching them for digest review', () => {
    const calmRule = routingRule({
      ruleId: 'rule-calm-digest',
      minSeverity: 'low',
      handling: 'calm',
      target: { kind: 'weekly-autonomy-digest' },
      deduplication: undefined,
      batching: {
        enabled: true,
        batchKey: 'action-class',
        maxBatchSize: 3,
        flushAfterMinutes: 60,
      },
      nextStepOptions: ['acknowledge-digest', 'annotate', 'draft-policy-change'],
      rationale: 'Low-severity transfer anomalies should accumulate for calm review.',
    });

    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({ severity: 'low' }),
      rules: [calmRule],
      evaluatedAtIso: NOW,
      history: [
        history({
          handling: 'calm',
          disposition: 'batched',
          batchKey: `${WORKSPACE_ID}:anomaly-signal:payments.transfer`,
          unresolved: false,
        }),
      ],
    });

    expect(decision.disposition).toBe('batched');
    expect(decision.handling).toBe('calm');
    expect(decision.batchKey).toBe(`${WORKSPACE_ID}:anomaly-signal:payments.transfer`);
    expect(decision.nextStepOptions).toEqual([
      'acknowledge-digest',
      'annotate',
      'draft-policy-change',
    ]);
  });

  it('flushes a calm batch as a calm route when the configured batch size is reached', () => {
    const calmRule = routingRule({
      ruleId: 'rule-calm-work-item',
      minSeverity: 'low',
      handling: 'calm',
      target: { kind: 'work-item' },
      deduplication: undefined,
      batching: {
        enabled: true,
        batchKey: 'exception-class',
        maxBatchSize: 2,
        flushAfterMinutes: 60,
      },
      nextStepOptions: ['open-work-item', 'annotate'],
      rationale: 'Repeated calm exceptions open one Work Item when the batch fills.',
    });

    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({ severity: 'low' }),
      rules: [calmRule],
      evaluatedAtIso: NOW,
      history: [
        history({
          handling: 'calm',
          disposition: 'batched',
          batchKey: `${WORKSPACE_ID}:anomaly-signal`,
          unresolved: false,
        }),
      ],
    });

    expect(decision.disposition).toBe('route-calm');
    expect(decision.target).toEqual({ kind: 'work-item' });
  });

  it('flushes a calm batch as a calm route when the batch window expires', () => {
    const calmRule = routingRule({
      ruleId: 'rule-calm-window',
      minSeverity: 'low',
      handling: 'calm',
      target: { kind: 'work-item' },
      deduplication: undefined,
      batching: {
        enabled: true,
        batchKey: 'exception-class',
        maxBatchSize: 10,
        flushAfterMinutes: 15,
      },
      nextStepOptions: ['open-work-item', 'annotate'],
      rationale: 'Expired calm exception batches should flush to a Work Item.',
    });

    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({ severity: 'low' }),
      rules: [calmRule],
      evaluatedAtIso: NOW,
      history: [
        history({
          routedAtIso: '2026-04-01T11:40:00.000Z',
          handling: 'calm',
          disposition: 'batched',
          batchKey: `${WORKSPACE_ID}:anomaly-signal`,
          unresolved: false,
        }),
      ],
    });

    expect(decision.disposition).toBe('route-calm');
  });

  it('deduplicates unresolved alert routes instead of opening duplicate approval or queue work', () => {
    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({ severity: 'critical' }),
      rules: [routingRule({ minSeverity: 'medium' })],
      evaluatedAtIso: NOW,
      history: [history()],
    });

    expect(decision.disposition).toBe('deduplicated');
    expect(decision.duplicateOfTriggerId).toBe('trg-previous');
    expect(decision.rationale).toContain('do not create a second');
  });

  it('suppresses configured calm duplicates while preserving evidence recording expectations', () => {
    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({ severity: 'medium' }),
      rules: [
        routingRule({
          ruleId: 'rule-suppress-calm',
          minSeverity: 'low',
          handling: 'calm',
          target: { kind: 'audit-review' },
          deduplication: undefined,
          suppression: {
            enabled: true,
            windowMinutes: 20,
            suppressAlerts: false,
            rationale: 'Avoid repeated audit-review nudges for the same signal.',
          },
          nextStepOptions: ['annotate'],
        }),
      ],
      evaluatedAtIso: NOW,
      history: [history({ handling: 'calm', disposition: 'route-calm' })],
    });

    expect(decision.disposition).toBe('suppressed');
    expect(decision.suppressedUntilIso).toBe('2026-04-01T12:10:00.000Z');
    expect(decision.evidence.status).toBe('complete');
  });

  it('does not suppress critical alert routes unless the rule explicitly suppresses alerts', () => {
    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({ severity: 'critical' }),
      rules: [
        routingRule({
          minSeverity: 'medium',
          deduplication: undefined,
          suppression: {
            enabled: true,
            windowMinutes: 20,
            suppressAlerts: false,
            rationale: 'Only calm duplicates may be suppressed.',
          },
        }),
      ],
      evaluatedAtIso: NOW,
      history: [history()],
    });

    expect(decision.disposition).toBe('route-alert');
  });

  it('adds request-more-evidence and escalation when required evidence is missing', () => {
    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({
        severity: 'high',
        evidencePacket: {
          packetId: 'packet-2',
          assembledAtIso: NOW,
          evidenceIds: [],
          consultedEvidenceIds: [],
          missingEvidenceSignals: ['No verified effect evidence was available.'],
        },
      }),
      rules: [routingRule({ nextStepOptions: ['pause-run'] })],
      evaluatedAtIso: NOW,
    });

    expect(decision.evidence).toMatchObject({
      status: 'missing-required',
      missingRequiredLabels: ['Decision evidence packet'],
      missingEvidenceSignals: ['No verified effect evidence was available.'],
      canRouteWithoutMoreEvidence: false,
    });
    expect(decision.nextStepOptions).toEqual(['request-more-evidence', 'escalate', 'pause-run']);
  });

  it('selects the most specific matching rule before broad calm defaults', () => {
    const broadCalm = routingRule({
      ruleId: 'broad-calm',
      minSeverity: 'low',
      actionClassScope: { kind: 'all' },
      handling: 'calm',
      target: { kind: 'weekly-autonomy-digest' },
      deduplication: undefined,
      nextStepOptions: ['acknowledge-digest'],
    });
    const specificAlert = routingRule({
      ruleId: 'specific-alert',
      minSeverity: 'medium',
      actionClassScope: { kind: 'exact', actionClass: 'payments.transfer' },
    });

    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({ severity: 'high' }),
      rules: [broadCalm, specificAlert],
      evaluatedAtIso: NOW,
    });

    expect(decision.ruleId).toBe('specific-alert');
    expect(decision.disposition).toBe('route-alert');
  });

  it('fails closed to platform-admin alert routing when no rule matches', () => {
    const decision = routeAutonomyAnomalyTriggerV1({
      trigger: trigger({
        exceptionClass: 'unknown-risk',
        severity: 'low',
        actionClass: 'unclassified.action',
      }),
      rules: [],
      evaluatedAtIso: NOW,
    });

    expect(decision).toMatchObject({
      ruleId: 'platform-default-unknown-risk-alert',
      handling: 'alert',
      disposition: 'route-alert',
      target: { kind: 'platform-admin' },
    });
  });

  it('parses routing rules and triggers with validation for handling compatibility', () => {
    const parsed = parseAutonomyExceptionRoutingRuleV1({
      schemaVersion: 1,
      ruleId: 'parsed-alert',
      exceptionClass: 'policy-violation',
      minSeverity: 'high',
      actionClassScope: { kind: 'prefix', prefix: 'payments.' },
      executionTiers: ['Auto', 'Assisted'] satisfies readonly ExecutionTier[],
      handling: 'alert',
      target: { kind: 'approval-gate', approvalId: 'approval-1' },
      evidenceExpectations: [
        {
          requirementId: 'policy-match',
          label: 'Policy match explanation',
          category: 'PolicyViolation',
          required: true,
          minimumCount: 1,
        },
      ],
      nextStepOptions: ['request-more-evidence', 'escalate'],
      rationale: 'Policy violations require approval context.',
    });

    expect(parsed.target).toEqual({ kind: 'approval-gate', approvalId: 'approval-1' });
    expect(
      parseAutonomyAnomalyTriggerV1({
        schemaVersion: 1,
        triggerId: 'parsed-trigger',
        workspaceId: 'ws-1',
        observedAtIso: NOW,
        exceptionClass: 'policy-violation' satisfies AutonomyExceptionClassV1,
        severity: 'high' satisfies AutonomyExceptionSeverityV1,
        fingerprint: 'policy:payments.transfer',
        summary: 'Policy violation detected.',
        actionClass: 'payments.transfer',
        executionTier: 'Auto',
        evidencePacket: {
          packetId: 'packet-1',
          assembledAtIso: NOW,
          evidenceIds: ['ev-1'],
          consultedEvidenceIds: ['ev-1'],
          missingEvidenceSignals: [],
        },
      }),
    ).toMatchObject({ triggerId: 'parsed-trigger', workspaceId: WORKSPACE_ID });

    expect(() =>
      parseAutonomyExceptionRoutingRuleV1({
        ...parsed,
        ruleId: 'bad-calm-target',
        handling: 'calm',
        target: { kind: 'workforce-queue', workforceQueueId: 'queue-risk' },
      }),
    ).toThrow(DelegatedAutonomyExceptionRoutingParseError);

    expect(() =>
      parseAutonomyExceptionRoutingRuleV1({
        ...parsed,
        ruleId: 'bad-alert-batch',
        batching: {
          enabled: true,
          batchKey: 'fingerprint',
          maxBatchSize: 10,
          flushAfterMinutes: 60,
        },
      }),
    ).toThrow(/Alert routes cannot enable batching/);
  });
});

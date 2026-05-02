import { describe, expect, it } from 'vitest';

import { PolicyChangeId, WorkspaceId } from '../primitives/index.js';
import { parsePolicyV1 } from './policy-v1.js';
import {
  buildPolicyShadowReplayReportV1,
  POLICY_SHADOW_REPLAY_METRIC_NAMES,
  type PolicyShadowReplaySubjectV1,
} from './policy-shadow-replay-v1.js';

const BASE_POLICY = parsePolicyV1({
  schemaVersion: 1,
  policyId: 'pol-1',
  workspaceId: 'ws-1',
  name: 'Payments policy',
  active: true,
  priority: 10,
  version: 1,
  createdAtIso: '2026-01-01T00:00:00.000Z',
  createdByUserId: 'policy-owner-1',
  rules: [{ ruleId: 'allow-small', condition: 'estimatedCostCents < 10000', effect: 'Allow' }],
});

const PROPOSED_POLICY = parsePolicyV1({
  ...BASE_POLICY,
  version: 2,
  rules: [{ ruleId: 'deny-large', condition: 'estimatedCostCents >= 10000', effect: 'Deny' }],
});

const SUBJECTS: readonly PolicyShadowReplaySubjectV1[] = [
  {
    subjectKind: 'Run',
    subjectId: 'run-1',
    runId: 'run-1',
    observedAtIso: '2026-02-01T09:00:00.000Z',
    status: 'Running',
    currentExecutionTier: 'Assisted',
    estimatedCostCents: 15000,
    policyInput: {
      payloadKind: 'Run',
      estimatedCostCents: 15000,
      actionClass: 'payments.write',
    },
  },
  {
    subjectKind: 'Approval',
    subjectId: 'approval-1',
    runId: 'run-2',
    observedAtIso: '2026-02-01T08:00:00.000Z',
    status: 'Pending',
    dueAtIso: '2026-02-01T09:30:00.000Z',
    currentExecutionTier: 'HumanApprove',
    estimatedCostCents: 5000,
    policyInput: {
      payloadKind: 'Approval',
      estimatedCostCents: 5000,
      escalationChain: [{ stepOrder: 1 }],
    },
  },
];

describe('PolicyShadowReplayReportV1', () => {
  it('compares current and proposed policy outcomes using iteration-2 metric names', () => {
    const report = buildPolicyShadowReplayReportV1({
      policyChangeId: PolicyChangeId('pc-1'),
      workspaceId: WorkspaceId('ws-1'),
      currentPolicy: BASE_POLICY,
      proposedPolicy: PROPOSED_POLICY,
      subjects: SUBJECTS,
      generatedAtIso: '2026-02-01T10:00:00.000Z',
      fromIso: '2026-02-01T00:00:00.000Z',
    });

    expect(Object.keys(report.metrics).sort()).toEqual(
      [...POLICY_SHADOW_REPLAY_METRIC_NAMES].sort(),
    );
    expect(report.evaluatedSubjectCount).toBe(2);
    expect(report.summary.blockedActionDelta).toBe(1);
    expect(report.summary.tierSelectionChanges).toBe(1);
    expect(report.summary.estimatedCostDeltaCents).toBe(-15000);
    expect(report.metrics.denial_count).toBe(1);
    expect(report.metrics.queue_depth_over_time).toEqual([
      { timestampIso: '2026-02-01T10:00:00.000Z', depth: 1 },
    ]);
    expect(report.results[0]?.proposed).toMatchObject({
      decision: 'Deny',
      executionTier: 'ManualOnly',
      matchedRuleIds: ['deny-large'],
    });
  });

  it('freezes replay output so callers cannot mutate counterfactual evidence', () => {
    const report = buildPolicyShadowReplayReportV1({
      policyChangeId: PolicyChangeId('pc-1'),
      workspaceId: WorkspaceId('ws-1'),
      currentPolicy: BASE_POLICY,
      proposedPolicy: PROPOSED_POLICY,
      subjects: SUBJECTS,
      generatedAtIso: '2026-02-01T10:00:00.000Z',
    });

    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.results[0])).toBe(true);
    expect(Object.isFrozen(report.results[0]?.proposed.pipeline.policyResults[0])).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { ApprovalId, EvidenceId, PlanId, RunId } from '../primitives/index.js';

import {
  createApprovalFeedbackV1,
  defaultCalibrationSurfacesForReason,
  hasReusableFeedbackRoute,
  parseApprovalFeedbackV1,
  routesCurrentRunOnly,
} from './approval-feedback-v1.js';

const target = {
  approvalId: ApprovalId('approval-1'),
  runId: RunId('run-1'),
  planId: PlanId('plan-1'),
};

describe('approval feedback contract', () => {
  it('captures reason taxonomy, routes, evidence refs, and calibration surfaces', () => {
    const feedback = createApprovalFeedbackV1({
      decision: 'Denied',
      reason: 'wrong-risk-level',
      rationale: 'The plan labels external writes as low risk.',
      target,
      routes: ['current-run', 'policy-rule'],
      evidenceRefs: [EvidenceId('evidence-1')],
    });

    expect(feedback.schemaVersion).toBe(1);
    expect(feedback.reason).toBe('wrong-risk-level');
    expect(feedback.routes).toEqual([
      { destination: 'current-run', effect: 'current-run-effect' },
      { destination: 'policy-rule', effect: 'future-policy-effect' },
    ]);
    expect(feedback.evidenceRefs).toEqual(['evidence-1']);
    expect(feedback.calibrationSurfaces).toEqual(['risk-classification']);
    expect(hasReusableFeedbackRoute(feedback)).toBe(true);
    expect(routesCurrentRunOnly(feedback)).toBe(false);
    expect(Object.isFrozen(feedback)).toBe(true);
  });

  it('distinguishes current-run-only feedback from reusable workflow feedback', () => {
    const currentRunFeedback = createApprovalFeedbackV1({
      decision: 'RequestChanges',
      reason: 'missing-context',
      rationale: 'Attach the vendor match evidence before resubmitting.',
      target,
      routes: ['current-run'],
    });

    const reusableFeedback = createApprovalFeedbackV1({
      decision: 'LowerScope',
      reason: 'wrong-execution-plan',
      rationale: 'Default this workflow to invoice batches under AUD 5,000.',
      target,
      routes: ['workflow-definition', 'prompt-strategy'],
    });

    expect(routesCurrentRunOnly(currentRunFeedback)).toBe(true);
    expect(hasReusableFeedbackRoute(currentRunFeedback)).toBe(false);
    expect(reusableFeedback.routes.map((route) => route.effect)).toEqual([
      'future-policy-effect',
      'future-policy-effect',
    ]);
  });

  it('maps every minimum reason to a future calibration surface', () => {
    expect(defaultCalibrationSurfacesForReason('wrong-goal')).toEqual(['goal-selection']);
    expect(defaultCalibrationSurfacesForReason('wrong-evidence')).toEqual(['evidence-quality']);
    expect(defaultCalibrationSurfacesForReason('wrong-risk-level')).toEqual([
      'risk-classification',
    ]);
    expect(defaultCalibrationSurfacesForReason('wrong-execution-plan')).toEqual(['execution-plan']);
    expect(defaultCalibrationSurfacesForReason('missing-context')).toEqual([
      'context-completeness',
    ]);
    expect(defaultCalibrationSurfacesForReason('policy-violation')).toEqual(['policy-compliance']);
    expect(defaultCalibrationSurfacesForReason('insufficient-quality')).toEqual([
      'artifact-quality',
    ]);
    expect(defaultCalibrationSurfacesForReason('domain-correctness-failure')).toEqual([
      'domain-correctness',
      'operator-calibration',
    ]);
  });

  it('parses wire data and rejects route/effect mismatches', () => {
    const parsed = parseApprovalFeedbackV1({
      schemaVersion: 1,
      decision: 'Escalate',
      reason: 'domain-correctness-failure',
      rationale: 'Payroll specialist must review the rule.',
      target: { approvalId: 'approval-1', runId: 'run-1', planId: 'plan-1' },
      routes: [{ destination: 'operator-enablement', effect: 'context-only' }],
      evidenceRefs: ['evidence-2'],
    });

    expect(parsed.decision).toBe('Escalate');
    expect(parsed.target.approvalId).toBe('approval-1');
    expect(parsed.calibrationSurfaces).toContain('operator-calibration');

    expect(() =>
      parseApprovalFeedbackV1({
        schemaVersion: 1,
        decision: 'Escalate',
        reason: 'missing-context',
        rationale: 'Escalate.',
        target: { approvalId: 'approval-1' },
        routes: [{ destination: 'current-run', effect: 'future-policy-effect' }],
      }),
    ).toThrow(/effect must be current-run-effect/i);
  });

  it('rejects ad hoc prose without a typed reason and route', () => {
    expect(() =>
      createApprovalFeedbackV1({
        decision: 'Denied',
        reason: 'missing-context',
        rationale: ' ',
        target,
        routes: ['current-run'],
      }),
    ).toThrow(/rationale/i);

    expect(() =>
      createApprovalFeedbackV1({
        decision: 'Denied',
        reason: 'missing-context',
        rationale: 'Missing context.',
        target,
        routes: [],
      }),
    ).toThrow(/routes/i);
  });
});

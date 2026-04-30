/**
 * Scenario eval: operator trust calibration and approval fatigue.
 *
 * Deterministically simulates a mixed approval queue and verifies that the
 * evaluator distinguishes product/Policy problems from operator training gaps.
 */

import { describe, expect, it } from 'vitest';

import {
  evaluateApprovalTrustCalibration,
  type TrustCalibrationCase,
} from '../../src/domain/approvals/approval-trust-calibration-v1.js';

const CALIBRATION_QUEUE: TrustCalibrationCase[] = [
  {
    caseId: 'invoice-low-risk',
    riskLevel: 'low',
    decision: 'approve',
    expectedDecision: 'approve',
    decisionMs: 4_800,
    requiredEvidenceCount: 1,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: false,
    operatorConfidenceScore: 0.83,
  },
  {
    caseId: 'newsletter-low-risk-noisy',
    riskLevel: 'low',
    decision: 'request-more-evidence',
    expectedDecision: 'approve',
    decisionMs: 16_000,
    requiredEvidenceCount: 1,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: false,
    operatorConfidenceScore: 0.51,
  },
  {
    caseId: 'customer-refund-high-risk',
    riskLevel: 'high',
    decision: 'approve',
    expectedDecision: 'request-more-evidence',
    decisionMs: 3_200,
    requiredEvidenceCount: 3,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 2,
    policyRationaleVisible: false,
    anomalyVisible: true,
    operatorConfidenceScore: 0.76,
  },
  {
    caseId: 'security-policy-change',
    riskLevel: 'critical',
    decision: 'override',
    expectedDecision: 'request-more-evidence',
    decisionMs: 10_500,
    requiredEvidenceCount: 4,
    consultedEvidenceCount: 2,
    missingEvidenceCount: 2,
    policyRationaleVisible: true,
    anomalyVisible: true,
    operatorConfidenceScore: 0.95,
  },
  {
    caseId: 'medium-correct-low-confidence',
    riskLevel: 'medium',
    decision: 'deny',
    expectedDecision: 'deny',
    decisionMs: 30_000,
    requiredEvidenceCount: 2,
    consultedEvidenceCount: 2,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: true,
    operatorConfidenceScore: 0.44,
  },
  ...Array.from(
    { length: 4 },
    (_, index): TrustCalibrationCase => ({
      caseId: `fatigue-fast-approve-${String(index + 1)}`,
      riskLevel: 'medium',
      decision: 'approve',
      expectedDecision: 'approve',
      decisionMs: 2_500 + index * 100,
      requiredEvidenceCount: 1,
      consultedEvidenceCount: 1,
      missingEvidenceCount: 0,
      policyRationaleVisible: true,
      anomalyVisible: false,
      operatorConfidenceScore: 0.72,
    }),
  ),
];

describe('scenario: operator trust calibration and approval fatigue', () => {
  it('converts mixed-queue review quality into concrete Policy, UX, and training follow-ups', () => {
    const result = evaluateApprovalTrustCalibration(CALIBRATION_QUEUE);

    expect(result.metrics.totalCases).toBe(9);
    expect(result.metrics.rubberStampingRiskCount).toBeGreaterThan(0);
    expect(result.metrics.opaqueContextCount).toBeGreaterThan(0);
    expect(result.metrics.unnecessaryFrictionCount).toBeGreaterThan(0);
    expect(result.metrics.fatigueShortcutCount).toBeGreaterThan(0);
    expect(result.findings.some((finding) => finding.kind === 'training-gap')).toBe(true);

    const recommendationTargets = new Set(result.recommendations.map((item) => item.target));
    expect(recommendationTargets.has('policy')).toBe(true);
    expect(recommendationTargets.has('ux')).toBe(true);
    expect(recommendationTargets.has('training')).toBe(true);
  });
});

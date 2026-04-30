import { describe, expect, it } from 'vitest';

import {
  evaluateApprovalTrustCalibration,
  type TrustCalibrationCase,
} from './approval-trust-calibration-v1.js';

const MIXED_QUEUE: TrustCalibrationCase[] = [
  {
    caseId: 'low-1',
    riskLevel: 'low',
    decision: 'approve',
    expectedDecision: 'approve',
    decisionMs: 4_500,
    requiredEvidenceCount: 1,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: false,
    operatorConfidenceScore: 0.86,
  },
  {
    caseId: 'low-friction',
    riskLevel: 'low',
    decision: 'request-changes',
    expectedDecision: 'approve',
    decisionMs: 18_000,
    requiredEvidenceCount: 1,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: false,
    operatorConfidenceScore: 0.62,
  },
  {
    caseId: 'medium-training',
    riskLevel: 'medium',
    decision: 'deny',
    expectedDecision: 'deny',
    decisionMs: 34_000,
    requiredEvidenceCount: 2,
    consultedEvidenceCount: 2,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: true,
    operatorConfidenceScore: 0.46,
  },
  {
    caseId: 'high-rubber',
    riskLevel: 'high',
    decision: 'approve',
    expectedDecision: 'request-more-evidence',
    decisionMs: 3_000,
    requiredEvidenceCount: 3,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 2,
    policyRationaleVisible: false,
    anomalyVisible: true,
    operatorConfidenceScore: 0.81,
  },
  {
    caseId: 'critical-override',
    riskLevel: 'critical',
    decision: 'override',
    expectedDecision: 'request-more-evidence',
    decisionMs: 9_000,
    requiredEvidenceCount: 4,
    consultedEvidenceCount: 2,
    missingEvidenceCount: 2,
    policyRationaleVisible: true,
    anomalyVisible: true,
    operatorConfidenceScore: 0.96,
  },
  {
    caseId: 'fast-1',
    riskLevel: 'medium',
    decision: 'approve',
    expectedDecision: 'approve',
    decisionMs: 2_000,
    requiredEvidenceCount: 1,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: false,
    operatorConfidenceScore: 0.75,
  },
  {
    caseId: 'fast-2',
    riskLevel: 'medium',
    decision: 'approve',
    expectedDecision: 'approve',
    decisionMs: 2_200,
    requiredEvidenceCount: 1,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: false,
    operatorConfidenceScore: 0.74,
  },
  {
    caseId: 'fast-3',
    riskLevel: 'medium',
    decision: 'approve',
    expectedDecision: 'approve',
    decisionMs: 2_100,
    requiredEvidenceCount: 1,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: false,
    operatorConfidenceScore: 0.74,
  },
  {
    caseId: 'fast-4',
    riskLevel: 'medium',
    decision: 'approve',
    expectedDecision: 'approve',
    decisionMs: 2_100,
    requiredEvidenceCount: 1,
    consultedEvidenceCount: 1,
    missingEvidenceCount: 0,
    policyRationaleVisible: true,
    anomalyVisible: false,
    operatorConfidenceScore: 0.73,
  },
];

describe('approval trust calibration evaluation', () => {
  it('separates fatigue, friction, opacity, training, and rubber-stamping signals', () => {
    const result = evaluateApprovalTrustCalibration(MIXED_QUEUE);

    expect(result.metrics.totalCases).toBe(9);
    expect(result.metrics.decisionMix.approve).toBe(6);
    expect(result.metrics.overrideRate).toBeCloseTo(1 / 9, 5);
    expect(result.metrics.rubberStampingRiskCount).toBe(1);
    expect(result.metrics.unnecessaryFrictionCount).toBe(1);
    expect(result.metrics.opaqueContextCount).toBe(2);
    expect(result.metrics.fatigueShortcutCount).toBe(1);
    expect(result.metrics.evidenceConsultationRate).toBeLessThan(1);

    expect(result.findings.map((finding) => finding.kind)).toEqual(
      expect.arrayContaining([
        'rubber-stamping-risk',
        'unnecessary-friction',
        'opaque-context',
        'fatigue-shortcut',
        'overconfident-override',
        'training-gap',
      ]),
    );
    expect(result.recommendations.map((item) => item.target)).toEqual(
      expect.arrayContaining(['policy', 'ux', 'training']),
    );
  });

  it('returns a stable no-input result for empty studies', () => {
    const result = evaluateApprovalTrustCalibration([]);

    expect(result.metrics.totalCases).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.recommendations[0]?.message).toMatch(/No approval cases/i);
  });

  it('rejects invalid confidence values', () => {
    expect(() =>
      evaluateApprovalTrustCalibration([
        {
          ...MIXED_QUEUE[0]!,
          caseId: 'bad-confidence',
          operatorConfidenceScore: 1.1,
        },
      ]),
    ).toThrow(/operatorConfidenceScore/i);
  });
});

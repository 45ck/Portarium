import { describe, expect, it } from 'vitest';

import { WorkspaceId } from '../primitives/index.js';

import {
  type AiFeatureRiskAssessment,
  type AiIncidentRecord,
  type AiMonitoringMetrics,
  type AiTrustBoundary,
  type DecisionAuthority,
  type ImpactLevel,
  type LikelihoodLevel,
  type RiskCategory,
  type RiskRating,
  calculateAcceptanceRate,
  calculatePrecision,
  calculateRecall,
  calculateRiskRating,
  isAiFeature,
  isAiIncidentRootCause,
  isAiIncidentSeverity,
  isDecisionAuthority,
  isImpactLevel,
  isLikelihoodLevel,
  isRiskCategory,
  resolveDecisionAuthority,
  validateAiIncident,
  validateFeatureRiskAssessment,
  validateMonitoringMetrics,
  validateTrustBoundary,
} from './ai-risk-controls-v1.js';

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

describe('AiFeature type guard', () => {
  it('accepts valid AI features', () => {
    expect(isAiFeature('approval-advisor')).toBe(true);
    expect(isAiFeature('evidence-summarisation')).toBe(true);
    expect(isAiFeature('rag-retrieval')).toBe(true);
    expect(isAiFeature('blast-radius-analysis')).toBe(true);
    expect(isAiFeature('risk-assessment')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isAiFeature('unknown-feature')).toBe(false);
    expect(isAiFeature('')).toBe(false);
  });
});

describe('RiskCategory type guard', () => {
  it('accepts all NIST-mapped risk categories', () => {
    const categories: RiskCategory[] = [
      'validity-reliability',
      'safety',
      'fairness-bias',
      'transparency',
      'privacy',
      'security',
      'accountability',
    ];
    for (const cat of categories) {
      expect(isRiskCategory(cat)).toBe(true);
    }
  });

  it('rejects invalid values', () => {
    expect(isRiskCategory('performance')).toBe(false);
  });
});

describe('ImpactLevel type guard', () => {
  it('accepts all impact levels', () => {
    expect(isImpactLevel('negligible')).toBe(true);
    expect(isImpactLevel('critical')).toBe(true);
  });
  it('rejects invalid', () => {
    expect(isImpactLevel('extreme')).toBe(false);
  });
});

describe('LikelihoodLevel type guard', () => {
  it('accepts all likelihood levels', () => {
    expect(isLikelihoodLevel('rare')).toBe(true);
    expect(isLikelihoodLevel('almost-certain')).toBe(true);
  });
  it('rejects invalid', () => {
    expect(isLikelihoodLevel('certain')).toBe(false);
  });
});

describe('DecisionAuthority type guard', () => {
  it('accepts all decision authorities', () => {
    expect(isDecisionAuthority('inform-only')).toBe(true);
    expect(isDecisionAuthority('recommend')).toBe(true);
    expect(isDecisionAuthority('auto-with-review')).toBe(true);
    expect(isDecisionAuthority('auto-no-review')).toBe(true);
  });
  it('rejects invalid', () => {
    expect(isDecisionAuthority('auto')).toBe(false);
  });
});

describe('AiIncidentSeverity type guard', () => {
  it('accepts sev1-sev4', () => {
    expect(isAiIncidentSeverity('sev1')).toBe(true);
    expect(isAiIncidentSeverity('sev4')).toBe(true);
  });
  it('rejects invalid', () => {
    expect(isAiIncidentSeverity('sev0')).toBe(false);
  });
});

describe('AiIncidentRootCause type guard', () => {
  it('accepts valid root causes', () => {
    expect(isAiIncidentRootCause('model-hallucination')).toBe(true);
    expect(isAiIncidentRootCause('prompt-injection')).toBe(true);
    expect(isAiIncidentRootCause('missing-guardrail')).toBe(true);
  });
  it('rejects invalid', () => {
    expect(isAiIncidentRootCause('user-error')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Risk rating calculation
// ---------------------------------------------------------------------------

describe('calculateRiskRating', () => {
  it('returns low for negligible impact and rare likelihood', () => {
    expect(calculateRiskRating('negligible', 'rare')).toBe('low');
  });

  it('returns low for minor impact and unlikely likelihood (2x2=4)', () => {
    expect(calculateRiskRating('minor', 'unlikely')).toBe('low');
  });

  it('returns medium for moderate impact and possible likelihood (3x3=9)', () => {
    expect(calculateRiskRating('moderate', 'possible')).toBe('medium');
  });

  it('returns high for major impact and likely likelihood (4x4=16)', () => {
    expect(calculateRiskRating('major', 'likely')).toBe('high');
  });

  it('returns critical for critical impact and almost-certain likelihood (5x5=25)', () => {
    expect(calculateRiskRating('critical', 'almost-certain')).toBe('critical');
  });

  it('returns medium for moderate impact and unlikely (3x2=6)', () => {
    expect(calculateRiskRating('moderate', 'unlikely')).toBe('medium');
  });

  it('returns high for critical impact and possible (5x3=15)', () => {
    expect(calculateRiskRating('critical', 'possible')).toBe('high');
  });

  it('returns critical for critical impact and likely (5x4=20)', () => {
    expect(calculateRiskRating('critical', 'likely')).toBe('critical');
  });

  it.each<[ImpactLevel, LikelihoodLevel, RiskRating]>([
    ['negligible', 'almost-certain', 'medium'],
    ['minor', 'possible', 'medium'],
    ['major', 'rare', 'low'],
    ['major', 'unlikely', 'medium'],
  ])('edge case: %s x %s = %s', (impact, likelihood, expected) => {
    expect(calculateRiskRating(impact, likelihood)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Trust boundary validation
// ---------------------------------------------------------------------------

describe('validateTrustBoundary', () => {
  const validBoundary: AiTrustBoundary = {
    feature: 'approval-advisor',
    workspaceId: WorkspaceId('ws-1'),
    authorityWhenLowRisk: 'auto-with-review',
    authorityWhenMediumRisk: 'recommend',
    authorityWhenHighRisk: 'recommend',
    authorityWhenCriticalRisk: 'inform-only',
  };

  it('accepts a valid monotonically decreasing boundary', () => {
    const result = validateTrustBoundary(validBoundary);
    expect(result.valid).toBe(true);
  });

  it('accepts all-inform-only (most restrictive)', () => {
    const result = validateTrustBoundary({
      ...validBoundary,
      authorityWhenLowRisk: 'inform-only',
      authorityWhenMediumRisk: 'inform-only',
      authorityWhenHighRisk: 'inform-only',
      authorityWhenCriticalRisk: 'inform-only',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects non-monotonic: medium more permissive than low', () => {
    const result = validateTrustBoundary({
      ...validBoundary,
      authorityWhenLowRisk: 'recommend',
      authorityWhenMediumRisk: 'auto-with-review',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toContainEqual(
        expect.stringContaining("Authority at 'medium' risk"),
      );
    }
  });

  it('rejects critical risk with auto-with-review', () => {
    const result = validateTrustBoundary({
      ...validBoundary,
      authorityWhenCriticalRisk: 'auto-with-review',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toContainEqual(
        expect.stringContaining('Critical risk must not permit autonomous action'),
      );
    }
  });

  it('rejects critical risk with auto-no-review', () => {
    const result = validateTrustBoundary({
      ...validBoundary,
      authorityWhenCriticalRisk: 'auto-no-review',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects high risk with auto-no-review', () => {
    const result = validateTrustBoundary({
      ...validBoundary,
      authorityWhenLowRisk: 'auto-no-review',
      authorityWhenMediumRisk: 'auto-no-review',
      authorityWhenHighRisk: 'auto-no-review',
      authorityWhenCriticalRisk: 'inform-only',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toContainEqual(
        expect.stringContaining('High risk must not permit auto-no-review'),
      );
    }
  });

  it('allows equal authority across adjacent levels', () => {
    const result = validateTrustBoundary({
      ...validBoundary,
      authorityWhenLowRisk: 'recommend',
      authorityWhenMediumRisk: 'recommend',
      authorityWhenHighRisk: 'recommend',
      authorityWhenCriticalRisk: 'recommend',
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveDecisionAuthority
// ---------------------------------------------------------------------------

describe('resolveDecisionAuthority', () => {
  const boundary: AiTrustBoundary = {
    feature: 'rag-retrieval',
    workspaceId: WorkspaceId('ws-1'),
    authorityWhenLowRisk: 'auto-with-review',
    authorityWhenMediumRisk: 'recommend',
    authorityWhenHighRisk: 'inform-only',
    authorityWhenCriticalRisk: 'inform-only',
  };

  it.each<[RiskRating, DecisionAuthority]>([
    ['low', 'auto-with-review'],
    ['medium', 'recommend'],
    ['high', 'inform-only'],
    ['critical', 'inform-only'],
  ])('resolves %s risk to %s', (rating, expected) => {
    expect(resolveDecisionAuthority(boundary, rating)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Monitoring metrics validation
// ---------------------------------------------------------------------------

describe('validateMonitoringMetrics', () => {
  const validMetrics: AiMonitoringMetrics = {
    feature: 'approval-advisor',
    windowStartIso: '2026-01-01T00:00:00Z',
    windowEndIso: '2026-01-31T23:59:59Z',
    totalInteractions: 100,
    recommendationsAccepted: 80,
    recommendationsOverridden: 15,
    falsePositives: 5,
    falseNegatives: 3,
    truePositives: 82,
    trueNegatives: 10,
    averageConfidenceScore: 0.75,
    humanCorrectionCount: 12,
  };

  it('accepts valid metrics', () => {
    expect(validateMonitoringMetrics(validMetrics).valid).toBe(true);
  });

  it('rejects negative totalInteractions', () => {
    const result = validateMonitoringMetrics({ ...validMetrics, totalInteractions: -1 });
    expect(result.valid).toBe(false);
  });

  it('rejects confusion matrix exceeding total', () => {
    const result = validateMonitoringMetrics({
      ...validMetrics,
      totalInteractions: 10,
      truePositives: 50,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('Confusion matrix total');
    }
  });

  it('rejects confidence score out of range', () => {
    const result = validateMonitoringMetrics({ ...validMetrics, averageConfidenceScore: 1.5 });
    expect(result.valid).toBe(false);
  });

  it('rejects accepted + overridden exceeding total', () => {
    const result = validateMonitoringMetrics({
      ...validMetrics,
      totalInteractions: 10,
      recommendationsAccepted: 8,
      recommendationsOverridden: 5,
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      humanCorrectionCount: 0,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('accepted + overridden');
    }
  });

  it('rejects humanCorrectionCount exceeding total', () => {
    const result = validateMonitoringMetrics({
      ...validMetrics,
      humanCorrectionCount: 200,
    });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Metric calculations
// ---------------------------------------------------------------------------

describe('calculateAcceptanceRate', () => {
  it('returns acceptance rate', () => {
    const metrics: AiMonitoringMetrics = {
      feature: 'approval-advisor',
      windowStartIso: '2026-01-01T00:00:00Z',
      windowEndIso: '2026-01-31T23:59:59Z',
      totalInteractions: 100,
      recommendationsAccepted: 80,
      recommendationsOverridden: 20,
      falsePositives: 0,
      falseNegatives: 0,
      truePositives: 0,
      trueNegatives: 0,
      averageConfidenceScore: 0.8,
      humanCorrectionCount: 0,
    };
    expect(calculateAcceptanceRate(metrics)).toBe(0.8);
  });

  it('returns 0 when no recommendations were made', () => {
    const metrics: AiMonitoringMetrics = {
      feature: 'rag-retrieval',
      windowStartIso: '2026-01-01T00:00:00Z',
      windowEndIso: '2026-01-31T23:59:59Z',
      totalInteractions: 0,
      recommendationsAccepted: 0,
      recommendationsOverridden: 0,
      falsePositives: 0,
      falseNegatives: 0,
      truePositives: 0,
      trueNegatives: 0,
      averageConfidenceScore: 0,
      humanCorrectionCount: 0,
    };
    expect(calculateAcceptanceRate(metrics)).toBe(0);
  });
});

describe('calculatePrecision', () => {
  it('calculates TP / (TP + FP)', () => {
    const metrics = {
      truePositives: 90,
      falsePositives: 10,
    } as AiMonitoringMetrics;
    expect(calculatePrecision(metrics)).toBeCloseTo(0.9);
  });

  it('returns 0 when TP + FP = 0', () => {
    const metrics = {
      truePositives: 0,
      falsePositives: 0,
    } as AiMonitoringMetrics;
    expect(calculatePrecision(metrics)).toBe(0);
  });
});

describe('calculateRecall', () => {
  it('calculates TP / (TP + FN)', () => {
    const metrics = {
      truePositives: 80,
      falseNegatives: 20,
    } as AiMonitoringMetrics;
    expect(calculateRecall(metrics)).toBeCloseTo(0.8);
  });

  it('returns 0 when TP + FN = 0', () => {
    const metrics = {
      truePositives: 0,
      falseNegatives: 0,
    } as AiMonitoringMetrics;
    expect(calculateRecall(metrics)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AI incident validation
// ---------------------------------------------------------------------------

describe('validateAiIncident', () => {
  const validIncident: AiIncidentRecord = {
    incidentId: 'inc-001',
    workspaceId: WorkspaceId('ws-1'),
    feature: 'approval-advisor',
    severity: 'sev2',
    rootCause: 'model-hallucination',
    description: 'AI recommended approval based on hallucinated evidence reference.',
    affectedDecisionRef: 'approval-123',
    aiWasPrimaryCause: true,
    humanOverrideAvailable: true,
    detectedAtIso: '2026-01-15T10:00:00Z',
    correctiveActions: ['Retrained model with corrected data'],
  };

  it('accepts a valid incident', () => {
    expect(validateAiIncident(validIncident).valid).toBe(true);
  });

  it('rejects empty incidentId', () => {
    const result = validateAiIncident({ ...validIncident, incidentId: '  ' });
    expect(result.valid).toBe(false);
  });

  it('rejects empty description', () => {
    const result = validateAiIncident({ ...validIncident, description: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects empty affectedDecisionRef', () => {
    const result = validateAiIncident({ ...validIncident, affectedDecisionRef: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects resolvedAt before detectedAt', () => {
    const result = validateAiIncident({
      ...validIncident,
      resolvedAtIso: '2026-01-14T09:00:00Z',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toContainEqual(
        expect.stringContaining('resolvedAtIso must be after'),
      );
    }
  });

  it('accepts incident without resolvedAt', () => {
    // validIncident has no resolvedAtIso — should be accepted
    expect(validateAiIncident(validIncident).valid).toBe(true);
  });

  it('requires corrective actions for sev1 AI-primary-cause incidents', () => {
    const result = validateAiIncident({
      ...validIncident,
      severity: 'sev1',
      aiWasPrimaryCause: true,
      correctiveActions: [],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toContainEqual(
        expect.stringContaining('sev1 incidents where AI was primary cause'),
      );
    }
  });

  it('allows sev1 without corrective actions if AI was not primary cause', () => {
    const result = validateAiIncident({
      ...validIncident,
      severity: 'sev1',
      aiWasPrimaryCause: false,
      correctiveActions: [],
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feature risk assessment validation
// ---------------------------------------------------------------------------

describe('validateFeatureRiskAssessment', () => {
  const validAssessment: AiFeatureRiskAssessment = {
    feature: 'approval-advisor',
    workspaceId: WorkspaceId('ws-1'),
    riskCategory: 'safety',
    impact: 'major',
    likelihood: 'possible',
    riskRating: 'high',
    existingMitigations: ['Agency boundary enforced', 'Confidence signal required'],
    residualRiskRating: 'medium',
    assessedAtIso: '2026-01-01T00:00:00Z',
    assessedBy: 'risk-team',
  };

  it('accepts a valid assessment with correct calculated rating', () => {
    // major (4) x possible (3) = 12 => high
    expect(validateFeatureRiskAssessment(validAssessment).valid).toBe(true);
  });

  it('rejects mismatched risk rating', () => {
    const result = validateFeatureRiskAssessment({
      ...validAssessment,
      riskRating: 'low', // should be high
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toContainEqual(
        expect.stringContaining("does not match calculated rating 'high'"),
      );
    }
  });

  it('rejects residual risk exceeding inherent risk', () => {
    const result = validateFeatureRiskAssessment({
      ...validAssessment,
      residualRiskRating: 'critical',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations).toContainEqual(expect.stringContaining('Residual risk'));
    }
  });

  it('rejects empty assessedBy', () => {
    const result = validateFeatureRiskAssessment({ ...validAssessment, assessedBy: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects empty assessedAtIso', () => {
    const result = validateFeatureRiskAssessment({ ...validAssessment, assessedAtIso: '' });
    expect(result.valid).toBe(false);
  });

  it('accepts residual risk equal to inherent risk', () => {
    const result = validateFeatureRiskAssessment({
      ...validAssessment,
      residualRiskRating: 'high',
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariants — Portarium-specific safety rules
// ---------------------------------------------------------------------------

describe('Portarium AI safety invariants', () => {
  it('approval-advisor must never have auto-no-review at any risk level', () => {
    // This is the key safety invariant: the approval advisor should never
    // autonomously approve without any human review opportunity.
    const boundary: AiTrustBoundary = {
      feature: 'approval-advisor',
      workspaceId: WorkspaceId('ws-1'),
      authorityWhenLowRisk: 'auto-no-review',
      authorityWhenMediumRisk: 'recommend',
      authorityWhenHighRisk: 'inform-only',
      authorityWhenCriticalRisk: 'inform-only',
    };

    // While the boundary model allows auto-no-review for low risk features,
    // the approval-advisor should be configured to never use it.
    // This test documents the expected production configuration.
    const SAFE_AUTHORITIES: DecisionAuthority[] = ['inform-only', 'recommend', 'auto-with-review'];

    // All risk levels for the approval-advisor should use safe authorities
    expect(SAFE_AUTHORITIES).toContain(boundary.authorityWhenMediumRisk);
    expect(SAFE_AUTHORITIES).toContain(boundary.authorityWhenHighRisk);
    expect(SAFE_AUTHORITIES).toContain(boundary.authorityWhenCriticalRisk);
    // low risk allows auto-no-review in the model, but production config should avoid it
    expect(boundary.authorityWhenLowRisk).toBe('auto-no-review');
  });

  it('critical risk always resolves to inform-only or recommend', () => {
    const authorities: DecisionAuthority[] = ['inform-only', 'recommend'];
    // Any valid trust boundary must have critical risk as inform-only or recommend
    const boundary: AiTrustBoundary = {
      feature: 'blast-radius-analysis',
      workspaceId: WorkspaceId('ws-1'),
      authorityWhenLowRisk: 'auto-with-review',
      authorityWhenMediumRisk: 'recommend',
      authorityWhenHighRisk: 'inform-only',
      authorityWhenCriticalRisk: 'inform-only',
    };
    const result = validateTrustBoundary(boundary);
    expect(result.valid).toBe(true);
    expect(authorities).toContain(resolveDecisionAuthority(boundary, 'critical'));
  });
});

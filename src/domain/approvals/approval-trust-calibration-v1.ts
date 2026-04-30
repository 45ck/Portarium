export type TrustCalibrationRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type TrustCalibrationDecision =
  | 'approve'
  | 'deny'
  | 'request-changes'
  | 'request-more-evidence'
  | 'override';

export type TrustCalibrationFindingKind =
  | 'rubber-stamping-risk'
  | 'unnecessary-friction'
  | 'opaque-context'
  | 'fatigue-shortcut'
  | 'overconfident-override'
  | 'training-gap';

export type TrustCalibrationRecommendationTarget = 'policy' | 'ux' | 'training';

export type TrustCalibrationCase = Readonly<{
  caseId: string;
  riskLevel: TrustCalibrationRiskLevel;
  decision: TrustCalibrationDecision;
  expectedDecision: TrustCalibrationDecision;
  decisionMs: number;
  requiredEvidenceCount: number;
  consultedEvidenceCount: number;
  missingEvidenceCount: number;
  policyRationaleVisible: boolean;
  anomalyVisible: boolean;
  operatorConfidenceScore: number;
}>;

export type TrustCalibrationFinding = Readonly<{
  kind: TrustCalibrationFindingKind;
  caseId: string;
  message: string;
}>;

export type TrustCalibrationRecommendation = Readonly<{
  target: TrustCalibrationRecommendationTarget;
  message: string;
}>;

export type TrustCalibrationMetrics = Readonly<{
  totalCases: number;
  averageDecisionMs: number;
  decisionMix: Readonly<Record<TrustCalibrationDecision, number>>;
  overrideRate: number;
  evidenceConsultationRate: number;
  highRiskFastApprovalCount: number;
  rubberStampingRiskCount: number;
  unnecessaryFrictionCount: number;
  opaqueContextCount: number;
  fatigueShortcutCount: number;
  decisionAccuracyRate: number;
}>;

export type TrustCalibrationEvaluation = Readonly<{
  metrics: TrustCalibrationMetrics;
  findings: readonly TrustCalibrationFinding[];
  recommendations: readonly TrustCalibrationRecommendation[];
}>;

const EMPTY_DECISION_MIX: Readonly<Record<TrustCalibrationDecision, number>> = {
  approve: 0,
  deny: 0,
  'request-changes': 0,
  'request-more-evidence': 0,
  override: 0,
};

export function evaluateApprovalTrustCalibration(
  cases: readonly TrustCalibrationCase[],
): TrustCalibrationEvaluation {
  if (cases.length === 0) {
    return {
      metrics: {
        totalCases: 0,
        averageDecisionMs: 0,
        decisionMix: EMPTY_DECISION_MIX,
        overrideRate: 0,
        evidenceConsultationRate: 0,
        highRiskFastApprovalCount: 0,
        rubberStampingRiskCount: 0,
        unnecessaryFrictionCount: 0,
        opaqueContextCount: 0,
        fatigueShortcutCount: 0,
        decisionAccuracyRate: 0,
      },
      findings: [],
      recommendations: [{ target: 'policy', message: 'No approval cases were provided.' }],
    };
  }

  const findings: TrustCalibrationFinding[] = [];
  const decisionMix: Record<TrustCalibrationDecision, number> = { ...EMPTY_DECISION_MIX };
  let totalDecisionMs = 0;
  let totalRequiredEvidence = 0;
  let totalConsultedEvidence = 0;
  let highRiskFastApprovalCount = 0;
  let rubberStampingRiskCount = 0;
  let unnecessaryFrictionCount = 0;
  let opaqueContextCount = 0;
  let fatigueShortcutCount = 0;
  let correctDecisions = 0;
  let fastApprovalStreak = 0;

  for (const item of cases) {
    validateTrustCalibrationCase(item);

    decisionMix[item.decision] += 1;
    totalDecisionMs += item.decisionMs;
    totalRequiredEvidence += item.requiredEvidenceCount;
    totalConsultedEvidence += Math.min(item.consultedEvidenceCount, item.requiredEvidenceCount);
    if (item.decision === item.expectedDecision) correctDecisions += 1;

    const highRisk = item.riskLevel === 'high' || item.riskLevel === 'critical';
    const evidenceSufficient =
      item.consultedEvidenceCount >= item.requiredEvidenceCount && item.missingEvidenceCount === 0;
    const fastDecision = item.decisionMs < 8_000;
    const lowConfidence = item.operatorConfidenceScore < 0.55;

    if (item.decision === 'approve' && fastDecision) {
      fastApprovalStreak += 1;
      if (fastApprovalStreak >= 4) {
        fatigueShortcutCount += 1;
        findings.push({
          kind: 'fatigue-shortcut',
          caseId: item.caseId,
          message: 'Consecutive fast approvals indicate possible approval fatigue.',
        });
      }
    } else {
      fastApprovalStreak = 0;
    }

    if (item.decision === 'approve' && highRisk && fastDecision) {
      highRiskFastApprovalCount += 1;
    }

    if (item.decision === 'approve' && highRisk && (!evidenceSufficient || fastDecision)) {
      rubberStampingRiskCount += 1;
      findings.push({
        kind: 'rubber-stamping-risk',
        caseId: item.caseId,
        message: 'High-risk approval was accepted without enough review depth.',
      });
    }

    if (
      item.riskLevel === 'low' &&
      evidenceSufficient &&
      !item.anomalyVisible &&
      (item.decision === 'deny' ||
        item.decision === 'request-changes' ||
        item.decision === 'request-more-evidence')
    ) {
      unnecessaryFrictionCount += 1;
      findings.push({
        kind: 'unnecessary-friction',
        caseId: item.caseId,
        message: 'Low-risk, well-evidenced case was slowed by a human decision.',
      });
    }

    if (!item.policyRationaleVisible || item.missingEvidenceCount > 0) {
      opaqueContextCount += 1;
      findings.push({
        kind: 'opaque-context',
        caseId: item.caseId,
        message: 'Decision context was missing policy rationale or required evidence.',
      });
    }

    if (item.decision === 'override' && item.operatorConfidenceScore > 0.9 && !evidenceSufficient) {
      findings.push({
        kind: 'overconfident-override',
        caseId: item.caseId,
        message: 'Override confidence was high despite insufficient evidence.',
      });
    }

    if (lowConfidence && item.decision === item.expectedDecision && evidenceSufficient) {
      findings.push({
        kind: 'training-gap',
        caseId: item.caseId,
        message: 'Correct decision with low confidence points to operator calibration training.',
      });
    }
  }

  const totalCases = cases.length;
  const metrics: TrustCalibrationMetrics = {
    totalCases,
    averageDecisionMs: Math.round(totalDecisionMs / totalCases),
    decisionMix,
    overrideRate: decisionMix.override / totalCases,
    evidenceConsultationRate:
      totalRequiredEvidence === 0 ? 1 : totalConsultedEvidence / totalRequiredEvidence,
    highRiskFastApprovalCount,
    rubberStampingRiskCount,
    unnecessaryFrictionCount,
    opaqueContextCount,
    fatigueShortcutCount,
    decisionAccuracyRate: correctDecisions / totalCases,
  };

  return {
    metrics,
    findings,
    recommendations: buildRecommendations(metrics, findings),
  };
}

function buildRecommendations(
  metrics: TrustCalibrationMetrics,
  findings: readonly TrustCalibrationFinding[],
): readonly TrustCalibrationRecommendation[] {
  const recommendations: TrustCalibrationRecommendation[] = [];

  if (metrics.rubberStampingRiskCount > 0 || metrics.highRiskFastApprovalCount > 0) {
    recommendations.push({
      target: 'ux',
      message:
        'Add higher-friction review for high-risk approvals: evidence expansion, required rationale, and request-more-evidence before approve.',
    });
  }

  if (metrics.opaqueContextCount > 0) {
    recommendations.push({
      target: 'ux',
      message:
        'Promote missing evidence, policy rationale, anomaly state, blast radius, and reversibility into the decision packet.',
    });
  }

  if (metrics.unnecessaryFrictionCount > 0) {
    recommendations.push({
      target: 'policy',
      message:
        'Move repetitive low-risk, well-evidenced cases toward Auto or Assisted with audit sampling instead of human approval.',
    });
  }

  if (metrics.fatigueShortcutCount > 0) {
    recommendations.push({
      target: 'policy',
      message:
        'Introduce queue shaping, interruption budgets, escalation, or batch review limits before approval volume creates shortcut behaviour.',
    });
  }

  if (findings.some((finding) => finding.kind === 'training-gap')) {
    recommendations.push({
      target: 'training',
      message:
        'Separate product opacity from operator confidence gaps by running calibration review on correctly decided but low-confidence cases.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      target: 'policy',
      message:
        'No fatigue, opacity, friction, or rubber-stamping signal crossed the deterministic threshold.',
    });
  }

  return recommendations;
}

function validateTrustCalibrationCase(item: TrustCalibrationCase): void {
  if (item.caseId.trim() === '') {
    throw new Error('caseId must be non-empty');
  }
  if (item.decisionMs < 0) {
    throw new Error(`decisionMs must be non-negative for ${item.caseId}`);
  }
  if (item.requiredEvidenceCount < 0 || item.consultedEvidenceCount < 0) {
    throw new Error(`evidence counts must be non-negative for ${item.caseId}`);
  }
  if (item.missingEvidenceCount < 0) {
    throw new Error(`missingEvidenceCount must be non-negative for ${item.caseId}`);
  }
  if (item.operatorConfidenceScore < 0 || item.operatorConfidenceScore > 1) {
    throw new Error(`operatorConfidenceScore must be between 0 and 1 for ${item.caseId}`);
  }
}

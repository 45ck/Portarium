import type { PolicyV1 } from '../policy/policy-v1.js';
import type {
  SodEvaluationContextV1,
  SodViolationV1,
  PerformedDutyV1,
} from '../policy/sod-constraints-v1.js';
import { evaluateSodConstraintsV1 } from '../policy/sod-constraints-v1.js';
import type { ExecutionTier } from '../primitives/index.js';
import type { PolicyId as PolicyIdType, UserId as UserIdType } from '../primitives/index.js';
import type { SafetyCaseV1 } from '../robots/safety-constraint-v1.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyEvaluationContextV1 = Readonly<{
  initiatorUserId: UserIdType;
  approverUserIds: readonly UserIdType[];
  performedDuties?: readonly PerformedDutyV1[];
  executionTier: ExecutionTier;
  safetyCase?: SafetyCaseV1;
}>;

export type PolicyDecisionV1 = 'Allow' | 'RequireApproval' | 'Deny';

export type PolicyEvaluationResultV1 = Readonly<{
  decision: PolicyDecisionV1;
  violations: readonly SodViolationV1[];
  evaluatedPolicyIds: readonly PolicyIdType[];
  safetyTierRecommendation?: 'HumanApprove' | 'ManualOnly';
}>;

// ---------------------------------------------------------------------------
// Single-policy evaluation
// ---------------------------------------------------------------------------

export function evaluatePolicy(params: {
  policy: PolicyV1;
  context: PolicyEvaluationContextV1;
}): PolicyEvaluationResultV1 {
  const { policy, context } = params;
  const safety = evaluateSafetyTierRecommendation(context);

  if (!policy.sodConstraints || policy.sodConstraints.length === 0) {
    return {
      decision: mergeDecision('Allow', safety.decision),
      violations: [],
      evaluatedPolicyIds: [policy.policyId],
      ...(safety.recommendation ? { safetyTierRecommendation: safety.recommendation } : {}),
    };
  }

  const sodContext: SodEvaluationContextV1 = {
    initiatorUserId: context.initiatorUserId,
    approverUserIds: context.approverUserIds,
    ...(context.performedDuties !== undefined ? { performedDuties: context.performedDuties } : {}),
  };

  const violations = evaluateSodConstraintsV1({
    constraints: policy.sodConstraints,
    context: sodContext,
  });

  const decision = decisionFromViolations(violations);
  return {
    decision: mergeDecision(decision, safety.decision),
    violations,
    evaluatedPolicyIds: [policy.policyId],
    ...(safety.recommendation ? { safetyTierRecommendation: safety.recommendation } : {}),
  };
}

// ---------------------------------------------------------------------------
// Multi-policy evaluation
// ---------------------------------------------------------------------------

export function evaluatePolicies(params: {
  policies: readonly PolicyV1[];
  context: PolicyEvaluationContextV1;
}): PolicyEvaluationResultV1 {
  const { policies, context } = params;
  const safety = evaluateSafetyTierRecommendation(context);

  if (policies.length === 0) {
    return {
      decision: mergeDecision('Allow', safety.decision),
      violations: [],
      evaluatedPolicyIds: [],
      ...(safety.recommendation ? { safetyTierRecommendation: safety.recommendation } : {}),
    };
  }

  const allViolations: SodViolationV1[] = [];
  const allPolicyIds: PolicyIdType[] = [];

  for (const policy of policies) {
    const result = evaluatePolicy({ policy, context });
    allViolations.push(...result.violations);
    allPolicyIds.push(...result.evaluatedPolicyIds);
  }

  const decision = decisionFromViolations(allViolations);
  return {
    decision: mergeDecision(decision, safety.decision),
    violations: allViolations,
    evaluatedPolicyIds: allPolicyIds,
    ...(safety.recommendation ? { safetyTierRecommendation: safety.recommendation } : {}),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DECISION_SEVERITY: Record<PolicyDecisionV1, number> = {
  Allow: 0,
  RequireApproval: 1,
  Deny: 2,
};

function decisionFromViolations(violations: readonly SodViolationV1[]): PolicyDecisionV1 {
  let worst: PolicyDecisionV1 = 'Allow';

  for (const v of violations) {
    const d = violationToDecision(v);
    if (DECISION_SEVERITY[d] > DECISION_SEVERITY[worst]) {
      worst = d;
    }
  }

  return worst;
}

function violationToDecision(violation: SodViolationV1): PolicyDecisionV1 {
  switch (violation.kind) {
    case 'IncompatibleDutiesViolation':
      return 'Deny';
    case 'MakerCheckerViolation':
      return 'RequireApproval';
    case 'DistinctApproversViolation':
      return 'RequireApproval';
  }
}

function mergeDecision(a: PolicyDecisionV1, b: PolicyDecisionV1): PolicyDecisionV1 {
  return DECISION_SEVERITY[a] >= DECISION_SEVERITY[b] ? a : b;
}

function evaluateSafetyTierRecommendation(context: PolicyEvaluationContextV1): {
  decision: PolicyDecisionV1;
  recommendation?: 'HumanApprove' | 'ManualOnly';
} {
  const safetyCase = context.safetyCase;
  if (!safetyCase) return { decision: 'Allow' };

  if (safetyCase.appliedConstraints.some((c) => c.severity === 'HardStop')) {
    return { decision: 'Deny', recommendation: 'ManualOnly' };
  }

  const hasOperatorRequired = safetyCase.appliedConstraints.some(
    (c) => c.constraintType === 'OperatorRequired' && c.severity !== 'Advisory',
  );
  if (hasOperatorRequired && context.executionTier !== 'ManualOnly') {
    return { decision: 'RequireApproval', recommendation: 'ManualOnly' };
  }

  const hasHazardousConstraint = safetyCase.appliedConstraints.some((c) =>
    c.constraintType === 'SpeedLimit' ||
    c.constraintType === 'PayloadLimit' ||
    c.constraintType === 'ProximityZone',
  );

  if (
    hasHazardousConstraint &&
    (context.executionTier === 'Auto' || context.executionTier === 'Assisted')
  ) {
    return { decision: 'RequireApproval', recommendation: 'HumanApprove' };
  }

  return { decision: 'Allow' };
}

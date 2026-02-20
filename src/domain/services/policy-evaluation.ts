import type { PolicyV1 } from '../policy/policy-v1.js';
import type {
  PerformedDutyV1,
  SodEvaluationContextV1,
  SodViolationV1,
} from '../policy/sod-constraints-v1.js';
import { evaluateSodConstraintsV1 } from '../policy/sod-constraints-v1.js';
import type { PolicyId as PolicyIdType, UserId as UserIdType } from '../primitives/index.js';
import {
  evaluateSafetyPolicyContext,
  type HazardClassificationV1,
  type SafetyPolicyContextV1,
  type SafetyTierRecommendation,
} from './policy-safety-evaluation.js';

export type PolicyEvaluationContextV1 = Readonly<{
  initiatorUserId: UserIdType;
  approverUserIds: readonly UserIdType[];
  performedDuties?: readonly PerformedDutyV1[];
}> &
  SafetyPolicyContextV1;

export type PolicyDecisionV1 = 'Allow' | 'RequireApproval' | 'Deny';

export type PolicyEvaluationResultV1 = Readonly<{
  decision: PolicyDecisionV1;
  violations: readonly SodViolationV1[];
  evaluatedPolicyIds: readonly PolicyIdType[];
  safetyTierRecommendation?: SafetyTierRecommendation;
  hazardClassifications?: readonly HazardClassificationV1[];
}>;

export type PolicyEvaluationEvidenceV1 = Readonly<{
  decision: PolicyDecisionV1;
  evaluatedPolicyIds: readonly PolicyIdType[];
  violationKinds: readonly SodViolationV1['kind'][];
  safetyTierRecommendation?: SafetyTierRecommendation;
  hazardClassifications?: readonly HazardClassificationV1[];
}>;

const DECISION_SEVERITY: Record<PolicyDecisionV1, number> = {
  Allow: 0,
  RequireApproval: 1,
  Deny: 2,
};

export function evaluatePolicy(params: {
  policy: PolicyV1;
  context: PolicyEvaluationContextV1;
}): PolicyEvaluationResultV1 {
  const { policy, context } = params;
  const safety = evaluateSafetyPolicyContext(context);
  const evaluatedPolicyIds = [policy.policyId] as const;

  if (!policy.sodConstraints || policy.sodConstraints.length === 0) {
    return buildPolicyResult({
      baseDecision: 'Allow',
      violations: [],
      evaluatedPolicyIds,
      safety,
    });
  }

  const sodContext: SodEvaluationContextV1 = {
    initiatorUserId: context.initiatorUserId,
    approverUserIds: context.approverUserIds,
    ...(context.performedDuties ? { performedDuties: context.performedDuties } : {}),
  };

  const violations = evaluateSodConstraintsV1({
    constraints: policy.sodConstraints,
    context: sodContext,
  });

  return buildPolicyResult({
    baseDecision: decisionFromViolations(violations),
    violations,
    evaluatedPolicyIds,
    safety,
  });
}

export function evaluatePolicies(params: {
  policies: readonly PolicyV1[];
  context: PolicyEvaluationContextV1;
}): PolicyEvaluationResultV1 {
  const { policies, context } = params;
  const safety = evaluateSafetyPolicyContext(context);

  if (policies.length === 0) {
    return buildPolicyResult({
      baseDecision: 'Allow',
      violations: [],
      evaluatedPolicyIds: [],
      safety,
    });
  }

  const allViolations: SodViolationV1[] = [];
  const allPolicyIds: PolicyIdType[] = [];
  for (const policy of policies) {
    const result = evaluatePolicy({ policy, context });
    allViolations.push(...result.violations);
    allPolicyIds.push(...result.evaluatedPolicyIds);
  }

  return buildPolicyResult({
    baseDecision: decisionFromViolations(allViolations),
    violations: allViolations,
    evaluatedPolicyIds: allPolicyIds,
    safety,
  });
}

export function toPolicyEvaluationEvidenceV1(
  result: PolicyEvaluationResultV1,
): PolicyEvaluationEvidenceV1 {
  return {
    decision: result.decision,
    evaluatedPolicyIds: result.evaluatedPolicyIds,
    violationKinds: result.violations.map((violation) => violation.kind),
    ...(result.safetyTierRecommendation
      ? { safetyTierRecommendation: result.safetyTierRecommendation }
      : {}),
    ...(result.hazardClassifications
      ? { hazardClassifications: result.hazardClassifications }
      : {}),
  };
}

function decisionFromViolations(violations: readonly SodViolationV1[]): PolicyDecisionV1 {
  let worst: PolicyDecisionV1 = 'Allow';
  for (const violation of violations) {
    const decision = violationToDecision(violation);
    if (DECISION_SEVERITY[decision] > DECISION_SEVERITY[worst]) {
      worst = decision;
    }
  }
  return worst;
}

function violationToDecision(violation: SodViolationV1): PolicyDecisionV1 {
  switch (violation.kind) {
    case 'IncompatibleDutiesViolation':
      return 'Deny';
    case 'MakerCheckerViolation':
    case 'DistinctApproversViolation':
      return 'RequireApproval';
  }
}

function mergeDecision(a: PolicyDecisionV1, b: PolicyDecisionV1): PolicyDecisionV1 {
  return DECISION_SEVERITY[a] >= DECISION_SEVERITY[b] ? a : b;
}

function buildPolicyResult(input: {
  baseDecision: PolicyDecisionV1;
  violations: readonly SodViolationV1[];
  evaluatedPolicyIds: readonly PolicyIdType[];
  safety: ReturnType<typeof evaluateSafetyPolicyContext>;
}): PolicyEvaluationResultV1 {
  return {
    decision: mergeDecision(input.baseDecision, input.safety.decision),
    violations: input.violations,
    evaluatedPolicyIds: input.evaluatedPolicyIds,
    ...(input.safety.recommendation
      ? { safetyTierRecommendation: input.safety.recommendation }
      : {}),
    ...(input.safety.hazardClassifications.length > 0
      ? { hazardClassifications: input.safety.hazardClassifications }
      : {}),
  };
}

import type { PolicyV1 } from '../policy/policy-v1.js';
import type {
  SodEvaluationContextV1,
  SodViolationV1,
  PerformedDutyV1,
} from '../policy/sod-constraints-v1.js';
import { evaluateSodConstraintsV1 } from '../policy/sod-constraints-v1.js';
import type { ExecutionTier } from '../primitives/index.js';
import type { PolicyId as PolicyIdType, UserId as UserIdType } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyEvaluationContextV1 = Readonly<{
  initiatorUserId: UserIdType;
  approverUserIds: readonly UserIdType[];
  performedDuties?: readonly PerformedDutyV1[];
  executionTier: ExecutionTier;
}>;

export type PolicyDecisionV1 = 'Allow' | 'RequireApproval' | 'Deny';

export type PolicyEvaluationResultV1 = Readonly<{
  decision: PolicyDecisionV1;
  violations: readonly SodViolationV1[];
  evaluatedPolicyIds: readonly PolicyIdType[];
}>;

// ---------------------------------------------------------------------------
// Single-policy evaluation
// ---------------------------------------------------------------------------

export function evaluatePolicy(params: {
  policy: PolicyV1;
  context: PolicyEvaluationContextV1;
}): PolicyEvaluationResultV1 {
  const { policy, context } = params;

  if (!policy.sodConstraints || policy.sodConstraints.length === 0) {
    return { decision: 'Allow', violations: [], evaluatedPolicyIds: [policy.policyId] };
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

  return { decision, violations, evaluatedPolicyIds: [policy.policyId] };
}

// ---------------------------------------------------------------------------
// Multi-policy evaluation
// ---------------------------------------------------------------------------

export function evaluatePolicies(params: {
  policies: readonly PolicyV1[];
  context: PolicyEvaluationContextV1;
}): PolicyEvaluationResultV1 {
  const { policies, context } = params;

  if (policies.length === 0) {
    return { decision: 'Allow', violations: [], evaluatedPolicyIds: [] };
  }

  const allViolations: SodViolationV1[] = [];
  const allPolicyIds: PolicyIdType[] = [];

  for (const policy of policies) {
    const result = evaluatePolicy({ policy, context });
    allViolations.push(...result.violations);
    allPolicyIds.push(...result.evaluatedPolicyIds);
  }

  const decision = decisionFromViolations(allViolations);

  return { decision, violations: allViolations, evaluatedPolicyIds: allPolicyIds };
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

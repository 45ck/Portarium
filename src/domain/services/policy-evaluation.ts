import type { PolicyV1 } from '../policy/policy-v1.js';
import type {
  PerformedDutyV1,
  RobotSodContextV1,
  SodEvaluationContextV1,
  SodViolationV1,
} from '../policy/sod-constraints-v1.js';
import { evaluateSodConstraintsV1 } from '../policy/sod-constraints-v1.js';
import {
  evaluatePolicyConditionDslV1,
} from '../policy/policy-condition-dsl-v1.js';
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
  robotContext?: RobotSodContextV1;
  ruleContext?: Readonly<Record<string, unknown>>;
  ruleEvaluationMaxOperations?: number;
}> &
  SafetyPolicyContextV1;

export type PolicyDecisionV1 = 'Allow' | 'RequireApproval' | 'Deny';

export type PolicyEvaluationResultV1 = Readonly<{
  decision: PolicyDecisionV1;
  violations: readonly SodViolationV1[];
  evaluatedPolicyIds: readonly PolicyIdType[];
  safetyTierRecommendation?: SafetyTierRecommendation;
  hazardClassifications?: readonly HazardClassificationV1[];
  inlineRuleErrors?: readonly string[];
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

  // --- Inline rule evaluation ---
  const inlineResult = evaluateInlineRules(policy, context);
  if (inlineResult.errors.length > 0) {
    // Fail closed: any parse/timeout error → Deny
    return {
      decision: 'Deny',
      violations: [],
      evaluatedPolicyIds,
      inlineRuleErrors: inlineResult.errors,
    };
  }
  if (inlineResult.decision !== null) {
    return buildPolicyResult({
      baseDecision: inlineResult.decision,
      violations: [],
      evaluatedPolicyIds,
      safety,
    });
  }

  // --- SoD constraint evaluation ---
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
    ...(context.robotContext ? { robotContext: context.robotContext } : {}),
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
  const allInlineErrors: string[] = [];
  let strongestPolicyDecision: PolicyDecisionV1 = 'Allow';

  for (const policy of policies) {
    const result = evaluatePolicy({ policy, context });
    allViolations.push(...result.violations);
    allPolicyIds.push(...result.evaluatedPolicyIds);
    if (result.inlineRuleErrors) {
      allInlineErrors.push(...result.inlineRuleErrors);
    }
    if (DECISION_SEVERITY[result.decision] > DECISION_SEVERITY[strongestPolicyDecision]) {
      strongestPolicyDecision = result.decision;
    }
  }

  // Fail closed: if any policy had inline rule errors, propagate Deny
  if (allInlineErrors.length > 0) {
    return {
      decision: 'Deny',
      violations: allViolations,
      evaluatedPolicyIds: allPolicyIds,
      inlineRuleErrors: allInlineErrors,
    };
  }

  const sodBaseDecision = decisionFromViolations(allViolations);
  const baseDecision =
    DECISION_SEVERITY[strongestPolicyDecision] > DECISION_SEVERITY[sodBaseDecision]
      ? strongestPolicyDecision
      : sodBaseDecision;

  return buildPolicyResult({
    baseDecision,
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

// ---------------------------------------------------------------------------
// Inline rule evaluation helpers
// ---------------------------------------------------------------------------

type InlineRuleEvalResult = Readonly<{
  decision: PolicyDecisionV1 | null;
  errors: readonly string[];
}>;

/**
 * Builds the flattened context object passed to the inline rule expression
 * evaluator. The context exposes:
 *   - every top-level scalar field of PolicyEvaluationContextV1
 *   - every key from ruleContext (merged at the top level)
 *   - a `run` object with `tier` aliased to `executionTier`
 */
function buildRuleEvaluationContext(
  context: PolicyEvaluationContextV1,
): Readonly<Record<string, unknown>> {
  const base: Record<string, unknown> = {
    executionTier: context.executionTier,
    actionOperation: context.actionOperation ?? null,
    run: { tier: context.executionTier },
  };

  if (context.ruleContext) {
    for (const [key, value] of Object.entries(context.ruleContext)) {
      base[key] = value;
    }
  }

  return base;
}

function evaluateInlineRules(
  policy: PolicyV1,
  context: PolicyEvaluationContextV1,
): InlineRuleEvalResult {
  if (!policy.rules || policy.rules.length === 0) {
    return { decision: null, errors: [] };
  }

  const evalCtx = buildRuleEvaluationContext(context);
  const maxOps = context.ruleEvaluationMaxOperations ?? 1000;
  const errors: string[] = [];
  let strongestDecision: PolicyDecisionV1 | null = null;

  for (const rule of policy.rules) {
    const evalResult = evaluatePolicyConditionDslV1({
      condition: rule.condition,
      context: evalCtx,
      maxOperations: maxOps,
    });

    if (!evalResult.ok) {
      errors.push(evalResult.message);
      continue;
    }

    if (evalResult.value) {
      const ruleDecision: PolicyDecisionV1 = rule.effect === 'Deny' ? 'Deny' : 'Allow';
      if (
        strongestDecision === null ||
        DECISION_SEVERITY[ruleDecision] > DECISION_SEVERITY[strongestDecision]
      ) {
        strongestDecision = ruleDecision;
      }
    }
  }

  if (errors.length > 0) {
    return { decision: null, errors };
  }

  return { decision: strongestDecision, errors: [] };
}

// ---------------------------------------------------------------------------
// SoD helpers
// ---------------------------------------------------------------------------

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
    case 'HazardousZoneNoSelfApprovalViolation':
    case 'SafetyClassifiedZoneDualApprovalViolation':
    case 'RemoteEstopRequesterSeparationViolation':
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

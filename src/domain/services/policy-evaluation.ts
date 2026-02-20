import type { PolicyV1 } from '../policy/policy-v1.js';
import type {
  SodEvaluationContextV1,
  SodViolationV1,
  PerformedDutyV1,
} from '../policy/sod-constraints-v1.js';
import { evaluateSodConstraintsV1 } from '../policy/sod-constraints-v1.js';
import type { ExecutionTier } from '../primitives/index.js';
import type { PolicyId as PolicyIdType, UserId as UserIdType } from '../primitives/index.js';
import type { HazardClass, RobotClass } from '../robots/robot-fleet-v1.js';
import type { SafetyCaseV1 } from '../robots/safety-constraint-v1.js';

export type PolicyEvaluationContextV1 = Readonly<{
  initiatorUserId: UserIdType;
  approverUserIds: readonly UserIdType[];
  performedDuties?: readonly PerformedDutyV1[];
  executionTier: ExecutionTier;
  actionOperation?: string;
  robotClass?: RobotClass;
  robotHazardClass?: HazardClass;
  proximityZoneActive?: boolean;
  nonReversibleActuatorState?: boolean;
  safetyCase?: SafetyCaseV1;
}>;

export type PolicyDecisionV1 = 'Allow' | 'RequireApproval' | 'Deny';

export type SafetyTierRecommendation = 'HumanApprove' | 'ManualOnly';

export type HazardClassificationCodeV1 =
  | 'RobotEstopRequest'
  | 'RobotExecuteInProximityZone'
  | 'ActuatorSafetyClassifiedStateChange'
  | 'HighHazardRobotAction'
  | 'SpeedOrForceConstraint'
  | 'OperatorRequiredConstraint'
  | 'HardStopConstraint';

export type HazardClassificationV1 = Readonly<{
  code: HazardClassificationCodeV1;
  recommendedTier: SafetyTierRecommendation;
  reason: string;
  standardsRef: 'ISO 13849-1';
}>;

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

export function evaluatePolicy(params: {
  policy: PolicyV1;
  context: PolicyEvaluationContextV1;
}): PolicyEvaluationResultV1 {
  const { policy, context } = params;
  const safety = evaluateSafetyTierRecommendation(context);

  if (!policy.sodConstraints || policy.sodConstraints.length === 0) {
    return buildPolicyResult({
      baseDecision: 'Allow',
      violations: [],
      evaluatedPolicyIds: [policy.policyId],
      safety,
    });
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
  return buildPolicyResult({
    baseDecision: decision,
    violations,
    evaluatedPolicyIds: [policy.policyId],
    safety,
  });
}

export function evaluatePolicies(params: {
  policies: readonly PolicyV1[];
  context: PolicyEvaluationContextV1;
}): PolicyEvaluationResultV1 {
  const { policies, context } = params;
  const safety = evaluateSafetyTierRecommendation(context);

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

  const decision = decisionFromViolations(allViolations);
  return buildPolicyResult({
    baseDecision: decision,
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
  recommendation?: SafetyTierRecommendation;
  hazardClassifications: readonly HazardClassificationV1[];
} {
  const hazards = collectSafetyHazards(context);
  const recommendation = strongestTierRecommendation(hazards);
  const decision = decideSafetyPolicy(context, hazards, recommendation);
  return {
    decision,
    ...(recommendation ? { recommendation } : {}),
    ...(hazards.length > 0 ? { hazardClassifications: hazards } : { hazardClassifications: [] }),
  };
}

function buildPolicyResult(input: {
  baseDecision: PolicyDecisionV1;
  violations: readonly SodViolationV1[];
  evaluatedPolicyIds: readonly PolicyIdType[];
  safety: {
    decision: PolicyDecisionV1;
    recommendation?: SafetyTierRecommendation;
    hazardClassifications: readonly HazardClassificationV1[];
  };
}): PolicyEvaluationResultV1 {
  const mergedDecision = mergeDecision(input.baseDecision, input.safety.decision);
  return {
    decision: mergedDecision,
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

function collectSafetyHazards(
  context: PolicyEvaluationContextV1,
): readonly HazardClassificationV1[] {
  const hazards: HazardClassificationV1[] = [];
  addOperationHazards(context, hazards);
  hazards.push(...hazardsFromSafetyCase(context.safetyCase));
  return dedupeHazardsByCode(hazards);
}

function addOperationHazards(
  context: PolicyEvaluationContextV1,
  hazards: HazardClassificationV1[],
): void {
  if (isRobotEstopOperation(context)) {
    hazards.push(
      classifyHazard(
        'RobotEstopRequest',
        'ManualOnly',
        'robot:estop_request is safety-priority and must remain ManualOnly governed.',
      ),
    );
  }

  if (isExecuteActionInProximity(context)) {
    hazards.push(
      classifyHazard(
        'RobotExecuteInProximityZone',
        'HumanApprove',
        'robot:execute_action in a proximity zone requires HumanApprove and SoD checks.',
      ),
    );
  }

  if (isSafetyClassifiedActuatorChange(context)) {
    hazards.push(
      classifyHazard(
        'ActuatorSafetyClassifiedStateChange',
        'HumanApprove',
        'actuator:set_state on safety-classified or non-reversible state requires HumanApprove.',
      ),
    );
  }

  if (isHighHazardRobotAction(context)) {
    hazards.push(
      classifyHazard(
        'HighHazardRobotAction',
        'HumanApprove',
        'robot class or hazard class indicates elevated physical risk; HumanApprove required.',
      ),
    );
  }
}

function hazardsFromSafetyCase(
  safetyCase: SafetyCaseV1 | undefined,
): readonly HazardClassificationV1[] {
  if (!safetyCase) return [];

  const hazards: HazardClassificationV1[] = [];

  if (safetyCase.appliedConstraints.some((c) => c.severity === 'HardStop')) {
    hazards.push(
      classifyHazard(
        'HardStopConstraint',
        'ManualOnly',
        'HardStop safety constraint indicates immediate deny and ManualOnly handling.',
      ),
    );
  }

  if (
    safetyCase.appliedConstraints.some(
      (c) => c.constraintType === 'OperatorRequired' && c.severity !== 'Advisory',
    )
  ) {
    hazards.push(
      classifyHazard(
        'OperatorRequiredConstraint',
        'ManualOnly',
        'OperatorRequired safety constraint requires ManualOnly governance.',
      ),
    );
  }

  if (
    safetyCase.appliedConstraints.some(
      (c) =>
        c.constraintType === 'SpeedLimit' ||
        c.constraintType === 'PayloadLimit' ||
        c.constraintType === 'ProximityZone',
    )
  ) {
    hazards.push(
      classifyHazard(
        'SpeedOrForceConstraint',
        'HumanApprove',
        'Speed/force/proximity constraints indicate hazardous motion profile.',
      ),
    );
  }

  return hazards;
}

function dedupeHazardsByCode(
  hazards: readonly HazardClassificationV1[],
): readonly HazardClassificationV1[] {
  const byCode = new Map<HazardClassificationCodeV1, HazardClassificationV1>();
  for (const hazard of hazards) {
    if (!byCode.has(hazard.code)) {
      byCode.set(hazard.code, hazard);
    }
  }
  return [...byCode.values()];
}

function strongestTierRecommendation(
  hazards: readonly HazardClassificationV1[],
): SafetyTierRecommendation | undefined {
  if (hazards.some((hazard) => hazard.recommendedTier === 'ManualOnly')) return 'ManualOnly';
  if (hazards.some((hazard) => hazard.recommendedTier === 'HumanApprove')) return 'HumanApprove';
  return undefined;
}

function decideSafetyPolicy(
  context: PolicyEvaluationContextV1,
  hazards: readonly HazardClassificationV1[],
  recommendation: SafetyTierRecommendation | undefined,
): PolicyDecisionV1 {
  if (hasHazard(hazards, 'HardStopConstraint')) return 'Deny';
  if (!recommendation) return 'Allow';

  if (hasHazard(hazards, 'RobotEstopRequest')) return 'RequireApproval';
  if (recommendation === 'ManualOnly') {
    return context.executionTier === 'ManualOnly' ? 'Allow' : 'RequireApproval';
  }
  if (context.executionTier === 'Auto' || context.executionTier === 'Assisted') {
    return 'RequireApproval';
  }
  return 'Allow';
}

function hasHazard(
  hazards: readonly HazardClassificationV1[],
  code: HazardClassificationCodeV1,
): boolean {
  return hazards.some((hazard) => hazard.code === code);
}

function isRobotEstopOperation(context: PolicyEvaluationContextV1): boolean {
  return context.actionOperation === 'robot:estop_request';
}

function isExecuteActionInProximity(context: PolicyEvaluationContextV1): boolean {
  if (context.actionOperation !== 'robot:execute_action') return false;
  const proximityZoneActive =
    context.proximityZoneActive ??
    Boolean(
      context.safetyCase?.appliedConstraints.some((c) => c.constraintType === 'ProximityZone'),
    );
  return proximityZoneActive;
}

function isSafetyClassifiedActuatorChange(context: PolicyEvaluationContextV1): boolean {
  if (context.actionOperation !== 'actuator:set_state') return false;
  return Boolean(context.nonReversibleActuatorState || isSafetyClassifiedRobot(context));
}

function isHighHazardRobotAction(context: PolicyEvaluationContextV1): boolean {
  return context.actionOperation === 'robot:execute_action' && isSafetyClassifiedRobot(context);
}

function classifyHazard(
  code: HazardClassificationCodeV1,
  recommendedTier: SafetyTierRecommendation,
  reason: string,
): HazardClassificationV1 {
  return {
    code,
    recommendedTier,
    reason,
    standardsRef: 'ISO 13849-1',
  };
}

function isSafetyClassifiedRobot(context: PolicyEvaluationContextV1): boolean {
  if (context.robotHazardClass === 'High' || context.robotHazardClass === 'Critical') {
    return true;
  }

  return (
    context.robotClass === 'Manipulator' ||
    context.robotClass === 'Aerial' ||
    context.robotClass === 'Humanoid'
  );
}

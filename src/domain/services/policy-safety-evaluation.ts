import type { ExecutionTier } from '../primitives/index.js';
import type { HazardClass, RobotClass } from '../robots/robot-fleet-v1.js';
import type { SafetyCaseV1 } from '../robots/safety-constraint-v1.js';

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

export type SafetyPolicyContextV1 = Readonly<{
  executionTier: ExecutionTier;
  actionOperation?: string;
  robotClass?: RobotClass;
  robotHazardClass?: HazardClass;
  proximityZoneActive?: boolean;
  nonReversibleActuatorState?: boolean;
  safetyCase?: SafetyCaseV1;
}>;

export type SafetyPolicyDecision = 'Allow' | 'RequireApproval' | 'Deny';

export type SafetyPolicyResultV1 = Readonly<{
  decision: SafetyPolicyDecision;
  recommendation?: SafetyTierRecommendation;
  hazardClassifications: readonly HazardClassificationV1[];
}>;

export function evaluateSafetyPolicyContext(context: SafetyPolicyContextV1): SafetyPolicyResultV1 {
  const hazards = collectSafetyHazards(context);
  const recommendation = strongestTierRecommendation(hazards);
  const decision = decideSafetyPolicy(context.executionTier, hazards, recommendation);
  return {
    decision,
    ...(recommendation ? { recommendation } : {}),
    hazardClassifications: hazards,
  };
}

function collectSafetyHazards(context: SafetyPolicyContextV1): readonly HazardClassificationV1[] {
  const hazards: HazardClassificationV1[] = [];
  addOperationHazards(context, hazards);
  hazards.push(...hazardsFromSafetyCase(context.safetyCase));
  return dedupeHazardsByCode(hazards);
}

function addOperationHazards(context: SafetyPolicyContextV1, hazards: HazardClassificationV1[]): void {
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

function hazardsFromSafetyCase(safetyCase: SafetyCaseV1 | undefined): readonly HazardClassificationV1[] {
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
    if (!byCode.has(hazard.code)) byCode.set(hazard.code, hazard);
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
  executionTier: ExecutionTier,
  hazards: readonly HazardClassificationV1[],
  recommendation: SafetyTierRecommendation | undefined,
): SafetyPolicyDecision {
  if (hasHazard(hazards, 'HardStopConstraint')) return 'Deny';
  if (!recommendation) return 'Allow';
  if (hasHazard(hazards, 'RobotEstopRequest')) return 'RequireApproval';
  if (recommendation === 'ManualOnly') {
    return executionTier === 'ManualOnly' ? 'Allow' : 'RequireApproval';
  }
  if (executionTier === 'Auto' || executionTier === 'Assisted') return 'RequireApproval';
  return 'Allow';
}

function hasHazard(
  hazards: readonly HazardClassificationV1[],
  code: HazardClassificationCodeV1,
): boolean {
  return hazards.some((hazard) => hazard.code === code);
}

function isRobotEstopOperation(context: SafetyPolicyContextV1): boolean {
  return context.actionOperation === 'robot:estop_request';
}

function isExecuteActionInProximity(context: SafetyPolicyContextV1): boolean {
  if (context.actionOperation !== 'robot:execute_action') return false;
  const proximityZoneActive =
    context.proximityZoneActive ??
    Boolean(context.safetyCase?.appliedConstraints.some((c) => c.constraintType === 'ProximityZone'));
  return proximityZoneActive;
}

function isSafetyClassifiedActuatorChange(context: SafetyPolicyContextV1): boolean {
  if (context.actionOperation !== 'actuator:set_state') return false;
  return Boolean(context.nonReversibleActuatorState || isSafetyClassifiedRobot(context));
}

function isHighHazardRobotAction(context: SafetyPolicyContextV1): boolean {
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

function isSafetyClassifiedRobot(context: SafetyPolicyContextV1): boolean {
  if (context.robotHazardClass === 'High' || context.robotHazardClass === 'Critical') return true;

  return (
    context.robotClass === 'Manipulator' ||
    context.robotClass === 'Aerial' ||
    context.robotClass === 'Humanoid'
  );
}

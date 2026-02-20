import type { UserId } from '../primitives/index.js';
import type { UserId as UserIdType } from '../primitives/index.js';
import type { ApprovalPendingV1 } from '../approvals/approval-v1.js';
import { readInteger, readRecord, readString, readStringArray } from '../validation/parse-utils.js';

export type SodConstraintKind =
  | 'MakerChecker'
  | 'DistinctApprovers'
  | 'IncompatibleDuties'
  | 'HazardousZoneNoSelfApproval'
  | 'SafetyClassifiedZoneDualApproval'
  | 'RemoteEstopRequesterSeparation';

export type MakerCheckerConstraintV1 = Readonly<{
  kind: 'MakerChecker';
}>;

export type DistinctApproversConstraintV1 = Readonly<{
  kind: 'DistinctApprovers';
  minimumApprovers: number;
}>;

export type IncompatibleDutiesConstraintV1 = Readonly<{
  kind: 'IncompatibleDuties';
  dutyKeys: readonly string[];
}>;

export type HazardousZoneNoSelfApprovalConstraintV1 = Readonly<{
  kind: 'HazardousZoneNoSelfApproval';
}>;

export type SafetyClassifiedZoneDualApprovalConstraintV1 = Readonly<{
  kind: 'SafetyClassifiedZoneDualApproval';
}>;

export type RemoteEstopRequesterSeparationConstraintV1 = Readonly<{
  kind: 'RemoteEstopRequesterSeparation';
}>;

export type SodConstraintV1 =
  | MakerCheckerConstraintV1
  | DistinctApproversConstraintV1
  | IncompatibleDutiesConstraintV1
  | HazardousZoneNoSelfApprovalConstraintV1
  | SafetyClassifiedZoneDualApprovalConstraintV1
  | RemoteEstopRequesterSeparationConstraintV1;

export type PerformedDutyV1 = Readonly<{
  userId: UserIdType;
  dutyKey: string;
}>;

export type RobotSodContextV1 = Readonly<{
  hazardousZone?: boolean;
  safetyClassifiedZone?: boolean;
  remoteEstopRequest?: boolean;
  missionProposerUserId?: UserIdType;
  estopRequesterUserId?: UserIdType;
}>;

export type SodEvaluationContextV1 = Readonly<{
  initiatorUserId: UserIdType;
  approverUserIds: readonly UserIdType[];
  performedDuties?: readonly PerformedDutyV1[];
  robotContext?: RobotSodContextV1;
}>;

export type SodViolationV1 =
  | Readonly<{
      kind: 'MakerCheckerViolation';
      initiatorUserId: UserIdType;
    }>
  | Readonly<{
      kind: 'DistinctApproversViolation';
      requiredApprovers: number;
      distinctApprovers: number;
      approverUserIds: readonly UserIdType[];
    }>
  | Readonly<{
      kind: 'IncompatibleDutiesViolation';
      userId: UserIdType;
      dutyKeys: readonly string[];
      constraintDutyKeys: readonly string[];
    }>
  | Readonly<{
      kind: 'HazardousZoneNoSelfApprovalViolation';
      missionProposerUserId: UserIdType;
    }>
  | Readonly<{
      kind: 'SafetyClassifiedZoneDualApprovalViolation';
      requiredApprovers: 2;
      distinctApprovers: number;
      approverUserIds: readonly UserIdType[];
    }>
  | Readonly<{
      kind: 'RemoteEstopRequesterSeparationViolation';
      estopRequesterUserId: UserIdType;
    }>;

export class SodConstraintParseError extends Error {
  public override readonly name = 'SodConstraintParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseSodConstraintsV1(value: unknown): readonly SodConstraintV1[] {
  if (!Array.isArray(value)) {
    throw new SodConstraintParseError('sodConstraints must be an array when provided.');
  }

  return value.map((c, idx) => parseSodConstraintV1(c, `sodConstraints[${idx}]`));
}

export function evaluateSodConstraintsV1(params: {
  constraints: readonly SodConstraintV1[];
  context: SodEvaluationContextV1;
}): readonly SodViolationV1[] {
  const { constraints, context } = params;

  const violations: SodViolationV1[] = [];

  for (const constraint of constraints) {
    violations.push(...evaluateSodConstraintV1(constraint, context));
  }

  return violations;
}

function evaluateSodConstraintV1(
  constraint: SodConstraintV1,
  context: SodEvaluationContextV1,
): readonly SodViolationV1[] {
  switch (constraint.kind) {
    case 'MakerChecker':
      return evaluateMakerCheckerConstraintV1(context);
    case 'DistinctApprovers':
      return evaluateDistinctApproversConstraintV1(constraint, context);
    case 'IncompatibleDuties':
      return evaluateIncompatibleDutiesConstraintV1(constraint, context);
    case 'HazardousZoneNoSelfApproval':
      return evaluateHazardousZoneNoSelfApprovalConstraintV1(context);
    case 'SafetyClassifiedZoneDualApproval':
      return evaluateSafetyClassifiedZoneDualApprovalConstraintV1(context);
    case 'RemoteEstopRequesterSeparation':
      return evaluateRemoteEstopRequesterSeparationConstraintV1(context);
    default:
      return assertNever(constraint);
  }
}

function evaluateMakerCheckerConstraintV1(
  context: SodEvaluationContextV1,
): readonly SodViolationV1[] {
  if (!context.approverUserIds.includes(context.initiatorUserId)) return [];

  return [
    {
      kind: 'MakerCheckerViolation',
      initiatorUserId: context.initiatorUserId,
    },
  ];
}

function evaluateDistinctApproversConstraintV1(
  constraint: DistinctApproversConstraintV1,
  context: SodEvaluationContextV1,
): readonly SodViolationV1[] {
  const distinctApproverUserIds = uniqByString(context.approverUserIds);
  if (distinctApproverUserIds.length >= constraint.minimumApprovers) return [];

  return [
    {
      kind: 'DistinctApproversViolation',
      requiredApprovers: constraint.minimumApprovers,
      distinctApprovers: distinctApproverUserIds.length,
      approverUserIds: distinctApproverUserIds,
    },
  ];
}

function evaluateIncompatibleDutiesConstraintV1(
  constraint: IncompatibleDutiesConstraintV1,
  context: SodEvaluationContextV1,
): readonly SodViolationV1[] {
  const performed = context.performedDuties ?? [];
  if (performed.length === 0) return [];

  const byUser = groupPerformedDutiesByUser(performed);
  const violations: SodViolationV1[] = [];

  for (const [userId, dutyKeys] of byUser.entries()) {
    const intersection = uniqStrings(dutyKeys.filter((k) => constraint.dutyKeys.includes(k)));
    if (intersection.length < 2) continue;

    violations.push({
      kind: 'IncompatibleDutiesViolation',
      userId,
      dutyKeys: intersection,
      constraintDutyKeys: constraint.dutyKeys,
    });
  }

  return violations;
}

function evaluateHazardousZoneNoSelfApprovalConstraintV1(
  context: SodEvaluationContextV1,
): readonly SodViolationV1[] {
  if (!context.robotContext?.hazardousZone) return [];

  const missionProposerUserId =
    context.robotContext.missionProposerUserId ?? context.initiatorUserId;
  if (!context.approverUserIds.includes(missionProposerUserId)) return [];

  return [
    {
      kind: 'HazardousZoneNoSelfApprovalViolation',
      missionProposerUserId,
    },
  ];
}

function evaluateSafetyClassifiedZoneDualApprovalConstraintV1(
  context: SodEvaluationContextV1,
): readonly SodViolationV1[] {
  if (!context.robotContext?.safetyClassifiedZone) return [];

  const distinctApproverUserIds = uniqByString(context.approverUserIds);
  if (distinctApproverUserIds.length >= 2) return [];

  return [
    {
      kind: 'SafetyClassifiedZoneDualApprovalViolation',
      requiredApprovers: 2,
      distinctApprovers: distinctApproverUserIds.length,
      approverUserIds: distinctApproverUserIds,
    },
  ];
}

function evaluateRemoteEstopRequesterSeparationConstraintV1(
  context: SodEvaluationContextV1,
): readonly SodViolationV1[] {
  if (!context.robotContext?.remoteEstopRequest) return [];

  const estopRequesterUserId =
    context.robotContext.estopRequesterUserId ??
    context.robotContext.missionProposerUserId ??
    context.initiatorUserId;

  if (!context.approverUserIds.includes(estopRequesterUserId)) return [];

  return [
    {
      kind: 'RemoteEstopRequesterSeparationViolation',
      estopRequesterUserId,
    },
  ];
}

function parseSodConstraintV1(value: unknown, pathLabel: string): SodConstraintV1 {
  const record = readRecord(value, pathLabel, SodConstraintParseError);

  const kind = readString(record, 'kind', SodConstraintParseError);
  if (!isSodConstraintKind(kind)) {
    throw new SodConstraintParseError(
      `${pathLabel}.kind must be one of: MakerChecker, DistinctApprovers, IncompatibleDuties, HazardousZoneNoSelfApproval, SafetyClassifiedZoneDualApproval, RemoteEstopRequesterSeparation.`,
    );
  }

  if (kind === 'MakerChecker') {
    return { kind: 'MakerChecker' };
  }

  if (kind === 'DistinctApprovers') {
    const minimumApprovers = readInteger(record, 'minimumApprovers', SodConstraintParseError);
    if (minimumApprovers < 1) {
      throw new SodConstraintParseError(`${pathLabel}.minimumApprovers must be >= 1.`);
    }
    return { kind: 'DistinctApprovers', minimumApprovers };
  }

  if (kind === 'HazardousZoneNoSelfApproval') {
    return { kind: 'HazardousZoneNoSelfApproval' };
  }

  if (kind === 'SafetyClassifiedZoneDualApproval') {
    return { kind: 'SafetyClassifiedZoneDualApproval' };
  }

  if (kind === 'RemoteEstopRequesterSeparation') {
    return { kind: 'RemoteEstopRequesterSeparation' };
  }

  const dutyKeys = readStringArray(record, 'dutyKeys', SodConstraintParseError);
  if (dutyKeys.length < 2) {
    throw new SodConstraintParseError(`${pathLabel}.dutyKeys must have length >= 2.`);
  }
  return { kind: 'IncompatibleDuties', dutyKeys };
}

function isSodConstraintKind(value: string): value is SodConstraintKind {
  return (
    value === 'MakerChecker' ||
    value === 'DistinctApprovers' ||
    value === 'IncompatibleDuties' ||
    value === 'HazardousZoneNoSelfApproval' ||
    value === 'SafetyClassifiedZoneDualApproval' ||
    value === 'RemoteEstopRequesterSeparation'
  );
}

function uniqStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function uniqByString<T extends string>(values: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of values) {
    const k = String(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function groupPerformedDutiesByUser(performed: readonly PerformedDutyV1[]): Map<UserId, string[]> {
  const out = new Map<UserId, string[]>();
  for (const d of performed) {
    const existing = out.get(d.userId);
    if (existing) {
      existing.push(d.dutyKey);
      continue;
    }
    out.set(d.userId, [d.dutyKey]);
  }
  return out;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled SoD constraint variant: ${JSON.stringify(value)}`);
}

/**
 * Evaluate SoD constraints in the context of an approval decision.
 *
 * Builds the SodEvaluationContextV1 from:
 * - `initiatorUserId`: the user who originally requested the approval
 * - `approverUserIds`: all users who have already approved (previousApprovers) plus
 *   the proposed new approver
 *
 * Returns any violations.  If violations is empty, the approval decision is SoD-clean.
 */
export function evaluateApprovalRoutingSodV1(params: {
  approval: ApprovalPendingV1;
  proposedApproverId: UserIdType;
  previousApproverIds?: readonly UserIdType[];
  robotContext?: RobotSodContextV1;
  constraints: readonly SodConstraintV1[];
}): readonly SodViolationV1[] {
  const {
    approval,
    proposedApproverId,
    previousApproverIds = [],
    robotContext,
    constraints,
  } = params;
  const allApprovers = [...previousApproverIds, proposedApproverId];

  return evaluateSodConstraintsV1({
    constraints,
    context: {
      initiatorUserId: approval.requestedByUserId,
      approverUserIds: allApprovers,
      ...(robotContext ? { robotContext } : {}),
    },
  });
}

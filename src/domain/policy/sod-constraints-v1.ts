import type { UserId } from '../primitives/index.js';
import type { UserId as UserIdType } from '../primitives/index.js';
import { readInteger, readRecord, readString, readStringArray } from '../validation/parse-utils.js';

export type SodConstraintKind = 'MakerChecker' | 'DistinctApprovers' | 'IncompatibleDuties';

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

export type SodConstraintV1 =
  | MakerCheckerConstraintV1
  | DistinctApproversConstraintV1
  | IncompatibleDutiesConstraintV1;

export type PerformedDutyV1 = Readonly<{
  userId: UserIdType;
  dutyKey: string;
}>;

export type SodEvaluationContextV1 = Readonly<{
  initiatorUserId: UserIdType;
  approverUserIds: readonly UserIdType[];
  performedDuties?: readonly PerformedDutyV1[];
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

function parseSodConstraintV1(value: unknown, pathLabel: string): SodConstraintV1 {
  const record = readRecord(value, pathLabel, SodConstraintParseError);

  const kind = readString(record, 'kind', SodConstraintParseError);
  if (!isSodConstraintKind(kind)) {
    throw new SodConstraintParseError(
      `${pathLabel}.kind must be one of: MakerChecker, DistinctApprovers, IncompatibleDuties.`,
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

  const dutyKeys = readStringArray(record, 'dutyKeys', SodConstraintParseError);
  if (dutyKeys.length < 2) {
    throw new SodConstraintParseError(`${pathLabel}.dutyKeys must have length >= 2.`);
  }
  return { kind: 'IncompatibleDuties', dutyKeys };
}

function isSodConstraintKind(value: string): value is SodConstraintKind {
  return (
    value === 'MakerChecker' || value === 'DistinctApprovers' || value === 'IncompatibleDuties'
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

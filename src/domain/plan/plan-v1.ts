import type { ExternalObjectRef } from '../canonical/external-object-ref.js';
import { parseExternalObjectRef } from '../canonical/external-object-ref.js';
import {
  EffectId,
  PlanId,
  UserId,
  WorkspaceId,
  type EffectId as EffectIdType,
  type PlanId as PlanIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readInteger,
  readIsoString,
  readOptionalFiniteNumber,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type EffectOperation = 'Create' | 'Update' | 'Delete' | 'Upsert';

const EFFECT_OPERATIONS = ['Create', 'Update', 'Delete', 'Upsert'] as const;

export type PlannedEffectV1 = Readonly<{
  effectId: EffectIdType;
  operation: EffectOperation;
  target: ExternalObjectRef;
  summary: string;
  idempotencyKey?: string;
}>;

export type PredictedEffectV1 = Readonly<
  PlannedEffectV1 & {
    confidence?: number;
  }
>;

export type PlanV1 = Readonly<{
  schemaVersion: 1;
  planId: PlanIdType;
  workspaceId: WorkspaceIdType;
  createdAtIso: string;
  createdByUserId: UserIdType;
  plannedEffects: readonly PlannedEffectV1[];
  predictedEffects?: readonly PredictedEffectV1[];
}>;

export class PlanParseError extends Error {
  public override readonly name = 'PlanParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parsePlanV1(value: unknown): PlanV1 {
  const record = readRecord(value, 'Plan', PlanParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PlanParseError);
  if (schemaVersion !== 1) throw new PlanParseError(`Unsupported schemaVersion: ${schemaVersion}`);

  const planId = PlanId(readString(record, 'planId', PlanParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', PlanParseError));
  const createdAtIso = readIsoString(record, 'createdAtIso', PlanParseError);
  const createdByUserId = UserId(readString(record, 'createdByUserId', PlanParseError));

  const plannedEffectsRaw = record['plannedEffects'];
  if (!Array.isArray(plannedEffectsRaw)) {
    throw new PlanParseError('plannedEffects must be an array.');
  }

  const plannedEffects = plannedEffectsRaw.map((e, idx) =>
    parsePlannedEffect(e, `plannedEffects[${idx}]`),
  );

  const predictedEffectsRaw = record['predictedEffects'];
  const predictedEffects =
    predictedEffectsRaw === undefined ? undefined : parsePredictedEffects(predictedEffectsRaw);

  return {
    schemaVersion: 1,
    planId,
    workspaceId,
    createdAtIso,
    createdByUserId,
    plannedEffects,
    ...(predictedEffects ? { predictedEffects } : {}),
  };
}

function parsePredictedEffects(value: unknown): readonly PredictedEffectV1[] {
  if (!Array.isArray(value)) throw new PlanParseError('predictedEffects must be an array.');
  return value.map((e, idx) => parsePredictedEffect(e, `predictedEffects[${idx}]`));
}

function parsePlannedEffect(value: unknown, pathLabel: string): PlannedEffectV1 {
  const record = readRecord(value, pathLabel, PlanParseError);

  const effectId = EffectId(readString(record, 'effectId', PlanParseError));
  const operationRaw = readString(record, 'operation', PlanParseError);
  if (!isEffectOperation(operationRaw)) {
    throw new PlanParseError(
      `${pathLabel}.operation must be one of: Create, Update, Delete, Upsert.`,
    );
  }

  const target = parseExternalObjectRef(record['target']);
  const summary = readString(record, 'summary', PlanParseError);
  const idempotencyKey = readOptionalString(record, 'idempotencyKey', PlanParseError);

  return {
    effectId,
    operation: operationRaw,
    target,
    summary,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

function parsePredictedEffect(value: unknown, pathLabel: string): PredictedEffectV1 {
  const base = parsePlannedEffect(value, pathLabel);
  const record = readRecord(value, pathLabel, PlanParseError);

  const confidence = readOptionalFiniteNumber(record, 'confidence', PlanParseError);
  if (confidence !== undefined) {
    if (confidence < 0 || confidence > 1) {
      throw new PlanParseError(`${pathLabel}.confidence must be between 0 and 1.`);
    }
    return { ...base, confidence };
  }

  return base;
}

function isEffectOperation(value: string): value is EffectOperation {
  return (EFFECT_OPERATIONS as readonly string[]).includes(value);
}

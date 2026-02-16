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

export type EffectOperation = 'Create' | 'Update' | 'Delete' | 'Upsert';

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
  if (!isRecord(value)) throw new PlanParseError('Plan must be an object.');

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) throw new PlanParseError(`Unsupported schemaVersion: ${schemaVersion}`);

  const planId = PlanId(readString(value, 'planId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const createdAtIso = readString(value, 'createdAtIso');
  const createdByUserId = UserId(readString(value, 'createdByUserId'));

  const plannedEffectsRaw = value['plannedEffects'];
  if (!Array.isArray(plannedEffectsRaw)) {
    throw new PlanParseError('plannedEffects must be an array.');
  }

  const plannedEffects = plannedEffectsRaw.map((e, idx) =>
    parsePlannedEffect(e, `plannedEffects[${idx}]`),
  );

  const predictedEffectsRaw = value['predictedEffects'];
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
  if (!isRecord(value)) throw new PlanParseError(`${pathLabel} must be an object.`);

  const effectId = EffectId(readString(value, 'effectId'));
  const operationRaw = readString(value, 'operation');
  if (!isEffectOperation(operationRaw)) {
    throw new PlanParseError(
      `${pathLabel}.operation must be one of: Create, Update, Delete, Upsert.`,
    );
  }

  const target = parseExternalObjectRef(value['target']);
  const summary = readString(value, 'summary');
  const idempotencyKey = readOptionalString(value, 'idempotencyKey');

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
  if (!isRecord(value)) {
    // Unreachable due to parsePlannedEffect, but keeps TS honest.
    throw new PlanParseError(`${pathLabel} must be an object.`);
  }

  const confidence = readOptionalNumber(value, 'confidence');
  if (confidence !== undefined) {
    if (confidence < 0 || confidence > 1) {
      throw new PlanParseError(`${pathLabel}.confidence must be between 0 and 1.`);
    }
    return { ...base, confidence };
  }

  return base;
}

function isEffectOperation(value: string): value is EffectOperation {
  return value === 'Create' || value === 'Update' || value === 'Delete' || value === 'Upsert';
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '')
    throw new PlanParseError(`${key} must be a string.`);
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PlanParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PlanParseError(`${key} must be an integer.`);
  }
  return v;
}

function readOptionalNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v)) {
    throw new PlanParseError(`${key} must be a finite number when provided.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

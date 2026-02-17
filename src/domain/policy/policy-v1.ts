import {
  PolicyId,
  UserId,
  WorkspaceId,
  type PolicyId as PolicyIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

import type { SodConstraintV1 } from './sod-constraints-v1.js';
import { parseSodConstraintsV1 } from './sod-constraints-v1.js';

export type PolicyV1 = Readonly<{
  schemaVersion: 1;
  policyId: PolicyIdType;
  workspaceId: WorkspaceIdType;
  createdAtIso: string;
  createdByUserId: UserIdType;
  sodConstraints?: readonly SodConstraintV1[];
}>;

export class PolicyParseError extends Error {
  public override readonly name = 'PolicyParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parsePolicyV1(value: unknown): PolicyV1 {
  if (!isRecord(value)) {
    throw new PolicyParseError('Policy must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new PolicyParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const policyId = PolicyId(readString(value, 'policyId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const createdAtIso = readString(value, 'createdAtIso');
  const createdByUserId = UserId(readString(value, 'createdByUserId'));

  const sodConstraintsRaw = value['sodConstraints'];
  const sodConstraints =
    sodConstraintsRaw === undefined ? undefined : parseSodConstraintsV1(sodConstraintsRaw);

  return {
    schemaVersion: 1,
    policyId,
    workspaceId,
    createdAtIso,
    createdByUserId,
    ...(sodConstraints ? { sodConstraints } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PolicyParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PolicyParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

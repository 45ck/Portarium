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
  name: string;
  description?: string;
  active: boolean;
  priority: number;
  version: number;
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
  const name = readString(value, 'name');
  const description = readOptionalString(value, 'description');
  const active = readBoolean(value, 'active');
  const priority = readNumber(value, 'priority');
  const version = readNumber(value, 'version');
  const createdAtIso = readString(value, 'createdAtIso');
  parseIsoString(createdAtIso, 'createdAtIso');
  const createdByUserId = UserId(readString(value, 'createdByUserId'));

  const sodConstraintsRaw = value['sodConstraints'];
  const sodConstraints =
    sodConstraintsRaw === undefined ? undefined : parseSodConstraintsV1(sodConstraintsRaw);

  return {
    schemaVersion: 1,
    policyId,
    workspaceId,
    name,
    ...(description !== undefined ? { description } : {}),
    active,
    priority,
    version,
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

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PolicyParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new PolicyParseError(`${key} must be a boolean.`);
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

function parseIsoString(value: string, label: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PolicyParseError(`${label} must be a valid ISO timestamp.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

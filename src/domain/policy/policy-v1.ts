import {
  PolicyId,
  UserId,
  WorkspaceId,
  type PolicyId as PolicyIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readBoolean,
  readEnum,
  readInteger,
  readIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

import type { SodConstraintV1 } from './sod-constraints-v1.js';
import { parseSodConstraintsV1 } from './sod-constraints-v1.js';

export type PolicyInlineRuleV1 = Readonly<{
  ruleId: string;
  condition: string;
  effect: 'Allow' | 'Deny';
}>;

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
  rules?: readonly PolicyInlineRuleV1[];
}>;

export class PolicyParseError extends Error {
  public override readonly name = 'PolicyParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parsePolicyV1(value: unknown): PolicyV1 {
  const record = readRecord(value, 'Policy', PolicyParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PolicyParseError);
  if (schemaVersion !== 1) {
    throw new PolicyParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const policyId = PolicyId(readString(record, 'policyId', PolicyParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', PolicyParseError));
  const name = readString(record, 'name', PolicyParseError);
  const description = readOptionalString(record, 'description', PolicyParseError);
  const active = readBoolean(record, 'active', PolicyParseError);
  const priority = readInteger(record, 'priority', PolicyParseError);
  const version = readInteger(record, 'version', PolicyParseError);
  const createdAtIso = readIsoString(record, 'createdAtIso', PolicyParseError);
  const createdByUserId = UserId(readString(record, 'createdByUserId', PolicyParseError));

  const sodConstraintsRaw = record['sodConstraints'];
  const sodConstraints =
    sodConstraintsRaw === undefined ? undefined : parseSodConstraintsV1(sodConstraintsRaw);

  const rulesRaw = record['rules'];
  const rules = rulesRaw === undefined ? undefined : parsePolicyRulesV1(rulesRaw);

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
    ...(rules ? { rules } : {}),
  };
}

function parsePolicyRulesV1(value: unknown): readonly PolicyInlineRuleV1[] {
  if (!Array.isArray(value)) {
    throw new PolicyParseError('rules must be an array.');
  }
  return value.map((r, idx) => parsePolicyRuleV1(r, `rules[${idx}]`));
}

function parsePolicyRuleV1(value: unknown, pathLabel: string): PolicyInlineRuleV1 {
  const record = readRecord(value, pathLabel, PolicyParseError);
  const ruleId = readString(record, 'ruleId', PolicyParseError);
  const condition = readString(record, 'condition', PolicyParseError);
  const effect = readEnum(record, 'effect', ['Allow', 'Deny'] as const, PolicyParseError);
  return { ruleId, condition, effect };
}

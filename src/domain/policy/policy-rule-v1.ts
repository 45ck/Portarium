import { PolicyId, type PolicyId as PolicyIdType } from '../primitives/index.js';

export type PolicyRuleV1 = Readonly<{
  policyId: PolicyIdType;
  ruleType: string;
  expression: string;
  priority: number;
}>;

export class PolicyRuleParseError extends Error {
  public override readonly name = 'PolicyRuleParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parsePolicyRuleV1(value: unknown): PolicyRuleV1 {
  if (!isRecord(value)) {
    throw new PolicyRuleParseError('PolicyRule must be an object.');
  }

  const policyId = PolicyId(readString(value, 'policyId'));
  const ruleType = readString(value, 'ruleType');
  const expression = readString(value, 'expression');
  const priority = readNumber(value, 'priority');

  return {
    policyId,
    ruleType,
    expression,
    priority,
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PolicyRuleParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PolicyRuleParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

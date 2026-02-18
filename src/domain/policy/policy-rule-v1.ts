import { PolicyId, type PolicyId as PolicyIdType } from '../primitives/index.js';
import { readInteger, readRecord, readString } from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'PolicyRule', PolicyRuleParseError);

  const policyId = PolicyId(readString(record, 'policyId', PolicyRuleParseError));
  const ruleType = readString(record, 'ruleType', PolicyRuleParseError);
  const expression = readString(record, 'expression', PolicyRuleParseError);
  const priority = readInteger(record, 'priority', PolicyRuleParseError);

  return {
    policyId,
    ruleType,
    expression,
    priority,
  };
}

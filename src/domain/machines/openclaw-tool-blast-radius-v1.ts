import type { ExecutionTier } from '../primitives/index.js';

export type OpenClawToolRiskCategoryV1 = 'ReadOnly' | 'Mutation' | 'Dangerous' | 'Unknown';

export type OpenClawToolBlastRadiusPolicyV1 = Readonly<{
  toolName: string;
  category: OpenClawToolRiskCategoryV1;
  minimumTier: ExecutionTier;
  rationale: string;
}>;

export type OpenClawToolTierViolationV1 = Readonly<{
  toolName: string;
  category: OpenClawToolRiskCategoryV1;
  requiredTier: ExecutionTier;
  policyTier: ExecutionTier;
  rationale: string;
}>;

export type OpenClawToolPolicyDecisionV1 = 'Allow' | 'Deny';
export type OpenClawBlockedRunStateV1 = 'PolicyBlocked';

export type OpenClawToolPolicyEvaluationV1 =
  | Readonly<{
      decision: 'Allow';
      toolPolicy: OpenClawToolBlastRadiusPolicyV1;
    }>
  | Readonly<{
      decision: 'Deny';
      runState: OpenClawBlockedRunStateV1;
      violation: OpenClawToolTierViolationV1;
    }>;

const TIER_RANK: Readonly<Record<ExecutionTier, number>> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /(^|[:._-])(shell|terminal|powershell|bash|cmd)([:._-]|$)/i,
  /(^|[:._-])(system|os)([:._-])?(exec|command|process)([:._-]|$)/i,
  /(^|[:._-])(browser|playwright|puppeteer|selenium)([:._-]|$)/i,
  /(^|[:._-])(package|tool)([:._-])?(install|update|remove)([:._-]|$)/i,
];

const MUTATION_PATTERNS: readonly RegExp[] = [
  /(^|[:._-])(write|create|update|delete|remove|send|post|put|patch)([:._-]|$)/i,
  /(^|[:._-])(trigger|invoke|deploy|publish|approve|transfer|charge|refund)([:._-]|$)/i,
];

const READ_ONLY_PATTERNS: readonly RegExp[] = [
  /(^|[:._-])(read|get|list|search|lookup|query|fetch|inspect|validate)([:._-]|$)/i,
  /(^|[:._-])(classify|summarize|extract|analyze)([:._-]|$)/i,
];

export function classifyOpenClawToolBlastRadiusV1(toolName: string): OpenClawToolBlastRadiusPolicyV1 {
  const normalized = toolName.trim();

  if (matchesAny(normalized, DANGEROUS_PATTERNS)) {
    return {
      toolName: normalized,
      category: 'Dangerous',
      minimumTier: 'ManualOnly',
      rationale:
        'Dangerous tools can execute host commands or automation and must remain ManualOnly.',
    };
  }

  if (matchesAny(normalized, MUTATION_PATTERNS)) {
    return {
      toolName: normalized,
      category: 'Mutation',
      minimumTier: 'HumanApprove',
      rationale: 'Mutating tools can change external state and require HumanApprove or stricter.',
    };
  }

  if (matchesAny(normalized, READ_ONLY_PATTERNS)) {
    return {
      toolName: normalized,
      category: 'ReadOnly',
      minimumTier: 'Auto',
      rationale: 'Read-only or analysis tools are allowed in Auto tier.',
    };
  }

  return {
    toolName: normalized,
    category: 'Unknown',
    minimumTier: 'HumanApprove',
    rationale: 'Unknown tools default to HumanApprove to reduce blast radius.',
  };
}

export function isOpenClawToolAllowedAtTierV1(input: {
  toolName: string;
  policyTier: ExecutionTier;
}): boolean {
  return evaluateOpenClawToolPolicyV1(input).decision === 'Allow';
}

export function validateOpenClawToolPolicyTierV1(input: {
  policyTier: ExecutionTier;
  allowedTools: readonly string[];
}): readonly OpenClawToolTierViolationV1[] {
  const violations: OpenClawToolTierViolationV1[] = [];
  for (const toolName of input.allowedTools) {
    const result = evaluateOpenClawToolPolicyV1({
      toolName,
      policyTier: input.policyTier,
    });
    if (result.decision === 'Deny') {
      violations.push(result.violation);
    }
  }
  return violations;
}

export function evaluateOpenClawToolPolicyV1(input: {
  toolName: string;
  policyTier: ExecutionTier;
}): OpenClawToolPolicyEvaluationV1 {
  const policy = classifyOpenClawToolBlastRadiusV1(input.toolName);
  if (TIER_RANK[input.policyTier] >= TIER_RANK[policy.minimumTier]) {
    return {
      decision: 'Allow',
      toolPolicy: policy,
    };
  }

  return {
    decision: 'Deny',
    runState: 'PolicyBlocked',
    violation: {
      toolName: policy.toolName,
      category: policy.category,
      requiredTier: policy.minimumTier,
      policyTier: input.policyTier,
      rationale: policy.rationale,
    },
  };
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

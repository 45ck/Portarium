/**
 * Policy-driven tool exposure per workspace, role, and execution tier.
 *
 * Defines which MCP tools are available to a given caller based on their
 * workspace, role, and the configured execution tier. This is a domain-level
 * policy -- no infrastructure imports.
 */

import type { ExecutionTier, WorkspaceUserRole } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolExposureRuleV1 = Readonly<{
  /** Tool name pattern (exact match or glob-like with trailing *). */
  toolPattern: string;
  /** Roles allowed to use this tool. Empty = all roles. */
  allowedRoles: readonly WorkspaceUserRole[];
  /** Minimum execution tier required. */
  minimumTier: ExecutionTier;
}>;

export type ToolExposurePolicyV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: string;
  rules: readonly ToolExposureRuleV1[];
  /** Default behavior when no rule matches. */
  defaultEffect: 'Allow' | 'Deny';
}>;

export type ToolExposureDecision = 'Allow' | 'Deny';

export type ToolExposureEvaluationV1 = Readonly<{
  toolName: string;
  decision: ToolExposureDecision;
  matchedRule?: ToolExposureRuleV1;
  reason: string;
}>;

// ---------------------------------------------------------------------------
// Tier ranking (same as blast-radius module)
// ---------------------------------------------------------------------------

const TIER_RANK: Readonly<Record<ExecutionTier, number>> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export function evaluateToolExposure(input: {
  policy: ToolExposurePolicyV1;
  toolName: string;
  callerRole: WorkspaceUserRole;
  executionTier: ExecutionTier;
}): ToolExposureEvaluationV1 {
  const { policy, toolName, callerRole, executionTier } = input;

  for (const rule of policy.rules) {
    if (!matchesToolPattern(rule.toolPattern, toolName)) continue;

    // Check role
    if (rule.allowedRoles.length > 0 && !rule.allowedRoles.includes(callerRole)) {
      return {
        toolName,
        decision: 'Deny',
        matchedRule: rule,
        reason: `Role "${callerRole}" is not in the allowed roles for "${rule.toolPattern}".`,
      };
    }

    // Check tier
    if (TIER_RANK[executionTier] < TIER_RANK[rule.minimumTier]) {
      return {
        toolName,
        decision: 'Deny',
        matchedRule: rule,
        reason: `Execution tier "${executionTier}" is below minimum "${rule.minimumTier}" for "${rule.toolPattern}".`,
      };
    }

    return {
      toolName,
      decision: 'Allow',
      matchedRule: rule,
      reason: `Allowed by rule "${rule.toolPattern}".`,
    };
  }

  return {
    toolName,
    decision: policy.defaultEffect,
    reason:
      policy.defaultEffect === 'Allow'
        ? 'No matching rule; default allow.'
        : 'No matching rule; default deny.',
  };
}

/**
 * Given a policy and caller context, return the set of tool names that are
 * allowed from the provided full list.
 */
export function filterAllowedTools(input: {
  policy: ToolExposurePolicyV1;
  allToolNames: readonly string[];
  callerRole: WorkspaceUserRole;
  executionTier: ExecutionTier;
}): readonly string[] {
  return input.allToolNames.filter((toolName) => {
    const result = evaluateToolExposure({
      policy: input.policy,
      toolName,
      callerRole: input.callerRole,
      executionTier: input.executionTier,
    });
    return result.decision === 'Allow';
  });
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

function matchesToolPattern(pattern: string, toolName: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) {
    return toolName.startsWith(pattern.slice(0, -1));
  }
  return pattern === toolName;
}

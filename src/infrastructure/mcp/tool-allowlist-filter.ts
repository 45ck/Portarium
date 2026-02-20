/**
 * Tool allowlist filter for MCP server.
 *
 * Bridges the domain-level ToolExposurePolicyV1 to the MCP server's
 * allowedTools set. Given a policy, caller role, and execution tier,
 * produces the set of tool names the MCP server should expose.
 */

import {
  filterAllowedTools,
  type ToolExposurePolicyV1,
} from '../../domain/policy/tool-exposure-policy-v1.js';
import type { ExecutionTier, WorkspaceUserRole } from '../../domain/primitives/index.js';
import { listToolNames } from './mcp-tool-schemas.js';

export type ToolAllowlistInput = Readonly<{
  policy: ToolExposurePolicyV1;
  callerRole: WorkspaceUserRole;
  executionTier: ExecutionTier;
}>;

/**
 * Compute the set of MCP tool names allowed for a given caller.
 * The returned set can be passed to `PortariumMcpServer` as `allowedTools`.
 */
export function computeToolAllowlist(input: ToolAllowlistInput): ReadonlySet<string> {
  const allToolNames = listToolNames();
  const allowed = filterAllowedTools({
    policy: input.policy,
    allToolNames,
    callerRole: input.callerRole,
    executionTier: input.executionTier,
  });
  return new Set(allowed);
}

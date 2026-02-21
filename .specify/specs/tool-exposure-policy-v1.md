# Tool Exposure Policy v1

## Purpose

Define which MCP tools are available to a given caller based on workspace
configuration, caller role, and execution tier. Prevents unauthorized tool
access at the protocol level.

## Policy Structure

A `ToolExposurePolicyV1` consists of:

- `workspaceId` -- scope of the policy.
- `rules` -- ordered list of `ToolExposureRuleV1` entries.
- `defaultEffect` -- `Allow` or `Deny` when no rule matches.

Each rule specifies:

- `toolPattern` -- exact tool name or prefix wildcard (e.g. `portarium_run_*`).
- `allowedRoles` -- workspace roles permitted (empty = all roles).
- `minimumTier` -- lowest execution tier at which the tool is available.

## Evaluation Semantics

1. Rules are evaluated in order; the **first matching rule** wins.
2. A rule matches if the tool pattern matches the tool name.
3. If the rule matches but the caller's role is not in `allowedRoles`, the tool
   is denied.
4. If the rule matches but the execution tier is below `minimumTier`, the tool
   is denied.
5. If no rule matches, `defaultEffect` applies.

## Pattern Matching

- Exact match: `portarium_run_start` matches only that tool.
- Prefix wildcard: `portarium_run_*` matches any tool starting with `portarium_run_`.
- Catch-all: `*` matches any tool name.

## Integration with MCP Server

The `tool-allowlist-filter` computes a `Set<string>` of allowed tool names
from the policy, which is passed to the MCP server's `allowedTools` option.
Filtered tools are excluded from `tools/list` and rejected by `tools/call`.

## Test Expectations

- Allow/deny by role.
- Allow/deny by tier.
- Wildcard and exact pattern matching.
- First-match-wins rule ordering.
- Default effect when no rules match.
- `filterAllowedTools` integration.

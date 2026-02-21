# MCP Server v1

## Purpose

Expose Portarium control-plane operations as MCP (Model Context Protocol) tools
so that AI agents, IDE integrations, and CLI tools can interact with Portarium
through a standardized JSON-RPC 2.0 interface.

## Protocol

- JSON-RPC 2.0 over any transport (HTTP+SSE, stdio, WebSocket).
- MCP protocol version: `2024-11-05`.
- Methods: `initialize`, `tools/list`, `tools/call`.

## Tools

| Tool name                   | Maps to          | Description                       |
| --------------------------- | ---------------- | --------------------------------- |
| `portarium_run_start`       | `startRun`       | Start a workflow run              |
| `portarium_run_get`         | `getRun`         | Query run status                  |
| `portarium_run_cancel`      | `cancelRun`      | Cancel an active run              |
| `portarium_work_items_list` | `listWorkItems`  | List work items                   |
| `portarium_approval_submit` | `submitApproval` | Submit approval decision          |
| `portarium_agent_register`  | `registerAgent`  | Register agent with control plane |
| `portarium_agent_heartbeat` | `agentHeartbeat` | Agent liveness heartbeat          |

## Input Validation

Each tool defines a JSON Schema for its `arguments`. Missing required
parameters return a JSON-RPC error (`-32603`) before dispatch.

## Tool Filtering

The server accepts an optional `allowedTools` set. When configured, only tools
in the set appear in `tools/list` and are callable via `tools/call`. This
enables policy-driven tool exposure (see tool-exposure-policy-v1).

## Security

- No secrets are returned in tool responses.
- The `PortariumClient` implementation is responsible for injecting
  authentication credentials (see credential-delegation).
- Tool access can be restricted per workspace/role via the `allowedTools`
  filter.

## Test Expectations

- `initialize` returns server info.
- `tools/list` returns all 7 tools (or filtered subset).
- Each tool dispatches to the correct client method.
- Missing params produce structured errors.
- Client failures produce JSON-RPC internal errors.
- Filtered tools are not callable.

/**
 * Portarium Governance Plugin for OpenClaw
 *
 * A native OpenClaw plugin that intercepts all tool calls via the before_tool_call
 * hook and routes them through Portarium's policy engine before execution.
 *
 * Governance flow:
 *   Agent calls any tool
 *   → before_tool_call hook fires (priority 1000)
 *   → Plugin POSTs to Portarium /agent-actions:propose
 *   → Policy evaluation: allow / deny / awaiting_approval
 *   → If awaiting_approval: hook suspends, polls until human decides
 *   → Result: tool allowed or rejected with reason
 *
 * Config (openclaw.plugin.json configSchema):
 *   portariumUrl   - base URL of Portarium control plane
 *   workspaceId    - workspace to govern within
 *   bearerToken    - auth token
 *   tenantId       - defaults to 'default'
 *   failClosed     - block tools when Portarium unreachable (default: true)
 *   approvalTimeoutMs - max wait for human approval (default: 24h)
 *   pollIntervalMs - approval poll frequency (default: 3s)
 *   bypassToolNames - tools that skip governance (internal Portarium tools)
 */

// Re-export types for external use
export type { PortariumPluginConfig } from './config.js';
export type { PortariumClient } from './client/portarium-client.js';
export { resolveConfig } from './config.js';
export { PortariumClient as PortariumClientClass } from './client/portarium-client.js';

import { resolveConfig } from './config.js';
import { PortariumClient } from './client/portarium-client.js';
import { ApprovalPoller } from './services/approval-poller.js';
import { registerBeforeToolCallHook } from './hooks/before-tool-call.js';
import { registerGetRunTool } from './tools/get-run.js';
import { registerListApprovalsTool } from './tools/list-approvals.js';
import { registerCapabilityLookupTool } from './tools/capability-lookup.js';
import { registerHealthMethod } from './gateway/health.js';

/**
 * Plugin entry point.
 *
 * This module is loaded by OpenClaw's plugin system when the user has
 * configured and enabled the "portarium" plugin. OpenClaw calls register(api)
 * to set up all capabilities.
 *
 * The actual definePluginEntry import path depends on the installed OpenClaw
 * version. This is written as a plain export to avoid a hard peer dependency
 * at import time — OpenClaw's loader wraps this for us.
 */

interface PluginApi {
  readonly id: string;
  readonly config: Record<string, unknown>;
  readonly logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
  registerHook(spec: {
    name: string;
    priority?: number;
    handler: (ctx: {
      toolName: string;
      parameters?: Record<string, unknown>;
      sessionKey?: string;
      reject(reason: string): void;
    }) => Promise<void>;
  }): void;
  registerTool(spec: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    handler: (input: Record<string, unknown>) => Promise<unknown>;
  }): void;
  registerGatewayMethod(spec: {
    name: string;
    handler: (input: Record<string, unknown>) => Promise<unknown>;
  }): void;
}

function register(api: PluginApi): void {
  const config = resolveConfig(api.config);
  const client = new PortariumClient(config);
  const poller = new ApprovalPoller(client, config);

  // Layer 1: Transparent governance — intercepts ALL tool calls
  registerBeforeToolCallHook(api.registerHook.bind(api), client, poller, config, api.logger);

  // Layer 2: Explicit Portarium-facing agent tools
  registerGetRunTool(api.registerTool.bind(api), client);
  registerListApprovalsTool(api.registerTool.bind(api), client);
  registerCapabilityLookupTool(api.registerTool.bind(api), client);

  // Operator visibility: Gateway RPC health check
  registerHealthMethod(api.registerGatewayMethod.bind(api), client, config);

  api.logger.info(
    `[portarium] Plugin registered — governing ${config.workspaceId} at ${config.portariumUrl} (failClosed=${config.failClosed})`,
  );
}

// Export in both named and default forms for OpenClaw plugin loader compatibility
export { register };
export default { id: 'portarium', register };

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
 * Config (plugins.entries.portarium.config in openclaw config):
 *   portariumUrl   - base URL of Portarium control plane
 *   workspaceId    - workspace to govern within
 *   bearerToken    - auth token
 *   tenantId       - defaults to 'default'
 *   failClosed     - block tools when Portarium unreachable (default: true)
 *   approvalTimeoutMs - max wait for human approval (default: 24h)
 *   pollIntervalMs - approval poll frequency (default: 3s)
 *   bypassToolNames - tools that skip governance (internal Portarium tools)
 */

export type { PortariumPluginConfig } from './config.js';
export { resolveConfig } from './config.js';
export { PortariumClient } from './client/portarium-client.js';

import type { TSchema } from '@sinclair/typebox';
import { resolveConfig } from './config.js';
import { PortariumClient } from './client/portarium-client.js';
import { ApprovalPoller } from './services/approval-poller.js';
import { registerBeforeToolCallHook } from './hooks/before-tool-call.js';
import { createGetRunTool } from './tools/get-run.js';
import { createListApprovalsTool } from './tools/list-approvals.js';
import { createCapabilityLookupTool } from './tools/capability-lookup.js';

/**
 * Minimal slice of the OpenClaw plugin API used by this plugin.
 * The full type lives in 'openclaw/plugin-sdk/plugin-entry' (peer dep).
 */
export interface PluginApi {
  readonly id: string;
  readonly pluginConfig: Record<string, unknown>;
  readonly logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
  on(
    event: string,
    handler: (
      event: { toolName: string; params: Record<string, unknown>; runId?: string },
      ctx: { sessionKey?: string; agentId?: string; runId?: string },
    ) => Promise<{ block?: boolean; blockReason?: string } | void>,
    opts?: { priority?: number },
  ): void;
  registerTool(
    tool: {
      name: string;
      description: string;
      parameters: TSchema;
      execute(toolCallId: string, params: Record<string, unknown>): Promise<unknown>;
    },
    opts?: { optional?: boolean },
  ): void;
  registerGatewayMethod(
    name: string,
    handler: (input: Record<string, unknown>) => Promise<unknown>,
    opts?: { scope?: string },
  ): void;
}

/**
 * Plugin entry object compatible with OpenClaw's definePluginEntry shape.
 *
 * When openclaw is installed, wrap with definePluginEntry from
 * 'openclaw/plugin-sdk/plugin-entry'. Exported directly for tests and
 * non-OpenClaw hosts.
 */
export const portariumPlugin = {
  id: 'portarium',
  name: 'Portarium Governance',
  description:
    'Routes all agent tool calls through Portarium policy engine, blocking or queuing for human approval.',

  register(api: PluginApi): void {
    const config = resolveConfig(api.pluginConfig);
    const client = new PortariumClient(config);
    const poller = new ApprovalPoller(client, config);

    // Layer 1: Transparent governance — intercepts ALL tool calls
    registerBeforeToolCallHook(api, client, poller, config, api.logger);

    // Layer 2: Explicit Portarium-facing agent tools (optional — user opt-in)
    api.registerTool(createGetRunTool(client), { optional: true });
    api.registerTool(createListApprovalsTool(client), { optional: true });
    api.registerTool(createCapabilityLookupTool(client), { optional: true });

    // Operator visibility: Gateway RPC health check
    api.registerGatewayMethod('portarium.status', async () => {
      const url = `${config.portariumUrl}/health`;
      try {
        const response = await fetch(url, {
          headers: { authorization: `Bearer ${config.bearerToken}` },
          signal: AbortSignal.timeout(5_000),
        });
        return {
          ok: response.ok,
          status: response.status,
          portariumUrl: config.portariumUrl,
          workspaceId: config.workspaceId,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          portariumUrl: config.portariumUrl,
          workspaceId: config.workspaceId,
        };
      }
    });

    api.logger.info(
      `[portarium] Plugin registered — governing ${config.workspaceId} at ${config.portariumUrl} (failClosed=${config.failClosed})`,
    );
  },
};

export default portariumPlugin;

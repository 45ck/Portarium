/**
 * Agent tool: portarium_capability_lookup
 * Lets the agent discover the governance tier for a specific tool.
 */
import { Type } from '@sinclair/typebox';
import type { PortariumClient } from '../client/portarium-client.js';

export function createCapabilityLookupTool(client: PortariumClient) {
  return {
    name: 'portarium_capability_lookup',
    description:
      'Look up the governance tier and risk classification for a specific tool name. Use this to understand what approval policy applies before calling a tool.',
    parameters: Type.Object({
      toolName: Type.String({
        description: 'The tool name to look up in the Portarium capability registry',
      }),
    }),
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const toolName = String(params.toolName ?? '');
      if (!toolName) return { error: 'toolName is required' };

      const info = await client.lookupCapability(toolName);
      if (!info) {
        return {
          toolName,
          requiredTier: 'HumanApprove',
          riskClass: 'unknown',
          note: 'Not found in capability registry — defaulting to HumanApprove',
        };
      }
      return info;
    },
  };
}

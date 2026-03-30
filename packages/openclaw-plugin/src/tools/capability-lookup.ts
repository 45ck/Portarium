/**
 * Agent tool: portarium_capability_lookup
 * Lets the agent discover the governance tier for a specific tool.
 */
import type { PortariumClient } from '../client/portarium-client.js';

type RegisterToolFn = (spec: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}) => void;

export function registerCapabilityLookupTool(
  registerTool: RegisterToolFn,
  client: PortariumClient,
): void {
  registerTool({
    name: 'portarium_capability_lookup',
    description:
      'Look up the governance tier and risk classification for a specific tool name. Use this to understand what approval policy applies before calling a tool.',
    inputSchema: {
      type: 'object',
      required: ['toolName'],
      properties: {
        toolName: {
          type: 'string',
          description: 'The tool name to look up in the Portarium capability registry',
        },
      },
    },
    handler: async (input: Record<string, unknown>) => {
      const toolName = String(input.toolName ?? '');
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
  });
}

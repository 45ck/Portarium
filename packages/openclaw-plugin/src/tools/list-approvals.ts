/**
 * Agent tool: portarium_list_approvals
 * Lists pending approvals for this workspace.
 */
import type { PortariumClient } from '../client/portarium-client.js';

type RegisterToolFn = (spec: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}) => void;

export function registerListApprovalsTool(
  registerTool: RegisterToolFn,
  client: PortariumClient,
): void {
  registerTool({
    name: 'portarium_list_approvals',
    description:
      'List pending approvals in the current Portarium workspace. Use this to see which tool calls are awaiting human approval.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const approvals = await client.listPendingApprovals();
      return {
        count: approvals.length,
        approvals,
      };
    },
  });
}

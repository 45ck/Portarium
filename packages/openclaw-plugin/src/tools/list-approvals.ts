/**
 * Agent tool: portarium_list_approvals
 * Lists pending approvals for this workspace.
 */
import { Type } from '@sinclair/typebox';
import type { PortariumClient } from '../client/portarium-client.js';

export function createListApprovalsTool(client: PortariumClient) {
  return {
    name: 'portarium_list_approvals',
    description:
      'List pending approvals in the current Portarium workspace. Use this to see which tool calls are awaiting human approval.',
    parameters: Type.Object({}),
    async execute(_toolCallId: string, _params: Record<string, unknown>) {
      const approvals = await client.listPendingApprovals();
      return {
        count: approvals.length,
        approvals,
      };
    },
  };
}

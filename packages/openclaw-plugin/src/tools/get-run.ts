/**
 * Agent tool: portarium_get_run
 * Lets the agent check the status of a Portarium governed run.
 */
import type { PortariumClient } from '../client/portarium-client.js';

type RegisterToolFn = (spec: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}) => void;

export function registerGetRunTool(registerTool: RegisterToolFn, client: PortariumClient): void {
  registerTool({
    name: 'portarium_get_run',
    description:
      'Get the status of a Portarium governed run. Use this to check if a run is active, pending approval, or completed.',
    inputSchema: {
      type: 'object',
      required: ['runId'],
      properties: {
        runId: {
          type: 'string',
          description: 'The Portarium run ID to look up',
        },
      },
    },
    handler: async (input: Record<string, unknown>) => {
      const runId = String(input.runId ?? '');
      if (!runId) return { error: 'runId is required' };

      const status = await client.getRunStatus(runId);
      if (!status) return { error: `Run "${runId}" not found or inaccessible` };
      return status;
    },
  });
}

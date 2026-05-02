/**
 * Agent tool: portarium_get_run
 * Lets the agent check the status of a Portarium governed run.
 */
import { Type } from '@sinclair/typebox';
import type { PortariumClient } from '../client/portarium-client.js';

export function createGetRunTool(client: PortariumClient) {
  return {
    name: 'portarium_get_run',
    description:
      'Get the status of a Portarium governed run. Use this to check if a run is active, pending approval, or completed.',
    parameters: Type.Object({
      runId: Type.String({ description: 'The Portarium run ID to look up' }),
    }),
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const runId = String(params.runId ?? '');
      if (!runId) return { error: 'runId is required' };

      const status = await client.getRunStatus(runId);
      if (!status) return { error: `Run "${runId}" not found or inaccessible` };
      return status;
    },
  };
}

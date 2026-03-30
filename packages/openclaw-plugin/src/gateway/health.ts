/**
 * Gateway RPC method: portarium.status
 * Lets operators check Portarium governance status from the OpenClaw Gateway.
 */
import type { PortariumPluginConfig } from '../config.js';
import type { PortariumClient } from '../client/portarium-client.js';

type RegisterGatewayMethodFn = (spec: {
  name: string;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}) => void;

export function registerHealthMethod(
  registerGatewayMethod: RegisterGatewayMethodFn,
  client: PortariumClient,
  config: PortariumPluginConfig,
): void {
  registerGatewayMethod({
    name: 'portarium.status',
    handler: async () => {
      // Probe Portarium by listing approvals (lightweight read)
      try {
        await client.listPendingApprovals();
        return {
          status: 'connected',
          portariumUrl: config.portariumUrl,
          workspaceId: config.workspaceId,
          failClosed: config.failClosed,
        };
      } catch {
        return {
          status: 'unreachable',
          portariumUrl: config.portariumUrl,
          workspaceId: config.workspaceId,
          failClosed: config.failClosed,
        };
      }
    },
  });
}

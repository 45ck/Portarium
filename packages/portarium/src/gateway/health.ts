/**
 * Gateway RPC method: portarium.status
 * Lets operators check Portarium governance status from the OpenClaw Gateway.
 *
 * API: api.registerGatewayMethod(name, handler, opts?)
 */
import type { PortariumPluginConfig } from '../config.js';
import type { PortariumClient } from '../client/portarium-client.js';

type RegisterGatewayMethodFn = (
  name: string,
  handler: (input: Record<string, unknown>) => Promise<unknown>,
  opts?: { scope?: string },
) => void;

export function registerHealthMethod(
  registerGatewayMethod: RegisterGatewayMethodFn,
  client: PortariumClient,
  _config: PortariumPluginConfig,
): void {
  registerGatewayMethod('portarium.status', async () => {
    return client.ping();
  });
}

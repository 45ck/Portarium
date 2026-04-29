import { describe, it, expect, vi } from 'vitest';
import { PortariumClient } from '../client/portarium-client.js';
import { resolveConfig } from '../config.js';
import { registerHealthMethod } from './health.js';

function makeConfig() {
  return resolveConfig({
    portariumUrl: 'https://portarium.test',
    workspaceId: 'ws-test',
    bearerToken: 'tok-test',
  });
}

function mockFetch(response: unknown, status = 200): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
  })) as unknown as typeof fetch;
}

function captureRegistration(client: PortariumClient, config: ReturnType<typeof makeConfig>) {
  let capturedName = '';
  let capturedHandler: ((input: Record<string, unknown>) => Promise<unknown>) | null = null;

  const registerGatewayMethod = (
    name: string,
    handler: (input: Record<string, unknown>) => Promise<unknown>,
  ) => {
    capturedName = name;
    capturedHandler = handler;
  };

  registerHealthMethod(registerGatewayMethod, client, config);
  return { name: capturedName, handler: capturedHandler! };
}

describe('portarium.status gateway method', () => {
  it('registers with the correct name', () => {
    const config = makeConfig();
    const client = new PortariumClient(config, mockFetch({ items: [] }));
    const { name } = captureRegistration(client, config);
    expect(name).toBe('portarium.status');
  });

  it('returns connected when Portarium is reachable', async () => {
    const config = makeConfig();
    const client = new PortariumClient(config, mockFetch({ items: [] }));
    const { handler } = captureRegistration(client, config);

    const result = await handler({});
    expect(result).toEqual({
      ok: true,
      status: 200,
      portariumUrl: 'https://portarium.test',
      workspaceId: 'ws-test',
    });
  });

  it('returns ping failure when client reports unreachable', async () => {
    const config = makeConfig();
    const client = new PortariumClient(config, mockFetch({ items: [] }));
    vi.spyOn(client, 'ping').mockResolvedValueOnce({
      ok: false,
      error: 'ECONNREFUSED',
      portariumUrl: 'https://portarium.test',
      workspaceId: 'ws-test',
    });
    const { handler } = captureRegistration(client, config);

    const result = await handler({});
    expect(result).toEqual({
      ok: false,
      error: 'ECONNREFUSED',
      portariumUrl: 'https://portarium.test',
      workspaceId: 'ws-test',
    });
  });

  it('uses the client ping path so injected fetch failures are reported', async () => {
    const config = makeConfig();
    const failFetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const client = new PortariumClient(config, failFetch);
    const { handler } = captureRegistration(client, config);

    const result = await handler({});
    expect(result).toEqual({
      ok: false,
      error: 'ECONNREFUSED',
      portariumUrl: 'https://portarium.test',
      workspaceId: 'ws-test',
    });
  });
});

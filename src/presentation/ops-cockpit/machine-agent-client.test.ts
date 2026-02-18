import { describe, expect, it } from 'vitest';

import { MachineAgentClient } from './machine-agent-client.js';

interface RecordedCall {
  input: string;
  init: RequestInit;
}

function createJsonFetch(
  body: unknown,
  status = 200,
): {
  calls: RecordedCall[];
  fetchImpl: typeof fetch;
} {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (input: unknown, init: RequestInit = {}) => {
    calls.push({ input: String(input), init });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(),
      text: async () => JSON.stringify(body),
    } as Response;
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function makeClient(fetchImpl: typeof fetch): MachineAgentClient {
  return new MachineAgentClient({
    baseUrl: 'https://api.portarium.test',
    fetchImpl,
  });
}

// ---------------------------------------------------------------------------
// Machine runtime registry (bead-0438)
// ---------------------------------------------------------------------------

describe('MachineAgentClient machine runtime routes', () => {
  it('listMachines builds correct path with cursor pagination', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [], nextCursor: null });
    const client = makeClient(fetchImpl);

    await client.listMachines('ws', { limit: 10, cursor: 'next:abc' });

    const url = new URL(calls[0]!.input);
    expect(url.pathname).toBe('/v1/workspaces/ws/machines');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('cursor')).toBe('next:abc');
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('registerMachine sends POST with body and optional idempotency key', async () => {
    const { calls, fetchImpl } = createJsonFetch({
      schemaVersion: 1,
      machineId: 'm-1',
      workspaceId: 'ws',
      hostname: 'runner-01',
      registeredAtIso: '2026-01-01T00:00:00Z',
      status: 'Online',
    });
    const client = makeClient(fetchImpl);

    await client.registerMachine('ws', { hostname: 'runner-01' }, 'idem-m');

    const call = calls[0]!;
    expect(new URL(call.input).pathname).toBe('/v1/workspaces/ws/machines');
    expect(call.init.method).toBe('POST');
    expect((call.init.headers as Headers).get('Idempotency-Key')).toBe('idem-m');
    expect(JSON.parse(call.init.body as string)).toEqual({ hostname: 'runner-01' });
  });

  it('getMachine builds correct path', async () => {
    const { calls, fetchImpl } = createJsonFetch({ schemaVersion: 1 });
    const client = makeClient(fetchImpl);

    await client.getMachine('ws', 'm-42');

    expect(new URL(calls[0]!.input).pathname).toBe('/v1/workspaces/ws/machines/m-42');
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('deregisterMachine sends DELETE', async () => {
    const { calls, fetchImpl } = createJsonFetch(null, 204);
    const client = makeClient(fetchImpl);

    await client.deregisterMachine('ws', 'm-42');

    expect(new URL(calls[0]!.input).pathname).toBe('/v1/workspaces/ws/machines/m-42');
    expect(calls[0]!.init.method).toBe('DELETE');
  });

  it('testMachineConnection sends POST to /test and returns result', async () => {
    const result = { status: 'ok', latencyMs: 42 };
    const { calls, fetchImpl } = createJsonFetch(result);
    const client = makeClient(fetchImpl);

    const res = await client.testMachineConnection('ws', 'm-1');

    expect(new URL(calls[0]!.input).pathname).toBe('/v1/workspaces/ws/machines/m-1/test');
    expect(calls[0]!.init.method).toBe('POST');
    expect(res).toEqual(result);
  });

  it('percent-encodes machine IDs', async () => {
    const { calls, fetchImpl } = createJsonFetch({ schemaVersion: 1 });
    const client = makeClient(fetchImpl);

    await client.getMachine('ws', 'machine/with spaces');

    expect(new URL(calls[0]!.input).pathname).toBe(
      '/v1/workspaces/ws/machines/machine%2Fwith%20spaces',
    );
  });
});

// ---------------------------------------------------------------------------
// AI agent configuration (bead-0439)
// ---------------------------------------------------------------------------

describe('MachineAgentClient agent config routes', () => {
  it('listAgents builds correct path', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [], nextCursor: null });
    const client = makeClient(fetchImpl);

    await client.listAgents('ws', { limit: 20 });

    const url = new URL(calls[0]!.input);
    expect(url.pathname).toBe('/v1/workspaces/ws/agents');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('registerAgent sends POST with body', async () => {
    const agentBody = { name: 'Classifier', endpoint: 'https://ml.example.com/classify' };
    const { calls, fetchImpl } = createJsonFetch({
      schemaVersion: 1,
      agentId: 'ag-1',
      workspaceId: 'ws',
      ...agentBody,
      allowedCapabilities: [],
    });
    const client = makeClient(fetchImpl);

    await client.registerAgent('ws', agentBody);

    expect(new URL(calls[0]!.input).pathname).toBe('/v1/workspaces/ws/agents');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(agentBody);
  });

  it('getAgent builds correct path', async () => {
    const { calls, fetchImpl } = createJsonFetch({ schemaVersion: 1 });
    const client = makeClient(fetchImpl);

    await client.getAgent('ws', 'ag-7');

    expect(new URL(calls[0]!.input).pathname).toBe('/v1/workspaces/ws/agents/ag-7');
    expect(calls[0]!.init.method).toBe('GET');
  });

  it('updateAgent sends PATCH with partial body', async () => {
    const { calls, fetchImpl } = createJsonFetch({ schemaVersion: 1, agentId: 'ag-7' });
    const client = makeClient(fetchImpl);

    await client.updateAgent('ws', 'ag-7', { allowedCapabilities: ['classify', 'analyze'] });

    const call = calls[0]!;
    expect(new URL(call.input).pathname).toBe('/v1/workspaces/ws/agents/ag-7');
    expect(call.init.method).toBe('PATCH');
    expect(JSON.parse(call.init.body as string)).toEqual({
      allowedCapabilities: ['classify', 'analyze'],
    });
  });

  it('testAgentConnection sends POST to /test', async () => {
    const result = { status: 'slow', latencyMs: 6200 };
    const { calls, fetchImpl } = createJsonFetch(result);
    const client = makeClient(fetchImpl);

    const res = await client.testAgentConnection('ws', 'ag-3');

    expect(new URL(calls[0]!.input).pathname).toBe('/v1/workspaces/ws/agents/ag-3/test');
    expect(calls[0]!.init.method).toBe('POST');
    expect(res).toEqual(result);
  });
});

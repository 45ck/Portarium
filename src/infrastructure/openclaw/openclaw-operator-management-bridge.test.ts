import { describe, expect, it, vi } from 'vitest';

import type { AgentId, MachineId, TenantId } from '../../domain/primitives/index.js';
import { OpenClawOperatorManagementBridge } from './openclaw-operator-management-bridge.js';

const TENANT = 'ws-1' as TenantId;
const MACHINE = 'machine-42' as MachineId;
const AGENT = 'agent-7' as AgentId;
const BASE_URL = 'https://operator.example.com';
const API_TOKEN = 'op-token-abc';

function makeOkFetch(status = 200): typeof fetch {
  return vi.fn<typeof fetch>(async () => new Response(null, { status }));
}

function makeErrorFetch(status: number): typeof fetch {
  return vi.fn<typeof fetch>(async () => new Response(null, { status }));
}

function makeNetworkFailFetch(): typeof fetch {
  return vi.fn<typeof fetch>(async () => {
    throw new Error('network failure');
  });
}

function makeBridge(fetchImpl: typeof fetch): OpenClawOperatorManagementBridge {
  return new OpenClawOperatorManagementBridge({
    baseUrl: BASE_URL,
    apiToken: API_TOKEN,
    fetchImpl,
  });
}

describe('OpenClawOperatorManagementBridge', () => {
  // ---------------------------------------------------------------------------
  // constructor guards
  // ---------------------------------------------------------------------------

  it('throws when baseUrl is empty', () => {
    expect(
      () =>
        new OpenClawOperatorManagementBridge({
          baseUrl: '',
          apiToken: API_TOKEN,
          fetchImpl: vi.fn<typeof fetch>(),
        }),
    ).toThrow('non-empty baseUrl');
  });

  it('throws when apiToken is empty', () => {
    expect(
      () =>
        new OpenClawOperatorManagementBridge({
          baseUrl: BASE_URL,
          apiToken: '',
          fetchImpl: vi.fn<typeof fetch>(),
        }),
    ).toThrow('non-empty apiToken');
  });

  // ---------------------------------------------------------------------------
  // syncAgentRegistration
  // ---------------------------------------------------------------------------

  it('syncAgentRegistration returns ok:true on 200', async () => {
    const fetchImpl = makeOkFetch(200);
    const bridge = makeBridge(fetchImpl);
    const result = await bridge.syncAgentRegistration(TENANT, MACHINE, AGENT, ['navigate', 'dock']);
    expect(result).toEqual({ ok: true });
  });

  it('syncAgentRegistration sends PUT to correct URL with capabilities', async () => {
    const fetchImpl = makeOkFetch(200);
    const bridge = makeBridge(fetchImpl);
    await bridge.syncAgentRegistration(TENANT, MACHINE, AGENT, ['navigate']);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/v1/operator/machines/${MACHINE}/agents/${AGENT}`);
    expect(init?.method).toBe('PUT');
    expect((init?.headers as Record<string, string>)?.['authorization']).toBe(
      `Bearer ${API_TOKEN}`,
    );
    const body = JSON.parse(init?.body as string) as { capabilities: string[] };
    expect(body.capabilities).toEqual(['navigate']);
  });

  it('syncAgentRegistration returns ok:false on 4xx', async () => {
    const bridge = makeBridge(makeErrorFetch(422));
    const result = await bridge.syncAgentRegistration(TENANT, MACHINE, AGENT, []);
    expect(result).toEqual({
      ok: false,
      reason: expect.stringContaining('422'),
    });
  });

  it('syncAgentRegistration returns ok:false on 5xx', async () => {
    const bridge = makeBridge(makeErrorFetch(503));
    const result = await bridge.syncAgentRegistration(TENANT, MACHINE, AGENT, []);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('503') });
  });

  it('syncAgentRegistration returns ok:false on network error', async () => {
    const bridge = makeBridge(makeNetworkFailFetch());
    const result = await bridge.syncAgentRegistration(TENANT, MACHINE, AGENT, []);
    expect(result).toEqual({ ok: false, reason: 'network failure' });
  });

  // ---------------------------------------------------------------------------
  // deregisterAgent
  // ---------------------------------------------------------------------------

  it('deregisterAgent returns ok:true on 200', async () => {
    const bridge = makeBridge(makeOkFetch(200));
    const result = await bridge.deregisterAgent(TENANT, MACHINE, AGENT);
    expect(result).toEqual({ ok: true });
  });

  it('deregisterAgent treats 404 as ok:true (idempotent)', async () => {
    const bridge = makeBridge(makeErrorFetch(404));
    const result = await bridge.deregisterAgent(TENANT, MACHINE, AGENT);
    expect(result).toEqual({ ok: true });
  });

  it('deregisterAgent sends DELETE to correct URL', async () => {
    const fetchImpl = makeOkFetch(204);
    const bridge = makeBridge(fetchImpl);
    await bridge.deregisterAgent(TENANT, MACHINE, AGENT);
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/v1/operator/machines/${MACHINE}/agents/${AGENT}`);
    expect(init?.method).toBe('DELETE');
  });

  it('deregisterAgent returns ok:false on 5xx', async () => {
    const bridge = makeBridge(makeErrorFetch(500));
    const result = await bridge.deregisterAgent(TENANT, MACHINE, AGENT);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('500') });
  });

  it('deregisterAgent returns ok:false on network error', async () => {
    const bridge = makeBridge(makeNetworkFailFetch());
    const result = await bridge.deregisterAgent(TENANT, MACHINE, AGENT);
    expect(result).toEqual({ ok: false, reason: 'network failure' });
  });

  // ---------------------------------------------------------------------------
  // getAgentGatewayStatus
  // ---------------------------------------------------------------------------

  it('getAgentGatewayStatus returns registered on 200', async () => {
    const bridge = makeBridge(makeOkFetch(200));
    const status = await bridge.getAgentGatewayStatus(TENANT, MACHINE, AGENT);
    expect(status).toBe('registered');
  });

  it('getAgentGatewayStatus returns unregistered on 404', async () => {
    const bridge = makeBridge(makeErrorFetch(404));
    const status = await bridge.getAgentGatewayStatus(TENANT, MACHINE, AGENT);
    expect(status).toBe('unregistered');
  });

  it('getAgentGatewayStatus returns unknown on 5xx', async () => {
    const bridge = makeBridge(makeErrorFetch(500));
    const status = await bridge.getAgentGatewayStatus(TENANT, MACHINE, AGENT);
    expect(status).toBe('unknown');
  });

  it('getAgentGatewayStatus returns unknown on network error', async () => {
    const bridge = makeBridge(makeNetworkFailFetch());
    const status = await bridge.getAgentGatewayStatus(TENANT, MACHINE, AGENT);
    expect(status).toBe('unknown');
  });

  it('getAgentGatewayStatus sends GET to correct /status URL', async () => {
    const fetchImpl = makeOkFetch(200);
    const bridge = makeBridge(fetchImpl);
    await bridge.getAgentGatewayStatus(TENANT, MACHINE, AGENT);
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/v1/operator/machines/${MACHINE}/agents/${AGENT}/status`);
    expect(init?.method).toBe('GET');
    expect((init?.headers as Record<string, string>)?.['authorization']).toBe(
      `Bearer ${API_TOKEN}`,
    );
  });

  // ---------------------------------------------------------------------------
  // URL encoding
  // ---------------------------------------------------------------------------

  it('URL-encodes special characters in machineId and agentId', async () => {
    const fetchImpl = makeOkFetch(200);
    const bridge = makeBridge(fetchImpl);
    const machineId = 'machine/special' as MachineId;
    const agentId = 'agent?id=1' as AgentId;
    await bridge.syncAgentRegistration(TENANT, machineId, agentId, []);
    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    // cspell:disable-next-line -- URL-percent-encoded chars produce non-words
    expect(url).toContain('machine%2Fspecial');
    // cspell:disable-next-line -- URL-percent-encoded chars produce non-words
    expect(url).toContain('agent%3Fid%3D1');
  });

  // ---------------------------------------------------------------------------
  // Request timeout
  // ---------------------------------------------------------------------------

  it('syncAgentRegistration returns ok:false when request times out', async () => {
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        });
      });
    });
    const bridge = new OpenClawOperatorManagementBridge({
      baseUrl: BASE_URL,
      apiToken: API_TOKEN,
      fetchImpl,
      requestTimeoutMs: 5,
    });
    const result = await bridge.syncAgentRegistration(TENANT, MACHINE, AGENT, []);
    expect(result.ok).toBe(false);
  });
});

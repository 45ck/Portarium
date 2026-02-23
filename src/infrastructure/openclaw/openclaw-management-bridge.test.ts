import { describe, expect, it, vi } from 'vitest';

import type { AgentId, MachineId, TenantId } from '../../domain/primitives/index.js';
import { OpenClawManagementBridge } from './openclaw-management-bridge.js';

const TENANT_ID = 'tenant-1' as TenantId;
const MACHINE_ID = 'machine-1' as MachineId;
const AGENT_ID = 'agent-1' as AgentId;
const TOKEN = 'test-bearer-token';

function makeInvoker(fetchImpl: typeof fetch, token = TOKEN) {
  return new OpenClawManagementBridge({
    baseUrl: 'https://openclaw.example.com',
    resolveBearerToken: vi.fn().mockResolvedValue(token),
    fetchImpl,
  });
}

// ---------------------------------------------------------------------------
// syncAgentRegistration
// ---------------------------------------------------------------------------
describe('syncAgentRegistration', () => {
  it('PUTs to /v1/management/agents/:agentId and returns ok on 200', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const bridge = makeInvoker(fetchImpl);

    const result = await bridge.syncAgentRegistration(TENANT_ID, MACHINE_ID, AGENT_ID, [
      'run:workflow',
    ]);

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://openclaw.example.com/v1/management/agents/agent-1');
    expect(init!.method).toBe('PUT');
    const headers = init!.headers as Record<string, string>;
    expect(headers['authorization']).toBe(`Bearer ${TOKEN}`);
    expect(headers['x-portarium-tenant-id']).toBe('tenant-1');
    expect(headers['x-portarium-machine-id']).toBe('machine-1');
    const body = JSON.parse(init!.body as string) as { capabilities: string[] };
    expect(body.capabilities).toEqual(['run:workflow']);
  });

  it('returns ok on 201 Created', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }));
    const result = await makeInvoker(fetchImpl).syncAgentRegistration(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
      [],
    );
    expect(result).toEqual({ ok: true });
  });

  it('returns soft failure on 401', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 401 }));
    const result = await makeInvoker(fetchImpl).syncAgentRegistration(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
      [],
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toMatch(/authorization failure/);
  });

  it('returns soft failure on 422 invalid payload', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 422 }));
    const result = await makeInvoker(fetchImpl).syncAgentRegistration(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
      [],
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toMatch(/invalid/);
  });

  it('returns soft failure on 500 gateway error', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
    const result = await makeInvoker(fetchImpl).syncAgentRegistration(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
      [],
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toMatch(/internal error/);
  });

  it('returns soft failure when token is missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const bridge = new OpenClawManagementBridge({
      baseUrl: 'https://openclaw.example.com',
      resolveBearerToken: vi.fn().mockResolvedValue(undefined),
      fetchImpl,
    });
    const result = await bridge.syncAgentRegistration(TENANT_ID, MACHINE_ID, AGENT_ID, []);
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns soft failure on network error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network failure'));
    const result = await makeInvoker(fetchImpl).syncAgentRegistration(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
      [],
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('network failure');
  });
});

// ---------------------------------------------------------------------------
// deregisterAgent
// ---------------------------------------------------------------------------
describe('deregisterAgent', () => {
  it('DELETEs /v1/management/agents/:agentId and returns ok on 200', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const result = await makeInvoker(fetchImpl).deregisterAgent(TENANT_ID, MACHINE_ID, AGENT_ID);
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://openclaw.example.com/v1/management/agents/agent-1');
    expect(init!.method).toBe('DELETE');
  });

  it('returns ok idempotently on 404 (agent already absent)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
    const result = await makeInvoker(fetchImpl).deregisterAgent(TENANT_ID, MACHINE_ID, AGENT_ID);
    expect(result).toEqual({ ok: true });
  });

  it('returns soft failure on 403 forbidden', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 403 }));
    const result = await makeInvoker(fetchImpl).deregisterAgent(TENANT_ID, MACHINE_ID, AGENT_ID);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toMatch(/authorization failure/);
  });

  it('returns soft failure on timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        });
      });
    });
    const bridge = new OpenClawManagementBridge({
      baseUrl: 'https://openclaw.example.com',
      resolveBearerToken: vi.fn().mockResolvedValue(TOKEN),
      fetchImpl,
      requestTimeoutMs: 5,
    });
    const result = await bridge.deregisterAgent(TENANT_ID, MACHINE_ID, AGENT_ID);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toMatch(/timed out/);
  });
});

// ---------------------------------------------------------------------------
// getAgentGatewayStatus
// ---------------------------------------------------------------------------
describe('getAgentGatewayStatus', () => {
  it('returns registered on 200 with { status: "registered" }', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ status: 'registered' }), { status: 200 }),
    );
    const result = await makeInvoker(fetchImpl).getAgentGatewayStatus(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
    );
    expect(result).toBe('registered');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://openclaw.example.com/v1/management/agents/agent-1/status');
    expect(init!.method).toBe('GET');
  });

  it('returns unregistered on 404', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
    const result = await makeInvoker(fetchImpl).getAgentGatewayStatus(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
    );
    expect(result).toBe('unregistered');
  });

  it('returns unknown on 500', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
    const result = await makeInvoker(fetchImpl).getAgentGatewayStatus(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
    );
    expect(result).toBe('unknown');
  });

  it('returns registered on 200 with empty body', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('', { status: 200 }));
    const result = await makeInvoker(fetchImpl).getAgentGatewayStatus(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
    );
    expect(result).toBe('registered');
  });

  it('returns unknown on network error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('net::ERR_FAILED'));
    const result = await makeInvoker(fetchImpl).getAgentGatewayStatus(
      TENANT_ID,
      MACHINE_ID,
      AGENT_ID,
    );
    expect(result).toBe('unknown');
  });

  it('returns unknown when token resolver fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const bridge = new OpenClawManagementBridge({
      baseUrl: 'https://openclaw.example.com',
      resolveBearerToken: vi.fn().mockRejectedValue(new Error('vault down')),
      fetchImpl,
    });
    const result = await bridge.getAgentGatewayStatus(TENANT_ID, MACHINE_ID, AGENT_ID);
    expect(result).toBe('unknown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('URL-encodes agentId with special characters', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const weirdAgent = 'agent/with+special chars' as AgentId;
    await makeInvoker(fetchImpl).getAgentGatewayStatus(TENANT_ID, MACHINE_ID, weirdAgent);
    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toContain(encodeURIComponent('agent/with+special chars'));
  });
});

// ---------------------------------------------------------------------------
// Constructor validation
// ---------------------------------------------------------------------------
describe('constructor', () => {
  it('throws on empty baseUrl', () => {
    expect(
      () =>
        new OpenClawManagementBridge({
          baseUrl: '   ',
          resolveBearerToken: vi.fn().mockResolvedValue(TOKEN),
        }),
    ).toThrow('non-empty baseUrl');
  });

  it('strips trailing slashes from baseUrl', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const bridge = new OpenClawManagementBridge({
      baseUrl: 'https://openclaw.example.com///',
      resolveBearerToken: vi.fn().mockResolvedValue(TOKEN),
      fetchImpl,
    });
    await bridge.deregisterAgent(TENANT_ID, MACHINE_ID, AGENT_ID);
    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toMatch(/^https:\/\/openclaw\.example\.com\/v1\//);
  });
});

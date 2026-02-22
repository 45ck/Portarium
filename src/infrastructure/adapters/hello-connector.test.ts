/**
 * Contract tests for the hello-connector scaffold.
 *
 * Validates the adapter port contract using StubHelloConnector.
 * These tests serve as the specification every connector implementation
 * must satisfy — copy them alongside your connector to drive development.
 *
 * Bead: bead-0730
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  StubHelloConnector,
  HelloConnectorAdapter,
} from '../../../examples/hello-connector/connector.js';
import type { HelloConnectorAdapterPort } from '../../../examples/hello-connector/connector.js';

// ── Stub adapter contract (no network) ───────────────────────────────────────

describe('StubHelloConnector — port contract', () => {
  let stub: StubHelloConnector;

  beforeEach(() => {
    stub = new StubHelloConnector();
  });

  it('ping returns ok with latencyMs when reachable', async () => {
    const result = await stub.ping();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.value.latencyMs).toBe('number');
    expect(result.value.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('ping returns error when unreachable', async () => {
    stub.state.reachable = false;
    const result = await stub.ping();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeTruthy();
  });

  it('sendMessage delivers and records message when reachable', async () => {
    const result = await stub.sendMessage('hello world');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.delivered).toBe(true);
    expect(stub.state.messages).toContain('hello world');
  });

  it('sendMessage accumulates multiple messages', async () => {
    await stub.sendMessage('first');
    await stub.sendMessage('second');
    expect(stub.state.messages).toEqual(['first', 'second']);
  });

  it('sendMessage returns error when unreachable', async () => {
    stub.state.reachable = false;
    const result = await stub.sendMessage('lost message');
    expect(result.ok).toBe(false);
    expect(stub.state.messages).toHaveLength(0);
  });

  it('getStatus returns connected status when reachable', async () => {
    stub.state.status = { connected: true, uptime: 42, version: '1.0.0' };
    const result = await stub.getStatus();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.connected).toBe(true);
    expect(result.value.uptime).toBe(42);
    expect(result.value.version).toBe('1.0.0');
  });

  it('getStatus returns a copy (mutations do not affect stub state)', async () => {
    stub.state.status = { connected: true, uptime: 10 };
    const result = await stub.getStatus();
    if (!result.ok) return;
    (result.value as { uptime: number }).uptime = 999;
    const second = await stub.getStatus();
    if (!second.ok) return;
    expect(second.value.uptime).toBe(10); // original unchanged
  });

  it('getStatus returns error when unreachable', async () => {
    stub.state.reachable = false;
    const result = await stub.getStatus();
    expect(result.ok).toBe(false);
  });
});

// ── Structural contract ───────────────────────────────────────────────────────

describe('HelloConnectorAdapter — structural contract', () => {
  it('HelloConnectorAdapter satisfies the port interface', () => {
    const adapter: HelloConnectorAdapterPort = new HelloConnectorAdapter({
      baseUrl: 'http://localhost:9000',
      token: 'test',
    });
    expect(typeof adapter.ping).toBe('function');
    expect(typeof adapter.sendMessage).toBe('function');
    expect(typeof adapter.getStatus).toBe('function');
  });

  it('StubHelloConnector satisfies the port interface', () => {
    const adapter: HelloConnectorAdapterPort = new StubHelloConnector();
    expect(typeof adapter.ping).toBe('function');
    expect(typeof adapter.sendMessage).toBe('function');
    expect(typeof adapter.getStatus).toBe('function');
  });
});

// ── Live adapter HTTP contract (uses mocked fetch) ────────────────────────────

describe('HelloConnectorAdapter — HTTP contract', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('ping POSTs correct Authorization header and returns latencyMs', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    const adapter = new HelloConnectorAdapter({
      baseUrl: 'http://example.com',
      token: 'tok-123',
    });
    const result = await adapter.ping();

    expect(result.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://example.com/ping');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123');
  });

  it('ping returns error on HTTP 500', async () => {
    mockFetch.mockResolvedValue(new Response('error', { status: 500 }));

    const adapter = new HelloConnectorAdapter({ baseUrl: 'http://x.com', token: 't' });
    const result = await adapter.ping();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('500');
  });

  it('ping returns error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network unreachable'));

    const adapter = new HelloConnectorAdapter({ baseUrl: 'http://x.com', token: 't' });
    const result = await adapter.ping();

    expect(result.ok).toBe(false);
  });

  it('sendMessage POSTs message body as JSON', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    const adapter = new HelloConnectorAdapter({ baseUrl: 'http://example.com', token: 't' });
    await adapter.sendMessage('test payload');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://example.com/messages');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { message: string };
    expect(body.message).toBe('test payload');
  });

  it('getStatus parses response JSON into HelloConnectorStatus', async () => {
    const payload = { connected: true, uptime: 123, version: '2.1.0' };
    mockFetch.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    const adapter = new HelloConnectorAdapter({ baseUrl: 'http://example.com', token: 't' });
    const result = await adapter.getStatus();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.connected).toBe(true);
    expect(result.value.uptime).toBe(123);
    expect(result.value.version).toBe('2.1.0');
  });
});

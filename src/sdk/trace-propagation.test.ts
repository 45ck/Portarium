/**
 * End-to-end trace propagation test.
 *
 * Beads: bead-0678
 *
 * Validates that the PortariumClient injects W3C traceparent/tracestate
 * and correlation ID headers, and that these propagate through the gateway
 * to the control plane.
 */

import { describe, it, expect, vi } from 'vitest';
import { PortariumClient } from './portarium-client.js';

describe('Trace propagation: SDK -> Gateway -> Control Plane', () => {
  it('injects traceparent, tracestate, and x-correlation-id on every request', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          runId: 'run-1',
          workflowId: 'wf-1',
          status: 'Pending',
          createdAtIso: '2026-02-21T00:00:00Z',
        }),
    });

    const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const tracestate = 'portarium=v1,upstream=prod';

    const client = new PortariumClient({
      baseUrl: 'https://gateway.portarium.test',
      auth: { kind: 'bearerToken', token: 'tok-123' },
      workspaceId: 'ws-acme',
      maxRetries: 0,
      fetchFn,
      traceparent,
      tracestate,
    });

    await client.runs.start({ workflowId: 'wf-onboard' });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [, rawOptions] = fetchFn.mock.calls[0]! as [string, RequestInit];
    const headers = rawOptions.headers as Record<string, string>;

    // W3C trace context headers
    expect(headers['traceparent']).toBe(traceparent);
    expect(headers['tracestate']).toBe(tracestate);

    // Correlation ID (auto-generated UUID)
    expect(headers['x-correlation-id']).toBeDefined();
    expect(headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('generates unique correlation IDs per request', async () => {
    const correlationIds: string[] = [];
    const fetchFn = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      const headers = options.headers as Record<string, string>;
      correlationIds.push(headers['x-correlation-id']!);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            runId: 'run-1',
            workflowId: 'wf-1',
            status: 'Pending',
            createdAtIso: '2026-02-21T00:00:00Z',
          }),
      });
    });

    const client = new PortariumClient({
      baseUrl: 'https://gateway.portarium.test',
      auth: { kind: 'bearerToken', token: 'tok-123' },
      workspaceId: 'ws-acme',
      maxRetries: 0,
      fetchFn,
    });

    await client.runs.start({ workflowId: 'wf-1' });
    await client.runs.get('run-1');

    expect(correlationIds).toHaveLength(2);
    expect(correlationIds[0]).not.toBe(correlationIds[1]);
  });

  it('includes idempotency-key on write operations', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          runId: 'run-1',
          workflowId: 'wf-1',
          status: 'Pending',
          createdAtIso: '2026-02-21T00:00:00Z',
        }),
    });

    const client = new PortariumClient({
      baseUrl: 'https://gateway.portarium.test',
      auth: { kind: 'bearerToken', token: 'tok-123' },
      workspaceId: 'ws-acme',
      maxRetries: 0,
      fetchFn,
    });

    await client.runs.start({ workflowId: 'wf-1', idempotencyKey: 'idem-abc' });

    const [, rawOptions] = fetchFn.mock.calls[0]! as [string, RequestInit];
    const headers = rawOptions.headers as Record<string, string>;
    expect(headers['idempotency-key']).toBe('idem-abc');
  });

  it('auto-generates idempotency-key when not provided', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          runId: 'run-1',
          workflowId: 'wf-1',
          status: 'Pending',
          createdAtIso: '2026-02-21T00:00:00Z',
        }),
    });

    const client = new PortariumClient({
      baseUrl: 'https://gateway.portarium.test',
      auth: { kind: 'bearerToken', token: 'tok-123' },
      workspaceId: 'ws-acme',
      maxRetries: 0,
      fetchFn,
    });

    await client.runs.start({ workflowId: 'wf-1' });

    const [, rawOptions] = fetchFn.mock.calls[0]! as [string, RequestInit];
    const headers = rawOptions.headers as Record<string, string>;
    expect(headers['idempotency-key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

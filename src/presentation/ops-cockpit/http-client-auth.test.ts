/**
 * Authentication, default headers, and timeout tests for ControlPlaneClient.
 * Kept in a separate file to satisfy the max-lines ESLint rule.
 */
import { describe, expect, it, vi } from 'vitest';

import { ControlPlaneClient } from './http-client.js';

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

function makeClient(fetchImpl: typeof fetch, extra: object = {}): ControlPlaneClient {
  return new ControlPlaneClient({
    baseUrl: 'https://api.portarium.test',
    fetchImpl,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe('ControlPlaneClient authentication', () => {
  it('sets Authorization header from sync token provider', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [] });
    const client = makeClient(fetchImpl, { getAuthToken: () => 'token-abc' });

    await client.listRuns('ws');

    expect((calls[0]!.init.headers as Headers).get('Authorization')).toBe('Bearer token-abc');
  });

  it('sets Authorization header from async token provider', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [] });
    const client = makeClient(fetchImpl, { getAuthToken: async () => 'async-token-xyz' });

    await client.listRuns('ws');

    expect((calls[0]!.init.headers as Headers).get('Authorization')).toBe('Bearer async-token-xyz');
  });

  it('omits Authorization header when token is empty string', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [] });
    const client = makeClient(fetchImpl, { getAuthToken: () => '' });

    await client.listRuns('ws');

    expect((calls[0]!.init.headers as Headers).get('Authorization')).toBeNull();
  });

  it('sends default headers on every request', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [] });
    const client = makeClient(fetchImpl, {
      defaultHeaders: { 'X-Tenant': 'acme', 'X-Workspace': 'ws-1' },
    });

    await client.listRuns('ws-1');

    const h = calls[0]!.init.headers as Headers;
    expect(h.get('X-Tenant')).toBe('acme');
    expect(h.get('X-Workspace')).toBe('ws-1');
  });

  it('always sets Accept and X-Client headers', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [] });
    const client = makeClient(fetchImpl);

    await client.listRuns('ws');

    const h = calls[0]!.init.headers as Headers;
    expect(h.get('Accept')).toBe('application/json');
    expect(h.get('X-Client')).toBe('portarium-presentation');
  });

  it('sets Content-Type only for requests with a body', async () => {
    const { calls, fetchImpl } = createJsonFetch({ id: 'r-1' });
    const client = makeClient(fetchImpl);

    await client.listRuns('ws');
    await client.cancelRun('ws', 'run-1');

    const getHeaders = calls[0]!.init.headers as Headers;
    const postNoBodyHeaders = calls[1]!.init.headers as Headers;
    expect(getHeaders.get('Content-Type')).toBeNull();
    expect(postNoBodyHeaders.get('Content-Type')).toBeNull();
  });

  it('sets Content-Type: application/json for POST with body', async () => {
    const { calls, fetchImpl } = createJsonFetch({ id: 'r-1' });
    const client = makeClient(fetchImpl);

    await client.startRun('ws', { workflowId: 'wf-1' });

    expect((calls[0]!.init.headers as Headers).get('Content-Type')).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Request timeout
// ---------------------------------------------------------------------------

describe('ControlPlaneClient request timeout', () => {
  it('passes an AbortSignal to fetch', async () => {
    vi.useFakeTimers();

    let capturedSignal: AbortSignal | undefined;
    const instrumentedFetch = (async (_input: unknown, init: RequestInit = {}) => {
      capturedSignal = init.signal ?? undefined;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ items: [], nextCursor: null }),
      } as Response;
    }) as typeof fetch;

    const client = makeClient(instrumentedFetch, { requestTimeoutMs: 100 });
    await client.listRuns('ws');

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(false);

    vi.useRealTimers();
  });

  it('does not abort before the timeout elapses', async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const fastFetch = (async (_input: unknown, init: RequestInit = {}) => {
      capturedSignal = init.signal ?? undefined;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '{}',
      } as Response;
    }) as typeof fetch;

    const client = makeClient(fastFetch, { requestTimeoutMs: 5000 });
    await client.listRuns('ws');

    await vi.advanceTimersByTimeAsync(10);
    expect(capturedSignal?.aborted).toBe(false);

    vi.useRealTimers();
  });
});

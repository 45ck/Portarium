import { describe, expect, it, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { Readable } from 'node:stream';

import { AgentGateway, type AuthVerifier, type AuthVerifyResult } from './agent-gateway.js';
import { TokenBucketRateLimiter } from './rate-limiter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthVerifier(result: AuthVerifyResult): AuthVerifier {
  return async () => result;
}

function makeSuccessAuth(): AuthVerifier {
  return makeAuthVerifier({ ok: true, workspaceId: 'ws-test', subject: 'user-1' });
}

function makeFetchStub(status: number, body: string): typeof fetch {
  return (async () => ({
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => body,
  })) as unknown as typeof fetch;
}

function createRequest(opts: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}): IncomingMessage {
  const readable = new Readable();
  if (opts.body) {
    readable.push(opts.body);
  }
  readable.push(null);

  const req = Object.assign(readable, {
    method: opts.method ?? 'GET',
    url: opts.url ?? '/api/v1/runs',
    headers: {
      authorization: 'Bearer test-token',
      ...opts.headers,
    },
    socket: new Socket(),
  }) as unknown as IncomingMessage;

  return req;
}

function createResponse(): ServerResponse & { _body: string; _status: number; _headers: Record<string, string> } {
  const res = {
    _body: '',
    _status: 200,
    _headers: {} as Record<string, string>,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
    },
    end(body?: string) {
      res._body = body ?? '';
    },
  };
  return res as unknown as ServerResponse & { _body: string; _status: number; _headers: Record<string, string> };
}

function createGateway(overrides?: {
  authVerifier?: AuthVerifier;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}): AgentGateway {
  return new AgentGateway({
    controlPlaneBaseUrl: 'http://control-plane:3000',
    authVerifier: overrides?.authVerifier ?? makeSuccessAuth(),
    rateLimiter: new TokenBucketRateLimiter({
      maxTokens: overrides?.maxTokens ?? 100,
      refillRatePerSecond: 10,
    }),
    fetchImpl: overrides?.fetchImpl ?? makeFetchStub(200, '{"ok":true}'),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentGateway', () => {
  it('proxies authenticated request to control plane and returns upstream response', async () => {
    const fetchSpy = vi.fn(makeFetchStub(200, '{"runs":[]}'));
    const gateway = createGateway({ fetchImpl: fetchSpy });

    const req = createRequest({ method: 'GET', url: '/api/v1/runs' });
    const res = createResponse();

    await gateway.handleRequest(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toBe('{"runs":[]}');
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://control-plane:3000/api/v1/runs');
    expect((init as RequestInit).headers).toHaveProperty('x-workspace-id', 'ws-test');
    expect((init as RequestInit).headers).toHaveProperty('traceparent');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const gateway = createGateway({
      authVerifier: makeAuthVerifier({ ok: false, reason: 'Invalid token' }),
    });

    const req = createRequest({});
    const res = createResponse();

    await gateway.handleRequest(req, res);

    expect(res._status).toBe(401);
    const body = JSON.parse(res._body);
    expect(body.title).toBe('Unauthorized');
  });

  it('rejects rate-limited requests with 429 and retry-after header', async () => {
    const gateway = createGateway({ maxTokens: 1 });
    const res1 = createResponse();
    await gateway.handleRequest(createRequest({}), res1);
    expect(res1._status).toBe(200);

    const res2 = createResponse();
    await gateway.handleRequest(createRequest({}), res2);
    expect(res2._status).toBe(429);
    expect(res2._headers['retry-after']).toBeDefined();
  });

  it('rejects requests with invalid method with 422', async () => {
    const gateway = createGateway({
      fetchImpl: makeFetchStub(200, '{}'),
    });

    const req = createRequest({ method: 'TRACE', url: '/api/v1/runs' });
    const res = createResponse();

    await gateway.handleRequest(req, res);

    expect(res._status).toBe(422);
    const body = JSON.parse(res._body);
    expect(body.detail).toContain('TRACE');
  });

  it('injects traceparent when not present in request', async () => {
    const fetchSpy = vi.fn(makeFetchStub(200, '{}'));
    const gateway = createGateway({ fetchImpl: fetchSpy });

    const req = createRequest({ headers: {} });
    const res = createResponse();

    await gateway.handleRequest(req, res);

    const headers = (fetchSpy.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('forwards existing traceparent from request', async () => {
    const fetchSpy = vi.fn(makeFetchStub(200, '{}'));
    const gateway = createGateway({ fetchImpl: fetchSpy });

    const traceparent = '00-abcdef1234567890abcdef1234567890-1234567890abcdef-01';
    const req = createRequest({ headers: { traceparent } });
    const res = createResponse();

    await gateway.handleRequest(req, res);

    const headers = (fetchSpy.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers['traceparent']).toBe(traceparent);
  });

  it('returns 502 when upstream fetch throws', async () => {
    const gateway = createGateway({
      fetchImpl: (async () => {
        throw new Error('connection refused');
      }) as unknown as typeof fetch,
    });

    const req = createRequest({});
    const res = createResponse();

    await gateway.handleRequest(req, res);

    expect(res._status).toBe(502);
    const body = JSON.parse(res._body);
    expect(body.title).toBe('Bad Gateway');
  });

  it('proxies POST with body to control plane', async () => {
    const fetchSpy = vi.fn(makeFetchStub(201, '{"id":"run-1"}'));
    const gateway = createGateway({ fetchImpl: fetchSpy });

    const req = createRequest({
      method: 'POST',
      url: '/api/v1/runs',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workflowId: 'wf-1' }),
    });
    const res = createResponse();

    await gateway.handleRequest(req, res);

    expect(res._status).toBe(201);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect((init as RequestInit).body).toBeDefined();
  });
});

import { describe, expect, it, vi } from 'vitest';

import { SidecarProxy, type ProxiedRequest } from './sidecar-proxy.js';
import type { SidecarConfigV1 } from './sidecar-config-v1.js';

function makeConfig(overrides: Partial<SidecarConfigV1> = {}): SidecarConfigV1 {
  return {
    upstreamUrl: 'http://localhost:3000',
    egressAllowlist: ['api.example.com', '*.internal.io'],
    tokenRefreshIntervalMs: 300_000,
    listenPort: 15001,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<ProxiedRequest> = {}): ProxiedRequest {
  return {
    method: 'GET',
    url: 'https://api.example.com/v1/data',
    headers: {},
    ...overrides,
  };
}

describe('SidecarProxy', () => {
  describe('checkEgress', () => {
    it('allows exact host match', () => {
      const proxy = new SidecarProxy(makeConfig());
      const result = proxy.checkEgress('https://api.example.com/path');
      expect(result.allowed).toBe(true);
      expect(result.host).toBe('api.example.com');
    });

    it('allows wildcard host match', () => {
      const proxy = new SidecarProxy(makeConfig());
      const result = proxy.checkEgress('https://svc.internal.io/api');
      expect(result.allowed).toBe(true);
    });

    it('denies host not in allowlist', () => {
      const proxy = new SidecarProxy(makeConfig());
      const result = proxy.checkEgress('https://evil.com/steal');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in egress allowlist');
    });

    it('denies when allowlist is empty', () => {
      const proxy = new SidecarProxy(makeConfig({ egressAllowlist: [] }));
      const result = proxy.checkEgress('https://api.example.com/path');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('empty');
    });

    it('denies invalid URLs', () => {
      const proxy = new SidecarProxy(makeConfig());
      const result = proxy.checkEgress('not-a-url');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid URL');
    });

    it('wildcard does not match the bare domain', () => {
      const proxy = new SidecarProxy(makeConfig({ egressAllowlist: ['*.example.com'] }));
      const result = proxy.checkEgress('https://example.com/path');
      expect(result.allowed).toBe(false);
    });
  });

  describe('proxy', () => {
    it('proxies allowed requests with auth and trace headers', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      const proxy = new SidecarProxy(makeConfig(), fetchImpl);
      proxy.setToken('my-bearer-token');

      const result = await proxy.proxy(makeRequest(), {
        traceparent: '00-trace-id-span-id-01',
        tracestate: 'vendor=value',
      });

      expect(result.status).toBe(200);
      expect(result.body).toBe('{"ok":true}');

      const callHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['authorization']).toBe('Bearer my-bearer-token');
      expect(callHeaders['traceparent']).toBe('00-trace-id-span-id-01');
      expect(callHeaders['tracestate']).toBe('vendor=value');
    });

    it('returns 403 for denied egress', async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      const proxy = new SidecarProxy(makeConfig(), fetchImpl);

      const result = await proxy.proxy(
        makeRequest({ url: 'https://evil.com/steal' }),
      );

      expect(result.status).toBe(403);
      expect(fetchImpl).not.toHaveBeenCalled();
      const body = JSON.parse(result.body) as { error: string };
      expect(body.error).toBe('EgressDenied');
    });

    it('does not overwrite existing auth header', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response('ok', { status: 200 }),
      );

      const proxy = new SidecarProxy(makeConfig(), fetchImpl);
      proxy.setToken('sidecar-token');

      await proxy.proxy(
        makeRequest({ headers: { authorization: 'Bearer existing' } }),
      );

      const callHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['authorization']).toBe('Bearer existing');
    });

    it('returns 502 on upstream failure', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => {
        throw new Error('connection refused');
      });

      const proxy = new SidecarProxy(makeConfig(), fetchImpl);

      const result = await proxy.proxy(makeRequest());

      expect(result.status).toBe(502);
      const body = JSON.parse(result.body) as { error: string; message: string };
      expect(body.error).toBe('UpstreamFailure');
      expect(body.message).toContain('connection refused');
    });

    it('proxies without auth when no token is set', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        new Response('ok', { status: 200 }),
      );

      const proxy = new SidecarProxy(makeConfig(), fetchImpl);

      await proxy.proxy(makeRequest());

      const callHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['authorization']).toBeUndefined();
    });
  });
});

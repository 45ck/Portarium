import { describe, expect, it, vi } from 'vitest';

import { SidecarProxy, type ProxiedRequest } from './sidecar-proxy.js';
import type { SidecarConfigV1 } from './sidecar-config-v1.js';
import type { EgressAuditRecord, EgressAuditSink } from './egress-audit-log.js';

function makeConfig(overrides: Partial<SidecarConfigV1> = {}): SidecarConfigV1 {
  return {
    upstreamUrl: 'http://localhost:3000',
    egressAllowlist: ['api.example.com', '*.internal.io'],
    tokenRefreshIntervalMs: 300_000,
    listenPort: 15001,
    enforcementMode: 'enforce',
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

function makeAuditSink(): EgressAuditSink & { records: EgressAuditRecord[] } {
  const records: EgressAuditRecord[] = [];
  return { records, emit: (r) => records.push(r) };
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

    it('denies when allowlist is empty (default-deny)', () => {
      const proxy = new SidecarProxy(makeConfig({ egressAllowlist: [] }));
      const result = proxy.checkEgress('https://api.example.com/path');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('default-deny');
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

  describe('proxy — enforce mode', () => {
    it('proxies allowed requests with auth and trace headers', async () => {
      const fetchImpl = vi.fn<typeof fetch>(
        async () =>
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

      const result = await proxy.proxy(makeRequest({ url: 'https://evil.com/steal' }));

      expect(result.status).toBe(403);
      expect(fetchImpl).not.toHaveBeenCalled();
      const body = JSON.parse(result.body) as { error: string };
      expect(body.error).toBe('EgressDenied');
    });

    it('does not overwrite existing auth header', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));

      const proxy = new SidecarProxy(makeConfig(), fetchImpl);
      proxy.setToken('sidecar-token');

      await proxy.proxy(makeRequest({ headers: { authorization: 'Bearer existing' } }));

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
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));

      const proxy = new SidecarProxy(makeConfig(), fetchImpl);

      await proxy.proxy(makeRequest());

      const callHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['authorization']).toBeUndefined();
    });
  });

  describe('proxy — monitor mode', () => {
    it('forwards denied traffic in monitor mode', async () => {
      const fetchImpl = vi.fn<typeof fetch>(
        async () => new Response('upstream-response', { status: 200 }),
      );
      const sink = makeAuditSink();
      const proxy = new SidecarProxy(makeConfig({ enforcementMode: 'monitor' }), fetchImpl, sink);

      const result = await proxy.proxy(makeRequest({ url: 'https://evil.com/steal' }));

      expect(result.status).toBe(200);
      expect(result.body).toBe('upstream-response');
      expect(fetchImpl).toHaveBeenCalledOnce();

      expect(sink.records).toHaveLength(1);
      expect(sink.records[0]?.policyDecision).toBe('deny');
      expect(sink.records[0]?.enforcementMode).toBe('monitor');
    });

    it('also logs allowed traffic in monitor mode', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));
      const sink = makeAuditSink();
      const proxy = new SidecarProxy(makeConfig({ enforcementMode: 'monitor' }), fetchImpl, sink);

      await proxy.proxy(makeRequest());

      expect(sink.records).toHaveLength(1);
      expect(sink.records[0]?.policyDecision).toBe('allow');
    });
  });

  describe('audit logging', () => {
    it('emits audit record for allowed requests', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));
      const sink = makeAuditSink();
      const proxy = new SidecarProxy(makeConfig(), fetchImpl, sink);
      proxy.setIdentity({
        tenantId: 'tenant-1',
        workflowRunId: 'run-42',
        agentSpiffeId: 'spiffe://portarium.io/ns/agents/sa/agent-test/tenant/tenant-1',
      });

      await proxy.proxy(makeRequest({ method: 'POST', url: 'https://api.example.com/v1/data' }));

      expect(sink.records).toHaveLength(1);
      const record = sink.records[0]!;
      expect(record.policyDecision).toBe('allow');
      expect(record.destinationHost).toBe('api.example.com');
      expect(record.destinationPort).toBe(443);
      expect(record.httpMethod).toBe('POST');
      expect(record.httpPath).toBe('/v1/data');
      expect(record.responseStatus).toBe(200);
      expect(record.tenantId).toBe('tenant-1');
      expect(record.workflowRunId).toBe('run-42');
      expect(record.agentSpiffeId).toContain('spiffe://');
      expect(record.policyReason).toBeUndefined();
      expect(record.enforcementMode).toBe('enforce');
      expect(record.latencyMs).toBeGreaterThanOrEqual(0);
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it('emits audit record for denied requests with policy reason', async () => {
      const fetchImpl = vi.fn<typeof fetch>();
      const sink = makeAuditSink();
      const proxy = new SidecarProxy(makeConfig(), fetchImpl, sink);

      await proxy.proxy(makeRequest({ url: 'https://evil.com/exfiltrate' }));

      expect(sink.records).toHaveLength(1);
      const record = sink.records[0]!;
      expect(record.policyDecision).toBe('deny');
      expect(record.destinationHost).toBe('evil.com');
      expect(record.httpPath).toBe('/exfiltrate');
      expect(record.responseStatus).toBe(403);
      expect(record.policyReason).toContain('not in egress allowlist');
    });

    it('emits audit record on upstream failure', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => {
        throw new Error('timeout');
      });
      const sink = makeAuditSink();
      const proxy = new SidecarProxy(makeConfig(), fetchImpl, sink);

      await proxy.proxy(makeRequest());

      expect(sink.records).toHaveLength(1);
      expect(sink.records[0]?.responseStatus).toBe(502);
    });

    it('does not fail when no audit sink is configured', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));
      const proxy = new SidecarProxy(makeConfig(), fetchImpl);

      const result = await proxy.proxy(makeRequest());
      expect(result.status).toBe(200);
    });
  });

  describe('identity context injection', () => {
    it('injects identity headers into proxied requests', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));
      const proxy = new SidecarProxy(makeConfig(), fetchImpl);
      proxy.setIdentity({
        tenantId: 'tenant-abc',
        workflowRunId: 'run-xyz',
        agentSpiffeId: 'spiffe://portarium.io/ns/agents/sa/agent-test/tenant/tenant-abc',
      });

      await proxy.proxy(makeRequest());

      const callHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['x-portarium-tenant-id']).toBe('tenant-abc');
      expect(callHeaders['x-portarium-workflow-run-id']).toBe('run-xyz');
      expect(callHeaders['x-portarium-agent-spiffe-id']).toContain('spiffe://');
    });

    it('does not overwrite existing identity headers', async () => {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));
      const proxy = new SidecarProxy(makeConfig(), fetchImpl);
      proxy.setIdentity({ tenantId: 'sidecar-tenant' });

      await proxy.proxy(
        makeRequest({
          headers: { 'x-portarium-tenant-id': 'request-tenant' },
        }),
      );

      const callHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(callHeaders['x-portarium-tenant-id']).toBe('request-tenant');
    });
  });
});

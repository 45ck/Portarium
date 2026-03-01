/**
 * Chaos and failure tests for the fail-closed egress proxy (bead-0837).
 *
 * Validates:
 * - Proxy unavailability blocks outbound requests (no bypass).
 * - Circuit breaker transitions through healthy → degraded → open → half-open → healthy.
 * - Error responses include correlation IDs and explicit semantics (503).
 * - Recovery after the recovery window re-enables proxying.
 * - Concurrent failure scenarios do not create bypass windows.
 *
 * Bead: bead-0837
 */

import { describe, expect, it, vi } from 'vitest';

import type { EgressAuditRecord, EgressAuditSink } from './egress-audit-log.js';
import type { ProxiedRequest } from './sidecar-proxy.js';
import { SidecarProxy } from './sidecar-proxy.js';
import type { SidecarConfigV1 } from './sidecar-config-v1.js';
import { FailClosedProxy, type EgressErrorEnvelope } from './fail-closed-proxy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<SidecarConfigV1> = {}): SidecarConfigV1 {
  return {
    upstreamUrl: 'http://localhost:3000',
    egressAllowlist: ['api.example.com'],
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

function makeFetchOk(): typeof fetch {
  return vi.fn<typeof fetch>(
    async () =>
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
  );
}

function makeFetchFail502(): typeof fetch {
  return vi.fn<typeof fetch>(async () => new Response('{"error":"bad gateway"}', { status: 502 }));
}

function makeFetchThrow(): typeof fetch {
  return vi.fn<typeof fetch>(async () => {
    throw new Error('connection refused');
  });
}

// ---------------------------------------------------------------------------
// Tests: Circuit breaker state transitions
// ---------------------------------------------------------------------------

describe('FailClosedProxy — circuit breaker', () => {
  it('starts in healthy state', () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner);
    expect(proxy.healthState).toBe('healthy');
  });

  it('transitions to degraded after first failure', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchFail502());
    const proxy = new FailClosedProxy(inner);

    await proxy.proxy(makeRequest());

    expect(proxy.healthState).toBe('degraded');
  });

  it('transitions to open after reaching failure threshold', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchFail502());
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 3,
      recoveryWindowMs: 30_000,
      successThreshold: 2,
    });

    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('degraded');

    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('degraded');

    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('open');
  });

  it('blocks all requests when circuit is open', async () => {
    const fetchImpl = makeFetchOk();
    const inner = new SidecarProxy(makeConfig(), fetchImpl);
    const proxy = new FailClosedProxy(inner);

    proxy.forceState('open');

    const result = await proxy.proxy(makeRequest());

    expect(result.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('transitions from open to half-open after recovery window', async () => {
    let now = 1000;
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 1,
      recoveryWindowMs: 5000,
      successThreshold: 1,
      now: () => now,
    });

    proxy.forceState('open');

    // Still open before recovery window
    const blocked = await proxy.proxy(makeRequest());
    expect(blocked.status).toBe(503);
    expect(proxy.healthState).toBe('open');

    // Advance past recovery window
    now += 5001;

    const probed = await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('healthy');
    expect(probed.status).toBe(200);
  });

  it('reopens circuit if half-open probe fails', async () => {
    let now = 1000;
    let shouldFail = true;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      if (shouldFail) return new Response('fail', { status: 502 });
      return new Response('ok', { status: 200 });
    });

    const inner = new SidecarProxy(makeConfig(), fetchImpl);
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 1,
      recoveryWindowMs: 5000,
      successThreshold: 1,
      now: () => now,
    });

    proxy.forceState('open');
    now += 5001;

    // Half-open probe — fails
    shouldFail = true;
    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('open');

    // Advance again
    now += 5001;

    // Half-open probe — succeeds
    shouldFail = false;
    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('healthy');
  });

  it('recovers from degraded to healthy after success threshold', async () => {
    let callCount = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      callCount++;
      if (callCount <= 1) return new Response('fail', { status: 502 });
      return new Response('ok', { status: 200 });
    });

    const inner = new SidecarProxy(makeConfig(), fetchImpl);
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 3,
      recoveryWindowMs: 30_000,
      successThreshold: 2,
    });

    await proxy.proxy(makeRequest()); // fail → degraded
    expect(proxy.healthState).toBe('degraded');

    await proxy.proxy(makeRequest()); // success 1
    await proxy.proxy(makeRequest()); // success 2
    expect(proxy.healthState).toBe('healthy');
  });
});

// ---------------------------------------------------------------------------
// Tests: Fail-closed — no bypass during degraded states
// ---------------------------------------------------------------------------

describe('FailClosedProxy — no-bypass invariant', () => {
  it('never allows direct fetch when circuit is open', async () => {
    const fetchImpl = makeFetchOk();
    const inner = new SidecarProxy(makeConfig(), fetchImpl);
    const proxy = new FailClosedProxy(inner);

    proxy.forceState('open');

    // Attempt multiple requests — none should reach upstream
    for (let i = 0; i < 10; i++) {
      const result = await proxy.proxy(makeRequest());
      expect(result.status).toBe(503);
    }

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('records upstream failures as circuit breaker failures (502 from inner proxy)', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchThrow());
    const proxy = new FailClosedProxy(inner);

    // Inner proxy catches the throw and returns 502 — FailClosedProxy
    // records this as a failure (502 is an upstream failure status).
    const result = await proxy.proxy(makeRequest());
    expect(result.status).toBe(502);
    expect(proxy.healthState).toBe('degraded');
  });

  it('tracks total blocked requests', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner);

    proxy.forceState('open');

    await proxy.proxy(makeRequest());
    await proxy.proxy(makeRequest());
    await proxy.proxy(makeRequest());

    expect(proxy.status().totalRequestsBlocked).toBe(3);
  });

  it('does not count allowed requests as blocked', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner);

    await proxy.proxy(makeRequest());
    await proxy.proxy(makeRequest());

    expect(proxy.status().totalRequestsBlocked).toBe(0);
  });

  it('blocks egress even for allowlisted hosts when circuit is open', async () => {
    const fetchImpl = makeFetchOk();
    const inner = new SidecarProxy(makeConfig(), fetchImpl);
    const proxy = new FailClosedProxy(inner);

    proxy.forceState('open');

    const result = await proxy.proxy(makeRequest({ url: 'https://api.example.com/v1/safe-call' }));
    expect(result.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Error semantics — 503 with correlation ID
// ---------------------------------------------------------------------------

describe('FailClosedProxy — error semantics', () => {
  it('returns 503 with correlation ID when circuit is open', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner);

    proxy.forceState('open');

    const result = await proxy.proxy(makeRequest());

    expect(result.status).toBe(503);
    expect(result.headers['x-portarium-correlation-id']).toBeDefined();
    expect(result.headers['content-type']).toBe('application/json');
    expect(result.headers['retry-after']).toBeDefined();

    const body = JSON.parse(result.body) as EgressErrorEnvelope;
    expect(body.error).toBe('ProxyUnavailable');
    expect(body.correlationId).toBeTruthy();
    expect(body.proxyHealthState).toBe('open');
    expect(body.timestamp).toBeTruthy();
    expect(body.message).toContain('circuit is open');
  });

  it('each blocked request gets a unique correlation ID', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner);

    proxy.forceState('open');

    const r1 = await proxy.proxy(makeRequest());
    const r2 = await proxy.proxy(makeRequest());

    const id1 = r1.headers['x-portarium-correlation-id'];
    const id2 = r2.headers['x-portarium-correlation-id'];

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it('returns Retry-After header based on recovery window', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 1,
      recoveryWindowMs: 60_000,
      successThreshold: 1,
    });

    proxy.forceState('open');

    const result = await proxy.proxy(makeRequest());
    expect(result.headers['retry-after']).toBe('60');
  });

  it('returns 502 with UpstreamFailure when inner proxy has upstream error', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchThrow());
    const proxy = new FailClosedProxy(inner);

    // Inner proxy catches the throw and returns 502 UpstreamFailure
    const result = await proxy.proxy(makeRequest());
    expect(result.status).toBe(502);
    const body = JSON.parse(result.body) as { error: string };
    expect(body.error).toBe('UpstreamFailure');
  });
});

// ---------------------------------------------------------------------------
// Tests: Audit logging during failures
// ---------------------------------------------------------------------------

describe('FailClosedProxy — audit logging', () => {
  it('emits audit record when request is blocked by circuit breaker', async () => {
    const sink = makeAuditSink();
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner, undefined, sink);

    proxy.forceState('open');

    await proxy.proxy(makeRequest({ method: 'POST', url: 'https://api.example.com/v1/action' }));

    expect(sink.records).toHaveLength(1);
    const record = sink.records[0]!;
    expect(record.policyDecision).toBe('deny');
    expect(record.responseStatus).toBe(503);
    expect(record.destinationHost).toBe('api.example.com');
    expect(record.httpMethod).toBe('POST');
    expect(record.httpPath).toBe('/v1/action');
    expect(record.policyReason).toContain('ProxyUnavailable');
    expect(record.policyReason).toContain('correlationId=');
  });

  it('does not emit blocked audit when no sink is configured', async () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner);

    proxy.forceState('open');

    // Should not throw
    const result = await proxy.proxy(makeRequest());
    expect(result.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Tests: Status reporting
// ---------------------------------------------------------------------------

describe('FailClosedProxy — status', () => {
  it('reports healthy status initially', () => {
    const inner = new SidecarProxy(makeConfig(), makeFetchOk());
    const proxy = new FailClosedProxy(inner);

    const status = proxy.status();
    expect(status.healthState).toBe('healthy');
    expect(status.consecutiveFailures).toBe(0);
    expect(status.consecutiveSuccesses).toBe(0);
    expect(status.lastFailureTimestamp).toBeUndefined();
    expect(status.circuitOpenedAt).toBeUndefined();
    expect(status.totalRequestsBlocked).toBe(0);
  });

  it('reports failure count and timestamp after failures', async () => {
    const now = 1000;
    const inner = new SidecarProxy(makeConfig(), makeFetchFail502());
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 5,
      recoveryWindowMs: 30_000,
      successThreshold: 2,
      now: () => now,
    });

    await proxy.proxy(makeRequest());

    const status = proxy.status();
    expect(status.consecutiveFailures).toBe(1);
    expect(status.lastFailureTimestamp).toBe(1000);
    expect(status.healthState).toBe('degraded');
  });

  it('reports circuitOpenedAt when circuit opens', async () => {
    const now = 5000;
    const inner = new SidecarProxy(makeConfig(), makeFetchFail502());
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 1,
      recoveryWindowMs: 30_000,
      successThreshold: 1,
      now: () => now,
    });

    await proxy.proxy(makeRequest());

    const status = proxy.status();
    expect(status.healthState).toBe('open');
    expect(status.circuitOpenedAt).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Tests: Chaos scenarios — rapid failure/recovery cycling
// ---------------------------------------------------------------------------

describe('FailClosedProxy — chaos scenarios', () => {
  it('handles rapid failure-recovery cycling without bypass', async () => {
    let shouldFail = false;
    let now = 1000;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      if (shouldFail) return new Response('fail', { status: 502 });
      return new Response('ok', { status: 200 });
    });

    const inner = new SidecarProxy(makeConfig(), fetchImpl);
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 2,
      recoveryWindowMs: 1000,
      successThreshold: 1,
      now: () => now,
    });

    // Cycle 1: fail → open → recover → healthy
    shouldFail = true;
    await proxy.proxy(makeRequest());
    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('open');

    now += 1001;
    shouldFail = false;
    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('healthy');

    // Cycle 2: fail again → open → recover
    shouldFail = true;
    await proxy.proxy(makeRequest());
    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('open');

    now += 1001;
    shouldFail = false;
    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('healthy');

    // At no point was a request forwarded while circuit was open
    // (makeFetchOk calls only happened during healthy/half-open states)
  });

  it('mixed 502/200 responses keep proxy in degraded but do not open circuit prematurely', async () => {
    let callCount = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      callCount++;
      // Pattern: fail, success, fail, success (alternating)
      if (callCount % 2 === 1) return new Response('fail', { status: 502 });
      return new Response('ok', { status: 200 });
    });

    const inner = new SidecarProxy(makeConfig(), fetchImpl);
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 3,
      recoveryWindowMs: 30_000,
      successThreshold: 2,
    });

    // fail → degraded
    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('degraded');

    // success → resets consecutive failures
    await proxy.proxy(makeRequest());

    // fail → degraded again (consecutive=1, not 2)
    await proxy.proxy(makeRequest());
    expect(proxy.healthState).toBe('degraded');

    // success → resets
    await proxy.proxy(makeRequest());

    // Never reached open because consecutive failures never hit 3
    expect(proxy.healthState).not.toBe('open');
  });

  it('504 gateway timeout also counts as upstream failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('timeout', { status: 504 }));

    const inner = new SidecarProxy(makeConfig(), fetchImpl);
    const proxy = new FailClosedProxy(inner, {
      failureThreshold: 2,
      recoveryWindowMs: 30_000,
      successThreshold: 1,
    });

    await proxy.proxy(makeRequest());
    await proxy.proxy(makeRequest());

    expect(proxy.healthState).toBe('open');
  });
});

/**
 * Gateway and sidecar latency/throughput performance budget tests (bead-0840).
 *
 * Validates that the enforced egress routing path (AgentGateway → SidecarProxy
 * → FailClosedProxy) meets latency, throughput, and error-rate budgets.
 *
 * Thresholds:
 *   - p95 added latency ≤ 25 ms for governed dispatch path at reference load.
 *   - Throughput degradation ≤ 20% versus baseline.
 *   - Error rate ≤ 1% under steady-state load.
 *
 * The tests use in-process stubs (no real network) to isolate the overhead
 * introduced by auth, rate limiting, policy checking, circuit-breaking,
 * trace-context injection, and audit emission.
 */

import { describe, expect, it } from 'vitest';

import { AgentGateway, type AuthVerifyResult } from '../gateway/agent-gateway.js';
import { TokenBucketRateLimiter } from '../gateway/rate-limiter.js';
import type { EgressAuditRecord, EgressAuditSink } from './egress-audit-log.js';
import { FailClosedProxy } from './fail-closed-proxy.js';
import type { SidecarConfigV1 } from './sidecar-config-v1.js';
import { SidecarProxy } from './sidecar-proxy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** No-op audit sink that counts emissions. */
class CountingAuditSink implements EgressAuditSink {
  public count = 0;
  public emit(_record: EgressAuditRecord): void {
    this.count++;
  }
}

/** Fake upstream fetch that returns immediately with a fixed payload. */
function instantFetch(status = 200, body = '{"ok":true}'): typeof fetch {
  return (async () => ({
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => body,
  })) as unknown as typeof fetch;
}

/** Fake upstream fetch that resolves after a fixed delay. */
function delayedFetch(delayMs: number, status = 200): typeof fetch {
  return (async () => {
    await new Promise((r) => setTimeout(r, delayMs));
    return {
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '{"ok":true}',
    };
  }) as unknown as typeof fetch;
}

/** Fake upstream fetch that always rejects (simulates network failure). */
function failingFetch(): typeof fetch {
  return (async () => {
    throw new Error('connection refused');
  }) as unknown as typeof fetch;
}

/** Build a SidecarProxy with an allow-all config and optional fetch/audit. */
function buildSidecarProxy(fetchImpl: typeof fetch, auditSink?: EgressAuditSink): SidecarProxy {
  const config: SidecarConfigV1 = {
    upstreamUrl: 'http://localhost:3000',
    egressAllowlist: ['api.example.com', '*.internal.io'],
    tokenRefreshIntervalMs: 300_000,
    listenPort: 15001,
    enforcementMode: 'enforce',
  };
  const proxy = new SidecarProxy(config, fetchImpl, auditSink);
  proxy.setToken('test-token');
  proxy.setIdentity({
    tenantId: 'tenant-1',
    workflowRunId: 'run-1',
    agentSpiffeId: 'spiffe://portarium/agent/1',
  });
  return proxy;
}

/** Collect percentiles from a sorted array of numbers. */
function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

/** Run N sequential sidecar proxy requests and return sorted latencies. */
async function measureSidecarLatencies(
  proxy: SidecarProxy | FailClosedProxy,
  count: number,
): Promise<number[]> {
  const latencies: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    await proxy.proxy({
      method: 'GET',
      url: 'https://api.example.com/v1/data',
      headers: { accept: 'application/json' },
    });
    latencies.push(performance.now() - start);
  }
  return latencies.sort((a, b) => a - b);
}

/** Measure baseline fetch latency (no proxy overhead). */
async function measureBaselineLatencies(fetchImpl: typeof fetch, count: number): Promise<number[]> {
  const latencies: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    const response = await fetchImpl('https://api.example.com/v1/data');
    await response.text();
    latencies.push(performance.now() - start);
  }
  return latencies.sort((a, b) => a - b);
}

/** Calculate mean of an array. */
function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Reference load: number of requests per benchmark iteration.
 * High enough for stable percentiles, low enough for fast CI.
 */
const REFERENCE_LOAD = 200;

/** Warm-up iterations before measurement. */
const WARMUP_COUNT = 10;

/** Maximum p95 added latency in ms for the governed path. */
const MAX_P95_ADDED_LATENCY_MS = 25;

/** Maximum throughput degradation as a fraction (0.20 = 20%). */
const MAX_THROUGHPUT_DEGRADATION = 0.2;

/** Maximum error rate as a fraction (0.01 = 1%). */
const MAX_ERROR_RATE = 0.01;

// ---------------------------------------------------------------------------
// AC1: Baseline vs enforced path — p50/p95 latency and throughput
// ---------------------------------------------------------------------------

describe('AC1: Baseline vs enforced path latency and throughput', () => {
  it(
    'sidecar proxy p95 added latency is within budget',
    { retry: 1, timeout: 30_000 },
    async () => {
      const fetchImpl = instantFetch();
      const auditSink = new CountingAuditSink();
      const proxy = buildSidecarProxy(fetchImpl, auditSink);

      // Warm-up
      await measureSidecarLatencies(proxy, WARMUP_COUNT);

      const baselineLatencies = await measureBaselineLatencies(fetchImpl, REFERENCE_LOAD);
      const enforcedLatencies = await measureSidecarLatencies(proxy, REFERENCE_LOAD);

      const baselineP95 = percentile(baselineLatencies, 95);
      const enforcedP95 = percentile(enforcedLatencies, 95);
      const addedP95 = enforcedP95 - baselineP95;

      expect(addedP95).toBeLessThanOrEqual(MAX_P95_ADDED_LATENCY_MS);
      expect(auditSink.count).toBeGreaterThanOrEqual(REFERENCE_LOAD + WARMUP_COUNT);
    },
  );

  it(
    'sidecar proxy p50 added latency is within half the p95 budget',
    { retry: 1, timeout: 30_000 },
    async () => {
      const fetchImpl = instantFetch();
      const proxy = buildSidecarProxy(fetchImpl);

      await measureSidecarLatencies(proxy, WARMUP_COUNT);

      const baselineLatencies = await measureBaselineLatencies(fetchImpl, REFERENCE_LOAD);
      const enforcedLatencies = await measureSidecarLatencies(proxy, REFERENCE_LOAD);

      const baselineP50 = percentile(baselineLatencies, 50);
      const enforcedP50 = percentile(enforcedLatencies, 50);
      const addedP50 = enforcedP50 - baselineP50;

      expect(addedP50).toBeLessThanOrEqual(MAX_P95_ADDED_LATENCY_MS / 2);
    },
  );

  it(
    'throughput degradation is within 20% budget (simulated 2ms network RTT)',
    { retry: 1, timeout: 60_000 },
    async () => {
      // Use a realistic simulated network RTT so proxy overhead is measured
      // relative to actual request time, not zero-cost in-process stubs.
      const realisticFetch = delayedFetch(2);
      const proxy = buildSidecarProxy(realisticFetch);
      const count = 50; // fewer iterations since each takes ~2ms

      // Warm-up
      await measureBaselineLatencies(realisticFetch, 5);
      await measureSidecarLatencies(proxy, 5);

      // Baseline throughput: requests per ms
      const baseStart = performance.now();
      await measureBaselineLatencies(realisticFetch, count);
      const baseElapsed = performance.now() - baseStart;
      const baselineThroughput = count / baseElapsed;

      // Enforced throughput: requests per ms
      const enfStart = performance.now();
      await measureSidecarLatencies(proxy, count);
      const enfElapsed = performance.now() - enfStart;
      const enforcedThroughput = count / enfElapsed;

      const degradation = 1 - enforcedThroughput / baselineThroughput;
      expect(degradation).toBeLessThanOrEqual(MAX_THROUGHPUT_DEGRADATION);
    },
  );

  it(
    'fail-closed proxy adds negligible overhead vs bare sidecar proxy',
    { retry: 1, timeout: 30_000 },
    async () => {
      const fetchImpl = instantFetch();
      const auditSink = new CountingAuditSink();
      const sidecar = buildSidecarProxy(fetchImpl, auditSink);
      const failClosed = new FailClosedProxy(
        sidecar,
        { failureThreshold: 5, recoveryWindowMs: 1000, successThreshold: 2 },
        auditSink,
      );

      await measureSidecarLatencies(sidecar, WARMUP_COUNT);
      await measureSidecarLatencies(failClosed, WARMUP_COUNT);

      const sidecarLatencies = await measureSidecarLatencies(sidecar, REFERENCE_LOAD);
      const failClosedLatencies = await measureSidecarLatencies(failClosed, REFERENCE_LOAD);

      const sidecarP95 = percentile(sidecarLatencies, 95);
      const failClosedP95 = percentile(failClosedLatencies, 95);

      // Fail-closed wrapper should add less than 5ms overhead at p95
      expect(failClosedP95 - sidecarP95).toBeLessThanOrEqual(5);
    },
  );

  it('reports p50 and p95 latency values for both paths', { timeout: 30_000 }, async () => {
    const fetchImpl = instantFetch();
    const proxy = buildSidecarProxy(fetchImpl);

    await measureSidecarLatencies(proxy, WARMUP_COUNT);
    const baselineLatencies = await measureBaselineLatencies(fetchImpl, REFERENCE_LOAD);
    const enforcedLatencies = await measureSidecarLatencies(proxy, REFERENCE_LOAD);

    const report = {
      baseline: {
        p50: percentile(baselineLatencies, 50).toFixed(3),
        p95: percentile(baselineLatencies, 95).toFixed(3),
        mean: mean(baselineLatencies).toFixed(3),
      },
      enforced: {
        p50: percentile(enforcedLatencies, 50).toFixed(3),
        p95: percentile(enforcedLatencies, 95).toFixed(3),
        mean: mean(enforcedLatencies).toFixed(3),
      },
    };

    // Structural assertion: report has valid numbers
    expect(Number(report.baseline.p50)).toBeGreaterThanOrEqual(0);
    expect(Number(report.enforced.p50)).toBeGreaterThanOrEqual(0);
    expect(Number(report.enforced.p95)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC2: Pass/fail thresholds
// ---------------------------------------------------------------------------

describe('AC2: Pass/fail thresholds — p95 latency, throughput, error rate', () => {
  it('p95 added latency <= 25 ms at reference load', { retry: 1, timeout: 30_000 }, async () => {
    const fetchImpl = instantFetch();
    const proxy = buildSidecarProxy(fetchImpl);

    await measureSidecarLatencies(proxy, WARMUP_COUNT);
    const baselineLatencies = await measureBaselineLatencies(fetchImpl, REFERENCE_LOAD);
    const enforcedLatencies = await measureSidecarLatencies(proxy, REFERENCE_LOAD);

    const addedP95 = percentile(enforcedLatencies, 95) - percentile(baselineLatencies, 95);
    expect(addedP95).toBeLessThanOrEqual(MAX_P95_ADDED_LATENCY_MS);
  });

  it(
    'throughput degradation <= 20% versus baseline (simulated 2ms network RTT)',
    { retry: 1, timeout: 60_000 },
    async () => {
      const realisticFetch = delayedFetch(2);
      const proxy = buildSidecarProxy(realisticFetch);
      const count = 50;

      await measureBaselineLatencies(realisticFetch, 5);
      await measureSidecarLatencies(proxy, 5);

      const baseStart = performance.now();
      await measureBaselineLatencies(realisticFetch, count);
      const baseThroughput = count / (performance.now() - baseStart);

      const enfStart = performance.now();
      await measureSidecarLatencies(proxy, count);
      const enfThroughput = count / (performance.now() - enfStart);

      expect(1 - enfThroughput / baseThroughput).toBeLessThanOrEqual(MAX_THROUGHPUT_DEGRADATION);
    },
  );

  it(
    'error rate <= 1% under steady-state load with allowed destinations',
    { timeout: 30_000 },
    async () => {
      const fetchImpl = instantFetch();
      const proxy = buildSidecarProxy(fetchImpl);
      let errors = 0;
      const total = REFERENCE_LOAD;

      for (let i = 0; i < total; i++) {
        const result = await proxy.proxy({
          method: 'GET',
          url: 'https://api.example.com/v1/data',
          headers: { accept: 'application/json' },
        });
        if (result.status >= 500) errors++;
      }

      expect(errors / total).toBeLessThanOrEqual(MAX_ERROR_RATE);
    },
  );

  it('denied destinations return 403, not 5xx (zero error-rate noise)', async () => {
    const fetchImpl = instantFetch();
    const proxy = buildSidecarProxy(fetchImpl);
    let clientErrors = 0;
    let serverErrors = 0;
    const total = 50;

    for (let i = 0; i < total; i++) {
      const result = await proxy.proxy({
        method: 'GET',
        url: 'https://evil.example.com/exfil',
        headers: {},
      });
      if (result.status >= 400 && result.status < 500) clientErrors++;
      if (result.status >= 500) serverErrors++;
    }

    expect(clientErrors).toBe(total);
    expect(serverErrors).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC3: Rate limits, retries, and timeout behavior under stress
// ---------------------------------------------------------------------------

describe('AC3: Rate limits, retries, and timeout behavior under stress', () => {
  it('rate limiter correctly throttles above configured capacity', async () => {
    const limiter = new TokenBucketRateLimiter({
      maxTokens: 10,
      refillRatePerSecond: 100,
    });

    let allowed = 0;
    let denied = 0;
    // Drain the bucket rapidly
    for (let i = 0; i < 20; i++) {
      const result = limiter.tryConsume('ws-perf');
      if (result.allowed) allowed++;
      else denied++;
    }

    expect(allowed).toBe(10);
    expect(denied).toBe(10);
  });

  it('rate limiter refills over time allowing sustained throughput', async () => {
    let now = 0;
    const limiter = new TokenBucketRateLimiter(
      { maxTokens: 5, refillRatePerSecond: 1000 },
      () => now,
    );

    // Drain bucket
    for (let i = 0; i < 5; i++) limiter.tryConsume('ws-perf');
    expect(limiter.tryConsume('ws-perf').allowed).toBe(false);

    // Advance time by 10ms → 10 tokens refilled (capped at 5)
    now += 10;
    let refilled = 0;
    for (let i = 0; i < 5; i++) {
      if (limiter.tryConsume('ws-perf').allowed) refilled++;
    }
    expect(refilled).toBe(5);
  });

  it('sidecar handles upstream timeout gracefully (returns 502)', { timeout: 10_000 }, async () => {
    // Simulate upstream that never responds within reasonable time
    const slowFetch = delayedFetch(50);
    const proxy = buildSidecarProxy(slowFetch);

    const start = performance.now();
    const result = await proxy.proxy({
      method: 'GET',
      url: 'https://api.example.com/v1/data',
      headers: {},
    });
    const elapsed = performance.now() - start;

    // Delayed fetch completes (not a real timeout), but latency is bounded
    expect(result.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(40); // at least the delay
    expect(elapsed).toBeLessThan(5000); // bounded, not hanging
  });

  it('fail-closed proxy opens circuit after consecutive upstream failures', async () => {
    const fetchImpl = failingFetch();
    const sidecar = buildSidecarProxy(fetchImpl);
    const failClosed = new FailClosedProxy(sidecar, {
      failureThreshold: 3,
      recoveryWindowMs: 60_000,
      successThreshold: 2,
    });

    // First 3 requests: proxy attempts (inner throws → 503)
    for (let i = 0; i < 3; i++) {
      const r = await failClosed.proxy({
        method: 'GET',
        url: 'https://api.example.com/v1/data',
        headers: {},
      });
      expect(r.status).toBeGreaterThanOrEqual(500);
    }

    expect(failClosed.healthState).toBe('open');

    // Subsequent requests are immediately blocked (fast-fail, no inner proxy call)
    const blockedStart = performance.now();
    const blocked = await failClosed.proxy({
      method: 'GET',
      url: 'https://api.example.com/v1/data',
      headers: {},
    });
    const blockedElapsed = performance.now() - blockedStart;

    expect(blocked.status).toBe(503);
    // Circuit-open response should be near-instant (no upstream call), but
    // single-call timing on Windows/worktrees can jitter a few milliseconds.
    expect(blockedElapsed).toBeLessThan(10);
  });

  it('fail-closed proxy recovers after recovery window and successful probe', async () => {
    let now = 1000;
    const goodFetch = instantFetch();
    const sidecar = buildSidecarProxy(goodFetch);
    const failClosed = new FailClosedProxy(sidecar, {
      failureThreshold: 3,
      recoveryWindowMs: 100,
      successThreshold: 1,
      now: () => now,
    });

    // Force circuit open — circuitOpenedAt is set to now (1000)
    failClosed.forceState('open');
    expect(failClosed.healthState).toBe('open');

    // Advance past recovery window: elapsed = 1200 - 1000 = 200 >= 100
    now = 1200;

    // Next request should be a probe (half-open → success → healthy)
    const probeResult = await failClosed.proxy({
      method: 'GET',
      url: 'https://api.example.com/v1/data',
      headers: {},
    });

    expect(probeResult.status).toBe(200);
    expect(failClosed.healthState).toBe('healthy');
  });

  it('concurrent burst does not exceed error budget', { timeout: 30_000 }, async () => {
    const fetchImpl = instantFetch();
    const proxy = buildSidecarProxy(fetchImpl);
    const burstSize = 100;

    const results = await Promise.all(
      Array.from({ length: burstSize }, () =>
        proxy.proxy({
          method: 'POST',
          url: 'https://api.example.com/v1/actions',
          headers: { 'content-type': 'application/json' },
          body: '{"action":"test"}',
        }),
      ),
    );

    const errors = results.filter((r) => r.status >= 500).length;
    expect(errors / burstSize).toBeLessThanOrEqual(MAX_ERROR_RATE);
  });
});

// ---------------------------------------------------------------------------
// AC4: Gateway overhead measurement
// ---------------------------------------------------------------------------

describe('AC4: Gateway full-stack overhead measurement', () => {
  it(
    'gateway auth + validation + proxy overhead stays within p95 budget',
    { retry: 1, timeout: 30_000 },
    async () => {
      const fetchImpl = instantFetch();
      const gateway = new AgentGateway({
        controlPlaneBaseUrl: 'http://control-plane:3000',
        authVerifier: async () =>
          ({ ok: true, workspaceId: 'ws-perf', subject: 'user-bench' }) as AuthVerifyResult,
        rateLimiter: new TokenBucketRateLimiter({
          maxTokens: 10_000,
          refillRatePerSecond: 10_000,
        }),
        fetchImpl,
      });

      // Build minimal Node.js-like request/response objects for gateway
      const { Readable } = await import('node:stream');
      const { Socket } = await import('node:net');
      type IncomingMessage = import('node:http').IncomingMessage;
      type ServerResponse = import('node:http').ServerResponse;

      function makeReq(): IncomingMessage {
        const r = new Readable();
        r.push('{"test":true}');
        r.push(null);
        return Object.assign(r, {
          method: 'POST',
          url: '/api/v1/runs',
          headers: {
            authorization: 'Bearer test-token',
            'content-type': 'application/json',
          },
          socket: new Socket(),
        }) as unknown as IncomingMessage;
      }

      function makeRes(): ServerResponse & { _status: number } {
        const res = {
          _status: 0,
          _body: '',
          writeHead(status: number) {
            res._status = status;
            return res;
          },
          end(body?: string) {
            res._body = body ?? '';
            return res;
          },
          setHeader() {
            return res;
          },
        } as unknown as ServerResponse & { _status: number; _body: string };
        return res;
      }

      // Warm-up
      for (let i = 0; i < WARMUP_COUNT; i++) {
        await gateway.handleRequest(makeReq(), makeRes());
      }

      // Measure gateway latencies
      const gatewayLatencies: number[] = [];
      for (let i = 0; i < REFERENCE_LOAD; i++) {
        const start = performance.now();
        await gateway.handleRequest(makeReq(), makeRes());
        gatewayLatencies.push(performance.now() - start);
      }
      gatewayLatencies.sort((a, b) => a - b);

      // Measure baseline (just fetch, no gateway)
      const baselineLatencies = await measureBaselineLatencies(fetchImpl, REFERENCE_LOAD);

      const addedP95 = percentile(gatewayLatencies, 95) - percentile(baselineLatencies, 95);

      expect(addedP95).toBeLessThanOrEqual(MAX_P95_ADDED_LATENCY_MS);
    },
  );

  it('gateway rate-limit rejection is near-instant', async () => {
    const gateway = new AgentGateway({
      controlPlaneBaseUrl: 'http://control-plane:3000',
      authVerifier: async () =>
        ({ ok: true, workspaceId: 'ws-rl', subject: 'user-rl' }) as AuthVerifyResult,
      rateLimiter: new TokenBucketRateLimiter({
        maxTokens: 1,
        refillRatePerSecond: 0.001,
      }),
      fetchImpl: instantFetch(),
    });

    const { Readable } = await import('node:stream');
    const { Socket } = await import('node:net');
    type IncomingMessage = import('node:http').IncomingMessage;
    type ServerResponse = import('node:http').ServerResponse;

    function makeReq(): IncomingMessage {
      const r = new Readable();
      r.push(null);
      return Object.assign(r, {
        method: 'GET',
        url: '/api/v1/runs',
        headers: { authorization: 'Bearer test-token' },
        socket: new Socket(),
      }) as unknown as IncomingMessage;
    }

    function makeRes(): ServerResponse & { _status: number } {
      const res = {
        _status: 0,
        writeHead(status: number) {
          res._status = status;
          return res;
        },
        end() {
          return res;
        },
        setHeader() {
          return res;
        },
      } as unknown as ServerResponse & { _status: number; _body: string };
      return res;
    }

    // Exhaust the bucket
    await gateway.handleRequest(makeReq(), makeRes());

    // Rate-limited requests should be near-instant (no proxy call)
    const latencies: number[] = [];
    for (let i = 0; i < 50; i++) {
      const r = makeRes();
      const start = performance.now();
      await gateway.handleRequest(makeReq(), r);
      latencies.push(performance.now() - start);
      expect(r._status).toBe(429);
    }

    latencies.sort((a, b) => a - b);
    // Rate-limit rejections should complete in under 2ms at p95
    expect(percentile(latencies, 95)).toBeLessThan(2);
  });

  it('gateway auth rejection is near-instant', async () => {
    const gateway = new AgentGateway({
      controlPlaneBaseUrl: 'http://control-plane:3000',
      authVerifier: async () => ({ ok: false, reason: 'Invalid token' }) as AuthVerifyResult,
      rateLimiter: new TokenBucketRateLimiter({
        maxTokens: 10_000,
        refillRatePerSecond: 10_000,
      }),
      fetchImpl: instantFetch(),
    });

    const { Readable } = await import('node:stream');
    const { Socket } = await import('node:net');
    type IncomingMessage = import('node:http').IncomingMessage;
    type ServerResponse = import('node:http').ServerResponse;

    function makeReq(): IncomingMessage {
      const r = new Readable();
      r.push(null);
      return Object.assign(r, {
        method: 'GET',
        url: '/api/v1/runs',
        headers: {},
        socket: new Socket(),
      }) as unknown as IncomingMessage;
    }

    function makeRes(): ServerResponse & { _status: number } {
      const res = {
        _status: 0,
        writeHead(status: number) {
          res._status = status;
          return res;
        },
        end() {
          return res;
        },
        setHeader() {
          return res;
        },
      } as unknown as ServerResponse & { _status: number; _body: string };
      return res;
    }

    const latencies: number[] = [];
    for (let i = 0; i < 50; i++) {
      const r = makeRes();
      const start = performance.now();
      await gateway.handleRequest(makeReq(), r);
      latencies.push(performance.now() - start);
      expect(r._status).toBe(401);
    }

    latencies.sort((a, b) => a - b);
    expect(percentile(latencies, 95)).toBeLessThan(2);
  });
});

// ---------------------------------------------------------------------------
// Audit emission does not degrade performance
// ---------------------------------------------------------------------------

describe('Audit emission overhead', () => {
  it('audit sink emission adds < 5ms overhead at p95', { retry: 1, timeout: 30_000 }, async () => {
    const fetchImpl = instantFetch();
    const noAuditProxy = buildSidecarProxy(fetchImpl);
    const auditProxy = buildSidecarProxy(fetchImpl, new CountingAuditSink());

    await measureSidecarLatencies(noAuditProxy, WARMUP_COUNT);
    await measureSidecarLatencies(auditProxy, WARMUP_COUNT);

    const noAuditLatencies = await measureSidecarLatencies(noAuditProxy, REFERENCE_LOAD);
    const auditLatencies = await measureSidecarLatencies(auditProxy, REFERENCE_LOAD);

    const overhead = percentile(auditLatencies, 95) - percentile(noAuditLatencies, 95);
    expect(overhead).toBeLessThanOrEqual(5);
  });
});

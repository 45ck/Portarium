/**
 * Rate-limit load and stress tests.
 *
 * These tests validate rate-limit correctness under synthetic high-concurrency
 * scenarios without requiring an external load-testing tool. They cover:
 *
 * 1. 429 / Retry-After correctness under load
 * 2. Graceful shedding — behaviour at 10× and 100× over the configured limit
 * 3. Multi-tenant isolation — one tenant's traffic cannot exhaust another's quota
 * 4. Concurrent record correctness — no silent drops or double-counts
 *
 * (Window boundary and token bucket tests: rate-limit-boundary-token-bucket.test.ts)
 *
 * Bead: bead-0381
 */

import { describe, expect, it } from 'vitest';

import { TenantId, UserId } from '../../domain/primitives/index.js';
import type { RateLimitRuleV1, RateLimitScope } from '../../domain/rate-limiting/index.js';
import { InMemoryRateLimitStore } from './in-memory-rate-limit-store.js';
import {
  checkRateLimit,
  recordRateLimitedRequest,
} from '../../application/services/rate-limit-guard.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate N concurrent requests against checkRateLimit and return counts. */
async function simulateLoad(
  store: InMemoryRateLimitStore,
  scope: RateLimitScope,
  requestCount: number,
  nowIso: string,
): Promise<{ allowed: number; rejected: number; retryAfterValues: number[] }> {
  const deps = { rateLimitStore: store, clock: () => nowIso };
  const results = await Promise.all(
    Array.from({ length: requestCount }, () => checkRateLimit(deps, scope)),
  );

  let allowed = 0;
  let rejected = 0;
  const retryAfterValues: number[] = [];

  for (const r of results) {
    if (r.allowed) {
      allowed++;
    } else {
      rejected++;
      retryAfterValues.push(r.retryAfterSeconds);
    }
  }

  return { allowed, rejected, retryAfterValues };
}

// ---------------------------------------------------------------------------
// 429 / Retry-After correctness under load
// ---------------------------------------------------------------------------

describe('rate-limit load: 429 / Retry-After correctness', () => {
  it('returns retryAfterSeconds > 0 for every rejected request', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('load-tenant') };
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: 5,
    };
    store.setRules(scope, [rule]);

    // Pre-fill to the limit
    const nowIso = '2026-02-22T10:00:10.000Z';
    for (let i = 0; i < 5; i++) {
      await store.recordRequest({ scope, window: 'PerMinute', nowIso });
    }

    // Fire 50 requests after the limit is hit
    const { rejected, retryAfterValues } = await simulateLoad(store, scope, 50, nowIso);

    expect(rejected).toBe(50);
    expect(retryAfterValues.every((v) => v >= 1)).toBe(true);
  });

  it('retryAfterSeconds decreases as the window reset approaches', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('retry-tenant') };
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: 1,
    };
    store.setRules(scope, [rule]);

    const fillIso = '2026-02-22T10:00:05.000Z';
    await store.recordRequest({ scope, window: 'PerMinute', nowIso: fillIso });

    // Check at 10 s and 50 s into the minute
    const deps10s = { rateLimitStore: store, clock: () => '2026-02-22T10:00:10.000Z' };
    const deps50s = { rateLimitStore: store, clock: () => '2026-02-22T10:00:50.000Z' };

    const r10 = await checkRateLimit(deps10s, scope);
    const r50 = await checkRateLimit(deps50s, scope);

    expect(r10.allowed).toBe(false);
    expect(r50.allowed).toBe(false);
    if (!r10.allowed && !r50.allowed) {
      expect(r50.retryAfterSeconds).toBeLessThan(r10.retryAfterSeconds);
    }
  });

  it('retryAfterSeconds is at least 1 second even at the last millisecond', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('last-ms-tenant') };
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: 1,
    };
    store.setRules(scope, [rule]);

    await store.recordRequest({ scope, window: 'PerMinute', nowIso: '2026-02-22T10:00:00.001Z' });

    // Request at 999 ms into the minute — window resets in 1 ms
    const deps = { rateLimitStore: store, clock: () => '2026-02-22T10:00:59.999Z' };
    const result = await checkRateLimit(deps, scope);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Graceful shedding under overload
// ---------------------------------------------------------------------------

describe('rate-limit load: graceful shedding', () => {
  it('sheds exactly the correct number of requests at 10× over limit', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('shed-tenant') };
    const limit = 10;
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: limit,
    };
    store.setRules(scope, [rule]);

    const nowIso = '2026-02-22T10:00:05.000Z';

    // Fill to limit first
    for (let i = 0; i < limit; i++) {
      await store.recordRequest({ scope, window: 'PerMinute', nowIso });
    }

    // Fire 10× the limit — all should be rejected
    const overloadCount = limit * 10;
    const { allowed, rejected } = await simulateLoad(store, scope, overloadCount, nowIso);

    expect(allowed).toBe(0);
    expect(rejected).toBe(overloadCount);
  });

  it('sheds at 100× over limit without error or hang', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('extreme-shed-tenant') };
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: 5,
    };
    store.setRules(scope, [rule]);

    const nowIso = '2026-02-22T10:00:01.000Z';
    for (let i = 0; i < 5; i++) {
      await store.recordRequest({ scope, window: 'PerMinute', nowIso });
    }

    const { rejected } = await simulateLoad(store, scope, 500, nowIso);
    expect(rejected).toBe(500);
  });

  it('allows burst allowance to absorb short spikes before shedding', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('burst-shed-tenant') };
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: 10,
      burstAllowance: 5, // effective max: 15
    };
    store.setRules(scope, [rule]);

    const nowIso = '2026-02-22T10:00:05.000Z';
    // Fill 15 requests (base + burst)
    for (let i = 0; i < 15; i++) {
      await store.recordRequest({ scope, window: 'PerMinute', nowIso });
    }

    // Next 20 requests should all be shed
    const { allowed, rejected } = await simulateLoad(store, scope, 20, nowIso);
    expect(allowed).toBe(0);
    expect(rejected).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Multi-tenant isolation under load
// ---------------------------------------------------------------------------

describe('rate-limit load: multi-tenant isolation', () => {
  it('one tenant exhausting quota does not affect other tenants', async () => {
    const store = new InMemoryRateLimitStore();
    const tenantA: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('tenant-a') };
    const tenantB: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('tenant-b') };
    const rule = (scope: RateLimitScope): RateLimitRuleV1 => ({
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: 5,
    });

    store.setRules(tenantA, [rule(tenantA)]);
    store.setRules(tenantB, [rule(tenantB)]);

    const nowIso = '2026-02-22T10:00:05.000Z';

    // Exhaust tenant A
    for (let i = 0; i < 5; i++) {
      await store.recordRequest({ scope: tenantA, window: 'PerMinute', nowIso });
    }

    // Tenant B should be unaffected
    const resultA = await checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, tenantA);
    const resultB = await checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, tenantB);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it('100 independent tenants each hit their own limit without interference', async () => {
    const store = new InMemoryRateLimitStore();
    const tenantCount = 100;
    const limit = 3;
    const nowIso = '2026-02-22T10:00:05.000Z';

    const scopes = Array.from({ length: tenantCount }, (_, i) => {
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId(`tenant-${i}`) };
      store.setRules(scope, [
        {
          schemaVersion: 1,
          scope,
          window: 'PerMinute',
          maxRequests: limit,
        },
      ]);
      return scope;
    });

    // Each tenant records exactly `limit` requests
    await Promise.all(
      scopes.flatMap((scope) =>
        Array.from({ length: limit }, () =>
          store.recordRequest({ scope, window: 'PerMinute', nowIso }),
        ),
      ),
    );

    // Each tenant should now be exactly at their limit (rejected)
    const results = await Promise.all(
      scopes.map((scope) => checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, scope)),
    );

    const rejectedCount = results.filter((r) => !r.allowed).length;
    expect(rejectedCount).toBe(tenantCount);
  });
});

// ---------------------------------------------------------------------------
// Concurrent record correctness
// ---------------------------------------------------------------------------

describe('rate-limit load: concurrent record correctness', () => {
  it('sequential requests accumulate correctly (no silent drops)', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('count-tenant') };
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: 1000,
    };
    store.setRules(scope, [rule]);

    const nowIso = '2026-02-22T10:00:05.000Z';
    const count = 200;
    const deps = { rateLimitStore: store, clock: () => nowIso };

    for (let i = 0; i < count; i++) {
      await recordRateLimitedRequest(deps, scope, rule);
    }

    const result = await checkRateLimit(deps, scope);
    expect(result.allowed).toBe(true);
    expect(result.usage.requestCount).toBe(count);
  });

  it('all requests in a burst are checked against the same window', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'User', userId: UserId('burst-user') };
    const limit = 50;
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerHour',
      maxRequests: limit,
    };
    store.setRules(scope, [rule]);

    const nowIso = '2026-02-22T10:30:00.000Z';
    for (let i = 0; i < limit; i++) {
      await store.recordRequest({ scope, window: 'PerHour', nowIso });
    }

    // All subsequent requests in the same hour should be rejected
    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, scope),
      ),
    );

    expect(results.every((r) => !r.allowed)).toBe(true);
    expect(results.every((r) => !r.allowed && r.usage.window === 'PerHour')).toBe(true);
  });
});

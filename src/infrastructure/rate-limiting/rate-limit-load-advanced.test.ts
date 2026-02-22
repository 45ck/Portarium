/**
 * Rate-limit load tests (part 2): concurrent record correctness, window boundary,
 * and TokenBucket exhaustion / refill under load.
 *
 * Bead: bead-0381
 */

import { describe, expect, it } from 'vitest';

import { TenantId, UserId, ActionId } from '../../domain/primitives/index.js';
import type { RateLimitRuleV1, RateLimitScope } from '../../domain/rate-limiting/index.js';
import { InMemoryRateLimitStore } from './in-memory-rate-limit-store.js';
import {
  checkRateLimit,
  recordRateLimitedRequest,
} from '../../application/services/rate-limit-guard.js';
import { TokenBucketRateLimiter } from '../gateway/rate-limiter.js';

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

    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, scope),
      ),
    );

    expect(results.every((r) => !r.allowed)).toBe(true);
    expect(results.every((r) => !r.allowed && r.usage.window === 'PerHour')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Window boundary correctness
// ---------------------------------------------------------------------------

describe('rate-limit load: window boundary correctness', () => {
  it('allows a fresh burst immediately after the window resets', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('boundary-tenant') };
    const limit = 10;
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: limit,
    };
    store.setRules(scope, [rule]);

    for (let i = 0; i < limit; i++) {
      await store.recordRequest({ scope, window: 'PerMinute', nowIso: '2026-02-22T10:00:30.000Z' });
    }

    const endOfMinute = await checkRateLimit(
      { rateLimitStore: store, clock: () => '2026-02-22T10:00:59.000Z' },
      scope,
    );
    expect(endOfMinute.allowed).toBe(false);

    const startOfMinute1 = await checkRateLimit(
      { rateLimitStore: store, clock: () => '2026-02-22T10:01:00.000Z' },
      scope,
    );
    expect(startOfMinute1.allowed).toBe(true);
    expect(startOfMinute1.usage.requestCount).toBe(0);
  });

  it('per-day window resets at UTC midnight', async () => {
    const store = new InMemoryRateLimitStore();
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('daily-tenant') };
    const rule: RateLimitRuleV1 = {
      schemaVersion: 1,
      scope,
      window: 'PerDay',
      maxRequests: 100,
    };
    store.setRules(scope, [rule]);

    const dayOneIso = '2026-02-22T23:59:59.000Z';
    for (let i = 0; i < 100; i++) {
      await store.recordRequest({ scope, window: 'PerDay', nowIso: dayOneIso });
    }

    const endOfDay = await checkRateLimit({ rateLimitStore: store, clock: () => dayOneIso }, scope);
    expect(endOfDay.allowed).toBe(false);

    const startOfDay2 = await checkRateLimit(
      { rateLimitStore: store, clock: () => '2026-02-23T00:00:00.000Z' },
      scope,
    );
    expect(startOfDay2.allowed).toBe(true);
    expect(startOfDay2.usage.requestCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Token bucket load tests
// ---------------------------------------------------------------------------

describe('TokenBucketRateLimiter load: exhaustion and refill', () => {
  it('correctly exhausts a large bucket under rapid fire', () => {
    const maxTokens = 1000;
    const limiter = new TokenBucketRateLimiter({ maxTokens, refillRatePerSecond: 0 });

    let allowed = 0;
    let rejected = 0;

    for (let i = 0; i < maxTokens + 500; i++) {
      const r = limiter.tryConsume('ws-load');
      if (r.allowed) allowed++;
      else rejected++;
    }

    expect(allowed).toBe(maxTokens);
    expect(rejected).toBe(500);
  });

  it('isolates 50 workspaces under concurrent load', () => {
    const maxTokens = 10;
    const limiter = new TokenBucketRateLimiter({ maxTokens, refillRatePerSecond: 0 });
    const workspaceCount = 50;
    const requestsPerWorkspace = 15;

    for (let ws = 0; ws < workspaceCount; ws++) {
      let allowedForWs = 0;
      let rejectedForWs = 0;
      for (let r = 0; r < requestsPerWorkspace; r++) {
        if (limiter.tryConsume(`ws-${ws}`).allowed) allowedForWs++;
        else rejectedForWs++;
      }
      expect(allowedForWs).toBe(maxTokens);
      expect(rejectedForWs).toBe(requestsPerWorkspace - maxTokens);
    }
  });

  it('retryAfterSeconds is consistent for a zero-refill bucket', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillRatePerSecond: 2 });
    limiter.tryConsume('ws-1'); // exhaust

    const results = Array.from({ length: 20 }, () => limiter.tryConsume('ws-1'));
    const rejectedValues = results
      .filter((r): r is { allowed: false; retryAfterSeconds: number } => !r.allowed)
      .map((r) => r.retryAfterSeconds);

    expect(new Set(rejectedValues).size).toBe(1);
    expect(rejectedValues[0]).toBe(1);
  });

  it('refill allows a second burst after recovery period', () => {
    let nowMs = 0;
    const maxTokens = 5;
    const limiter = new TokenBucketRateLimiter({ maxTokens, refillRatePerSecond: 5 }, () => nowMs);

    for (let i = 0; i < maxTokens; i++) limiter.tryConsume('ws-refill');
    expect(limiter.tryConsume('ws-refill').allowed).toBe(false);

    nowMs += 1_000;
    for (let i = 0; i < maxTokens; i++) {
      expect(limiter.tryConsume('ws-refill').allowed).toBe(true);
    }
    expect(limiter.tryConsume('ws-refill').allowed).toBe(false);
  });

  it('UserAction scope limits are independent per action', async () => {
    const store = new InMemoryRateLimitStore();
    const userId = UserId('alice');
    const actionA: RateLimitScope = {
      kind: 'UserAction',
      userId,
      actionId: ActionId('start-workflow'),
    };
    const actionB: RateLimitScope = {
      kind: 'UserAction',
      userId,
      actionId: ActionId('approve-step'),
    };
    const limit = 3;
    const rule = (scope: RateLimitScope): RateLimitRuleV1 => ({
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests: limit,
    });

    store.setRules(actionA, [rule(actionA)]);
    store.setRules(actionB, [rule(actionB)]);

    const nowIso = '2026-02-22T10:00:05.000Z';
    for (let i = 0; i < limit; i++) {
      await store.recordRequest({ scope: actionA, window: 'PerMinute', nowIso });
    }

    const resultA = await checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, actionA);
    const resultB = await checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, actionB);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });
});

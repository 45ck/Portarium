/**
 * TokenBucketRateLimiter load tests (split from rate-limit-load.test.ts to stay within max-lines).
 * Bead: bead-0381
 */

import { describe, expect, it } from 'vitest';

import { ActionId, UserId } from '../../domain/primitives/index.js';
import type { RateLimitRuleV1, RateLimitScope } from '../../domain/rate-limiting/index.js';
import { checkRateLimit } from '../../application/services/rate-limit-guard.js';
import { TokenBucketRateLimiter } from '../gateway/rate-limiter.js';
import { InMemoryRateLimitStore } from './in-memory-rate-limit-store.js';

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

    // All should have the same retryAfterSeconds (1/refillRate rounded up = 1s)
    expect(new Set(rejectedValues).size).toBe(1);
    expect(rejectedValues[0]).toBe(1);
  });

  it('refill allows a second burst after recovery period', () => {
    let nowMs = 0;
    const maxTokens = 5;
    const limiter = new TokenBucketRateLimiter({ maxTokens, refillRatePerSecond: 5 }, () => nowMs);

    // Burst 1: drain all tokens
    for (let i = 0; i < maxTokens; i++) limiter.tryConsume('ws-refill');
    expect(limiter.tryConsume('ws-refill').allowed).toBe(false);

    // Advance 1 second: should have refilled to full
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

    // Exhaust action A
    for (let i = 0; i < limit; i++) {
      await store.recordRequest({ scope: actionA, window: 'PerMinute', nowIso });
    }

    const resultA = await checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, actionA);
    const resultB = await checkRateLimit({ rateLimitStore: store, clock: () => nowIso }, actionB);

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { TokenBucketRateLimiter } from './rate-limiter.js';

describe('TokenBucketRateLimiter', () => {
  it('allows requests within the token budget', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 3, refillRatePerSecond: 1 });
    expect(limiter.tryConsume('ws-1').allowed).toBe(true);
    expect(limiter.tryConsume('ws-1').allowed).toBe(true);
    expect(limiter.tryConsume('ws-1').allowed).toBe(true);
  });

  it('rejects when tokens are exhausted', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillRatePerSecond: 1 });
    expect(limiter.tryConsume('ws-1').allowed).toBe(true);
    const result = limiter.tryConsume('ws-1');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('isolates workspaces', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillRatePerSecond: 1 });
    expect(limiter.tryConsume('ws-1').allowed).toBe(true);
    // ws-2 is independent
    expect(limiter.tryConsume('ws-2').allowed).toBe(true);
  });

  it('refills tokens over time', () => {
    let nowMs = 1_000_000;
    const limiter = new TokenBucketRateLimiter(
      { maxTokens: 2, refillRatePerSecond: 1 },
      () => nowMs,
    );

    // Drain bucket
    limiter.tryConsume('ws-1');
    limiter.tryConsume('ws-1');
    expect(limiter.tryConsume('ws-1').allowed).toBe(false);

    // Advance 1 second -> 1 token refilled
    nowMs += 1_000;
    expect(limiter.tryConsume('ws-1').allowed).toBe(true);
    expect(limiter.tryConsume('ws-1').allowed).toBe(false);
  });

  it('does not exceed maxTokens after long idle', () => {
    let nowMs = 0;
    const limiter = new TokenBucketRateLimiter(
      { maxTokens: 5, refillRatePerSecond: 10 },
      () => nowMs,
    );

    // Drain all
    for (let i = 0; i < 5; i++) limiter.tryConsume('ws-1');
    expect(limiter.tryConsume('ws-1').allowed).toBe(false);

    // Advance 60 seconds -> should cap at maxTokens (5)
    nowMs += 60_000;
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume('ws-1').allowed).toBe(true);
    }
    expect(limiter.tryConsume('ws-1').allowed).toBe(false);
  });

  it('reset removes the workspace bucket', () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillRatePerSecond: 0 });
    limiter.tryConsume('ws-1');
    expect(limiter.tryConsume('ws-1').allowed).toBe(false);

    limiter.reset('ws-1');
    expect(limiter.tryConsume('ws-1').allowed).toBe(true);
  });
});

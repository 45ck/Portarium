/**
 * In-memory token-bucket rate limiter keyed by workspace ID.
 *
 * Each workspace gets an independent bucket that refills at a configurable
 * rate. When the bucket is empty the request is rejected with a retry-after
 * hint (seconds until the next token is available).
 */

export type RateLimiterConfig = Readonly<{
  /** Maximum tokens per workspace bucket. */
  maxTokens: number;
  /** Tokens added per second (refill rate). */
  refillRatePerSecond: number;
}>;

export type RateLimitResult =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; retryAfterSeconds: number }>;

type Bucket = {
  tokens: number;
  lastRefillTime: number;
};

export class TokenBucketRateLimiter {
  readonly #maxTokens: number;
  readonly #refillRatePerSecond: number;
  readonly #buckets = new Map<string, Bucket>();
  readonly #now: () => number;

  public constructor(config: RateLimiterConfig, now?: () => number) {
    this.#maxTokens = config.maxTokens;
    this.#refillRatePerSecond = config.refillRatePerSecond;
    this.#now = now ?? (() => Date.now());
  }

  public tryConsume(workspaceId: string): RateLimitResult {
    const nowMs = this.#now();
    const bucket = this.#getOrCreateBucket(workspaceId, nowMs);

    this.#refill(bucket, nowMs);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    const secondsUntilNextToken =
      this.#refillRatePerSecond > 0
        ? Math.ceil(1 / this.#refillRatePerSecond)
        : 1;

    return { allowed: false, retryAfterSeconds: secondsUntilNextToken };
  }

  public reset(workspaceId: string): void {
    this.#buckets.delete(workspaceId);
  }

  #getOrCreateBucket(workspaceId: string, nowMs: number): Bucket {
    let bucket = this.#buckets.get(workspaceId);
    if (!bucket) {
      bucket = { tokens: this.#maxTokens, lastRefillTime: nowMs };
      this.#buckets.set(workspaceId, bucket);
    }
    return bucket;
  }

  #refill(bucket: Bucket, nowMs: number): void {
    const elapsedMs = nowMs - bucket.lastRefillTime;
    if (elapsedMs <= 0) return;

    const tokensToAdd = (elapsedMs / 1_000) * this.#refillRatePerSecond;
    bucket.tokens = Math.min(this.#maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefillTime = nowMs;
  }
}

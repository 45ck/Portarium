import type { RateLimitStore } from '../../application/ports/rate-limit-store.js';
import type {
  RateLimitRuleV1,
  RateLimitScope,
  RateLimitUsageV1,
  RateLimitWindow,
} from '../../domain/rate-limiting/index.js';
import {
  computeWindowBoundaries,
  serializeRateLimitScope,
} from '../../domain/rate-limiting/index.js';

/**
 * Minimal Redis commands required by the rate-limit store.
 *
 * Both the real `ioredis` Redis instance and test fakes implement this.
 */
export interface RedisRateLimitClient {
  get(key: string): Promise<string | null>;
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
  scan(cursor: string, ...args: string[]): Promise<[string, string[]]>;
  del(...keys: string[]): Promise<number>;
}

const INCR_EXPIREAT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIREAT', KEYS[1], ARGV[1])
end
return count
`;

const KEY_PREFIX = 'portarium:rl:count:';

/**
 * Redis-backed implementation of RateLimitStore.
 *
 * Uses atomic INCR + EXPIREAT (via Lua script) for fixed-window rate limiting.
 * Counter keys are namespaced by scope, window, and window-start epoch second,
 * so they expire naturally at the end of each window.
 *
 * Fail-open: if Redis is unavailable, all operations return permissive defaults
 * and log a warning to stderr. This prevents a Redis outage from blocking traffic.
 *
 * Rules are configured at construction time (static, per deployment).
 */
export class RedisRateLimitStore implements RateLimitStore {
  readonly #client: RedisRateLimitClient;
  readonly #rules: ReadonlyMap<string, readonly RateLimitRuleV1[]>;

  public constructor(
    client: RedisRateLimitClient,
    rules?: ReadonlyMap<string, readonly RateLimitRuleV1[]>,
  ) {
    this.#client = client;
    this.#rules = rules ?? new Map();
  }

  public getRulesForScope(scope: RateLimitScope): Promise<readonly RateLimitRuleV1[]> {
    const key = serializeRateLimitScope(scope);
    return Promise.resolve(this.#rules.get(key) ?? []);
  }

  public async getUsage(params: {
    scope: RateLimitScope;
    window: RateLimitWindow;
  }): Promise<RateLimitUsageV1 | null> {
    const nowIso = new Date().toISOString();
    const boundaries = computeWindowBoundaries({ nowIso, window: params.window });
    const key = this.#countKey(params.scope, params.window, boundaries.windowStartedAtIso);

    try {
      const countStr = await this.#client.get(key);
      if (countStr === null) return null;

      const requestCount = parseInt(countStr, 10);
      if (!Number.isFinite(requestCount)) return null;

      return {
        scope: params.scope,
        window: params.window,
        requestCount,
        windowStartedAtIso: boundaries.windowStartedAtIso,
        windowResetsAtIso: boundaries.windowResetsAtIso,
      };
    } catch (err) {
      process.stderr.write(`[portarium] Redis rate-limit getUsage error (fail-open): ${err}\n`);
      return null;
    }
  }

  public async recordRequest(params: {
    scope: RateLimitScope;
    window: RateLimitWindow;
    nowIso: string;
  }): Promise<RateLimitUsageV1> {
    const boundaries = computeWindowBoundaries({ nowIso: params.nowIso, window: params.window });
    const windowResetEpoch = Math.floor(Date.parse(boundaries.windowResetsAtIso) / 1000);
    const key = this.#countKey(params.scope, params.window, boundaries.windowStartedAtIso);

    try {
      const result = await this.#client.eval(
        INCR_EXPIREAT_SCRIPT,
        1,
        key,
        String(windowResetEpoch),
      );
      const requestCount = typeof result === 'number' ? result : parseInt(String(result), 10);

      return {
        scope: params.scope,
        window: params.window,
        requestCount: Number.isFinite(requestCount) ? requestCount : 1,
        windowStartedAtIso: boundaries.windowStartedAtIso,
        windowResetsAtIso: boundaries.windowResetsAtIso,
      };
    } catch (err) {
      process.stderr.write(
        `[portarium] Redis rate-limit recordRequest error (fail-open): ${err}\n`,
      );
      return {
        scope: params.scope,
        window: params.window,
        requestCount: 1,
        windowStartedAtIso: boundaries.windowStartedAtIso,
        windowResetsAtIso: boundaries.windowResetsAtIso,
      };
    }
  }

  public async resetUsage(scope: RateLimitScope): Promise<void> {
    const scopeKey = serializeRateLimitScope(scope);
    const pattern = `${KEY_PREFIX}${scopeKey}:*`;
    let cursor = '0';

    try {
      do {
        const [nextCursor, keys] = await this.#client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100',
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.#client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      process.stderr.write(`[portarium] Redis rate-limit resetUsage error: ${err}\n`);
    }
  }

  #countKey(scope: RateLimitScope, window: RateLimitWindow, windowStartedAtIso: string): string {
    const scopeKey = serializeRateLimitScope(scope);
    const windowStartEpoch = Math.floor(Date.parse(windowStartedAtIso) / 1000);
    return `${KEY_PREFIX}${scopeKey}:${window}:${windowStartEpoch}`;
  }
}

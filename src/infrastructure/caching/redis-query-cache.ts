import type { QueryCache } from '../../application/ports/query-cache.js';

/**
 * Minimal Redis commands required by the query cache.
 *
 * Both the real `ioredis` Redis instance and test fakes implement this.
 */
export interface RedisQueryCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiry: 'EX', ttlSeconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  scan(cursor: string, ...args: string[]): Promise<[string, string[]]>;
}

const KEY_PREFIX = 'portarium:qc:';

/**
 * Redis-backed implementation of QueryCache.
 *
 * Uses Redis strings with EX TTL for key expiration.
 * Values are JSON-serialized before storage and deserialized on retrieval.
 *
 * Fail-open: if Redis is unavailable, cache misses are returned and writes
 * are silently dropped. This prevents a Redis outage from blocking traffic.
 */
export class RedisQueryCache implements QueryCache {
  readonly #client: RedisQueryCacheClient;

  public constructor(client: RedisQueryCacheClient) {
    this.#client = client;
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.#client.get(KEY_PREFIX + key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      process.stderr.write(`[portarium] Redis query cache get error (fail-open): ${err}\n`);
      return null;
    }
  }

  public async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.#client.set(KEY_PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      process.stderr.write(`[portarium] Redis query cache set error (fail-open): ${err}\n`);
    }
  }

  public async invalidate(key: string): Promise<void> {
    try {
      await this.#client.del(KEY_PREFIX + key);
    } catch (err) {
      process.stderr.write(`[portarium] Redis query cache invalidate error: ${err}\n`);
    }
  }

  public async invalidatePrefix(prefix: string): Promise<void> {
    const pattern = `${KEY_PREFIX}${prefix}*`;
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
      process.stderr.write(`[portarium] Redis query cache invalidatePrefix error: ${err}\n`);
    }
  }
}

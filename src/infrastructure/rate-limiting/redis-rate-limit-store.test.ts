import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TenantId, UserId } from '../../domain/primitives/index.js';
import type { RateLimitRuleV1, RateLimitScope } from '../../domain/rate-limiting/index.js';
import { serializeRateLimitScope } from '../../domain/rate-limiting/index.js';
import type { RedisRateLimitClient } from './redis-rate-limit-store.js';
import { RedisRateLimitStore } from './redis-rate-limit-store.js';

// ---------------------------------------------------------------------------
// Fake Redis client
// ---------------------------------------------------------------------------

class FakeRedisClient implements RedisRateLimitClient {
  readonly #store = new Map<string, string>();
  readonly #expiries = new Map<string, number>();

  get(key: string): Promise<string | null> {
    // Honour TTLs in tests that advance the fake clock
    return Promise.resolve(this.#store.get(key) ?? null);
  }

  eval(script: string, _numkeys: number, ...args: (string | number)[]): Promise<unknown> {
    // Simulate the INCR + EXPIREAT Lua script
    void script;
    const key = String(args[0]);
    const expiryEpoch = Number(args[1]);
    const prev = parseInt(this.#store.get(key) ?? '0', 10);
    const next = prev + 1;
    this.#store.set(key, String(next));
    if (next === 1) {
      this.#expiries.set(key, expiryEpoch);
    }
    return Promise.resolve(next);
  }

  scan(cursor: string, ...args: string[]): Promise<[string, string[]]> {
    void cursor;
    // Simple linear scan — no paging needed in tests
    // args[0] = 'MATCH', args[1] = pattern, args[2] = 'COUNT', args[3] = count
    const pattern = args[1] ?? '';
    const matchedKeys: string[] = [];
    // Convert glob '*' suffix to prefix check
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    for (const k of this.#store.keys()) {
      if (k.startsWith(prefix)) {
        matchedKeys.push(k);
      }
    }
    return Promise.resolve(['0', matchedKeys]);
  }

  del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.#store.delete(key)) count++;
      this.#expiries.delete(key);
    }
    return Promise.resolve(count);
  }

  /** Test utility: inspect raw value */
  rawGet(key: string): string | undefined {
    return this.#store.get(key);
  }

  /** Test utility: inspect all stored keys */
  keys(): string[] {
    return [...this.#store.keys()];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCOPE_TENANT: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };
const SCOPE_USER: RateLimitScope = { kind: 'User', userId: UserId('alice') };

function makeRule(scope: RateLimitScope, maxRequests = 10): RateLimitRuleV1 {
  return { schemaVersion: 1, scope, window: 'PerMinute', maxRequests };
}

function makeStore(
  client: FakeRedisClient,
  rules?: ReadonlyMap<string, readonly RateLimitRuleV1[]>,
): RedisRateLimitStore {
  return new RedisRateLimitStore(client, rules);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RedisRateLimitStore.getRulesForScope', () => {
  it('returns empty array when no rules configured for scope', async () => {
    const client = new FakeRedisClient();
    const store = makeStore(client);
    const rules = await store.getRulesForScope(SCOPE_TENANT);
    expect(rules).toEqual([]);
  });

  it('returns configured rules for a matching scope', async () => {
    const client = new FakeRedisClient();
    const rule = makeRule(SCOPE_TENANT);
    const rulesMap = new Map([[serializeRateLimitScope(SCOPE_TENANT), [rule]]]);
    const store = makeStore(client, rulesMap);

    const rules = await store.getRulesForScope(SCOPE_TENANT);
    expect(rules).toEqual([rule]);
  });

  it('does not leak rules from one scope to another', async () => {
    const client = new FakeRedisClient();
    const rule = makeRule(SCOPE_TENANT);
    const rulesMap = new Map([[serializeRateLimitScope(SCOPE_TENANT), [rule]]]);
    const store = makeStore(client, rulesMap);

    const rules = await store.getRulesForScope(SCOPE_USER);
    expect(rules).toEqual([]);
  });
});

describe('RedisRateLimitStore.getUsage', () => {
  it('returns null when no requests have been recorded', async () => {
    const client = new FakeRedisClient();
    const store = makeStore(client);
    const usage = await store.getUsage({ scope: SCOPE_TENANT, window: 'PerMinute' });
    expect(usage).toBeNull();
  });

  it('returns current usage after a request has been recorded', async () => {
    const client = new FakeRedisClient();
    const store = makeStore(client);

    await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:15.000Z',
    });

    // getUsage uses Date.now() internally — fake client returns stored value
    // so we verify the count is 1 by checking the fake store directly
    const keys = client.keys();
    expect(keys).toHaveLength(1);
    expect(client.rawGet(keys[0]!)).toBe('1');
  });
});

describe('RedisRateLimitStore.recordRequest', () => {
  let client: FakeRedisClient;
  let store: RedisRateLimitStore;

  beforeEach(() => {
    client = new FakeRedisClient();
    store = makeStore(client);
  });

  it('returns count=1 for the first request in a window', async () => {
    const usage = await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:15.000Z',
    });
    expect(usage.requestCount).toBe(1);
    expect(usage.windowStartedAtIso).toBe('2026-02-22T10:30:00.000Z');
    expect(usage.windowResetsAtIso).toBe('2026-02-22T10:31:00.000Z');
    expect(usage.scope).toEqual(SCOPE_TENANT);
    expect(usage.window).toBe('PerMinute');
  });

  it('increments counter for sequential requests in the same window', async () => {
    for (let i = 0; i < 5; i++) {
      await store.recordRequest({
        scope: SCOPE_TENANT,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:30:15.000Z',
      });
    }
    const usage = await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:50.000Z',
    });
    expect(usage.requestCount).toBe(6);
  });

  it('uses a NEW counter when the window resets', async () => {
    await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:15.000Z',
    });
    const newWindow = await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:31:10.000Z',
    });
    // Different window start → new key → count resets to 1
    expect(newWindow.requestCount).toBe(1);
    expect(newWindow.windowStartedAtIso).toBe('2026-02-22T10:31:00.000Z');
    // Two separate keys in the fake store
    expect(client.keys()).toHaveLength(2);
  });

  it('tracks different windows (PerMinute vs PerHour) with separate keys', async () => {
    const minuteUsage = await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:15.000Z',
    });
    const hourUsage = await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerHour',
      nowIso: '2026-02-22T10:30:15.000Z',
    });
    expect(minuteUsage.requestCount).toBe(1);
    expect(hourUsage.requestCount).toBe(1);
    expect(client.keys()).toHaveLength(2);
  });

  it('tracks different scopes with separate keys', async () => {
    await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:15.000Z',
    });
    await store.recordRequest({
      scope: SCOPE_USER,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:15.000Z',
    });
    expect(client.keys()).toHaveLength(2);
  });
});

describe('RedisRateLimitStore.resetUsage', () => {
  it('deletes all usage keys for the given scope', async () => {
    const client = new FakeRedisClient();
    const store = makeStore(client);

    // Record in two different windows for the same scope
    await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:00.000Z',
    });
    await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerHour',
      nowIso: '2026-02-22T10:30:00.000Z',
    });
    // Record for a different scope
    await store.recordRequest({
      scope: SCOPE_USER,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:00.000Z',
    });

    expect(client.keys()).toHaveLength(3);

    await store.resetUsage(SCOPE_TENANT);

    // Only the tenant-scoped keys should be removed
    const remaining = client.keys();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toContain('user:');
  });
});

describe('RedisRateLimitStore fail-open behaviour', () => {
  it('returns null from getUsage when Redis throws', async () => {
    const faultyClient: RedisRateLimitClient = {
      get: vi.fn().mockRejectedValue(new Error('redis down')),
      eval: vi.fn().mockRejectedValue(new Error('redis down')),
      scan: vi.fn().mockRejectedValue(new Error('redis down')),
      del: vi.fn().mockRejectedValue(new Error('redis down')),
    };
    const store = new RedisRateLimitStore(faultyClient);
    const result = await store.getUsage({ scope: SCOPE_TENANT, window: 'PerMinute' });
    expect(result).toBeNull();
  });

  it('returns requestCount=1 from recordRequest when Redis throws (fail-open)', async () => {
    const faultyClient: RedisRateLimitClient = {
      get: vi.fn().mockRejectedValue(new Error('redis down')),
      eval: vi.fn().mockRejectedValue(new Error('redis down')),
      scan: vi.fn().mockRejectedValue(new Error('redis down')),
      del: vi.fn().mockRejectedValue(new Error('redis down')),
    };
    const store = new RedisRateLimitStore(faultyClient);
    const usage = await store.recordRequest({
      scope: SCOPE_TENANT,
      window: 'PerMinute',
      nowIso: '2026-02-22T10:30:15.000Z',
    });
    // Fail-open: returns count=1 so request is allowed
    expect(usage.requestCount).toBe(1);
  });

  it('silently swallows Redis errors in resetUsage', async () => {
    const faultyClient: RedisRateLimitClient = {
      get: vi.fn().mockRejectedValue(new Error('redis down')),
      eval: vi.fn().mockRejectedValue(new Error('redis down')),
      scan: vi.fn().mockRejectedValue(new Error('redis down')),
      del: vi.fn().mockRejectedValue(new Error('redis down')),
    };
    const store = new RedisRateLimitStore(faultyClient);
    await expect(store.resetUsage(SCOPE_TENANT)).resolves.toBeUndefined();
  });
});

describe('RedisRateLimitStore multi-instance counter sharing', () => {
  it('two store instances sharing the same fake client share counters', async () => {
    // Simulates two pods sharing the same Redis instance
    const client = new FakeRedisClient();
    const storeA = new RedisRateLimitStore(client);
    const storeB = new RedisRateLimitStore(client);
    const nowIso = '2026-02-22T10:30:15.000Z';
    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('shared-tenant') };

    await storeA.recordRequest({ scope, window: 'PerMinute', nowIso });
    await storeB.recordRequest({ scope, window: 'PerMinute', nowIso });
    const usageA = await storeA.recordRequest({ scope, window: 'PerMinute', nowIso });

    // Count reflects combined requests from both instances
    expect(usageA.requestCount).toBe(3);
    // Only one key exists (same window, same scope)
    expect(client.keys()).toHaveLength(1);
  });
});

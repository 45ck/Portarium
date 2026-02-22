import { describe, expect, it } from 'vitest';

import { TenantId, UserId, ActionId } from '../../domain/primitives/index.js';
import type {
  RateLimitRuleV1,
  RateLimitUsageV1,
  RateLimitScope,
} from '../../domain/rate-limiting/index.js';
import type { RateLimitStore } from '../ports/rate-limit-store.js';
import { checkRateLimit, recordRateLimitedRequest } from './rate-limit-guard.js';

type TestStore = RateLimitStore & {
  _setRules: (scope: RateLimitScope, rules: RateLimitRuleV1[]) => void;
};

function createInMemoryStore(): TestStore {
  const rules = new Map<string, RateLimitRuleV1[]>();
  const usage = new Map<string, RateLimitUsageV1>();

  const serializeScope = (scope: RateLimitScope): string => {
    switch (scope.kind) {
      case 'Tenant':
        return `tenant:${scope.tenantId}`;
      case 'User':
        return `user:${scope.userId}`;
      case 'TenantAction':
        return `tenant-action:${scope.tenantId}:${scope.actionId}`;
      case 'UserAction':
        return `user-action:${scope.userId}:${scope.actionId}`;
    }
  };

  const serializeUsageKey = (scope: RateLimitScope, window: string): string => {
    return `${serializeScope(scope)}:${window}`;
  };

  return {
    async getRulesForScope(scope) {
      return rules.get(serializeScope(scope)) ?? [];
    },
    async getUsage(params) {
      return usage.get(serializeUsageKey(params.scope, params.window)) ?? null;
    },
    async recordRequest(params) {
      const key = serializeUsageKey(params.scope, params.window);
      const existing = usage.get(key);
      const nowMs = Date.parse(params.nowIso);

      // Compute window boundaries
      let windowStartMs: number;
      let windowEndMs: number;

      if (params.window === 'PerMinute') {
        windowStartMs = nowMs - (nowMs % 60_000);
        windowEndMs = windowStartMs + 60_000;
      } else if (params.window === 'PerHour') {
        windowStartMs = nowMs - (nowMs % 3_600_000);
        windowEndMs = windowStartMs + 3_600_000;
      } else {
        // PerDay
        const now = new Date(nowMs);
        windowStartMs = Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0,
          0,
        );
        windowEndMs = windowStartMs + 86_400_000;
      }

      const windowStartedAtIso = new Date(windowStartMs).toISOString();
      const windowResetsAtIso = new Date(windowEndMs).toISOString();

      if (existing?.windowStartedAtIso !== windowStartedAtIso) {
        // New window
        const newUsage: RateLimitUsageV1 = {
          scope: params.scope,
          window: params.window,
          requestCount: 1,
          windowStartedAtIso,
          windowResetsAtIso,
        };
        usage.set(key, newUsage);
        return newUsage;
      }

      // Increment existing
      const updated: RateLimitUsageV1 = {
        ...existing,
        requestCount: existing.requestCount + 1,
      };
      usage.set(key, updated);
      return updated;
    },
    async resetUsage(scope) {
      for (const key of usage.keys()) {
        if (key.startsWith(serializeScope(scope))) {
          usage.delete(key);
        }
      }
    },
    _setRules(scope: RateLimitScope, scopeRules: RateLimitRuleV1[]) {
      rules.set(serializeScope(scope), scopeRules);
    },
  } as TestStore;
}

describe('rate-limit-guard', () => {
  describe('checkRateLimit', () => {
    it('allows requests when no rules are configured', async () => {
      const store = createInMemoryStore();
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };

      const result = await checkRateLimit({ rateLimitStore: store }, scope);

      expect(result.allowed).toBe(true);
    });

    it('allows requests under the limit', async () => {
      const store = createInMemoryStore();
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerMinute',
        maxRequests: 10,
      };

      store._setRules(scope, [rule]);

      // Record 5 requests
      for (let i = 0; i < 5; i++) {
        await store.recordRequest({
          scope,
          window: 'PerMinute',
          nowIso: '2026-02-22T10:00:30.000Z',
        });
      }

      const result = await checkRateLimit(
        {
          rateLimitStore: store,
          clock: () => '2026-02-22T10:00:35.000Z',
        },
        scope,
      );

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.usage.requestCount).toBe(5);
      }
    });

    it('rejects requests over the limit', async () => {
      const store = createInMemoryStore();
      const scope: RateLimitScope = { kind: 'User', userId: UserId('alice') };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerMinute',
        maxRequests: 3,
      };

      store._setRules(scope, [rule]);

      // Record 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        await store.recordRequest({
          scope,
          window: 'PerMinute',
          nowIso: '2026-02-22T10:00:10.000Z',
        });
      }

      const result = await checkRateLimit(
        {
          rateLimitStore: store,
          clock: () => '2026-02-22T10:00:20.000Z',
        },
        scope,
      );

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('RateLimitExceeded');
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
        expect(result.usage.requestCount).toBe(3);
      }
    });

    it('allows burst traffic with burstAllowance', async () => {
      const store = createInMemoryStore();
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerMinute',
        maxRequests: 10,
        burstAllowance: 5, // Can handle up to 15 total
      };

      store._setRules(scope, [rule]);

      // Record 12 requests (over base limit, under burst limit)
      for (let i = 0; i < 12; i++) {
        await store.recordRequest({
          scope,
          window: 'PerMinute',
          nowIso: '2026-02-22T10:00:10.000Z',
        });
      }

      const result = await checkRateLimit(
        {
          rateLimitStore: store,
          clock: () => '2026-02-22T10:00:20.000Z',
        },
        scope,
      );

      expect(result.allowed).toBe(true);
    });

    it('resets usage when window expires', async () => {
      const store = createInMemoryStore();
      const scope: RateLimitScope = { kind: 'User', userId: UserId('bob') };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerMinute',
        maxRequests: 5,
      };

      store._setRules(scope, [rule]);

      // Record 5 requests in minute 1
      for (let i = 0; i < 5; i++) {
        await store.recordRequest({
          scope,
          window: 'PerMinute',
          nowIso: '2026-02-22T10:00:30.000Z',
        });
      }

      // Check in minute 2 (new window)
      const result = await checkRateLimit(
        {
          rateLimitStore: store,
          clock: () => '2026-02-22T10:01:10.000Z',
        },
        scope,
      );

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.usage.requestCount).toBe(0); // Reset for new window
      }
    });

    it('enforces per-day limits', async () => {
      const store = createInMemoryStore();
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerDay',
        maxRequests: 1000,
      };

      store._setRules(scope, [rule]);

      // Record 1000 requests
      for (let i = 0; i < 1000; i++) {
        await store.recordRequest({
          scope,
          window: 'PerDay',
          nowIso: '2026-02-22T10:00:00.000Z',
        });
      }

      const result = await checkRateLimit(
        {
          rateLimitStore: store,
          clock: () => '2026-02-22T15:30:00.000Z',
        },
        scope,
      );

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.retryAfterSeconds).toBeGreaterThan(3600); // At least 1 hour until next day
      }
    });

    it('enforces UserAction scope limits', async () => {
      const store = createInMemoryStore();
      const scope: RateLimitScope = {
        kind: 'UserAction',
        userId: UserId('alice'),
        actionId: ActionId('start-workflow'),
      };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerMinute',
        maxRequests: 2,
      };

      store._setRules(scope, [rule]);

      // Record 2 requests
      for (let i = 0; i < 2; i++) {
        await store.recordRequest({
          scope,
          window: 'PerMinute',
          nowIso: '2026-02-22T10:00:10.000Z',
        });
      }

      const result = await checkRateLimit(
        {
          rateLimitStore: store,
          clock: () => '2026-02-22T10:00:20.000Z',
        },
        scope,
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('recordRateLimitedRequest', () => {
    it('records a request and returns updated usage', async () => {
      const store = createInMemoryStore();
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerMinute',
        maxRequests: 10,
      };

      const usage = await recordRateLimitedRequest(
        {
          rateLimitStore: store,
          clock: () => '2026-02-22T10:00:30.000Z',
        },
        scope,
        rule,
      );

      expect(usage.requestCount).toBe(1);
      expect(usage.scope).toEqual(scope);
      expect(usage.window).toBe('PerMinute');
    });
  });
});

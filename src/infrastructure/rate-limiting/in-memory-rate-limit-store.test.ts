import { describe, expect, it, beforeEach } from 'vitest';

import { TenantId, UserId } from '../../domain/primitives/index.js';
import type { RateLimitRuleV1, RateLimitScope } from '../../domain/rate-limiting/index.js';
import { InMemoryRateLimitStore } from './in-memory-rate-limit-store.js';

describe('InMemoryRateLimitStore', () => {
  let store: InMemoryRateLimitStore;

  beforeEach(() => {
    store = new InMemoryRateLimitStore();
  });

  describe('getRulesForScope', () => {
    it('returns empty array when no rules configured', async () => {
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };
      const rules = await store.getRulesForScope(scope);
      expect(rules).toEqual([]);
    });

    it('returns configured rules for a scope', async () => {
      const scope: RateLimitScope = { kind: 'User', userId: UserId('alice') };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerMinute',
        maxRequests: 10,
      };

      store.setRules(scope, [rule]);

      const rules = await store.getRulesForScope(scope);
      expect(rules).toEqual([rule]);
    });
  });

  describe('getUsage', () => {
    it('returns null when no usage recorded', async () => {
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };
      const usage = await store.getUsage({ scope, window: 'PerMinute' });
      expect(usage).toBeNull();
    });
  });

  describe('recordRequest', () => {
    it('records first request in a window', async () => {
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };
      const usage = await store.recordRequest({
        scope,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:30:15.000Z',
      });

      expect(usage.requestCount).toBe(1);
      expect(usage.windowStartedAtIso).toBe('2026-02-22T10:30:00.000Z');
      expect(usage.windowResetsAtIso).toBe('2026-02-22T10:31:00.000Z');
    });

    it('increments count for subsequent requests in same window', async () => {
      const scope: RateLimitScope = { kind: 'User', userId: UserId('bob') };

      await store.recordRequest({
        scope,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:30:15.000Z',
      });

      const usage2 = await store.recordRequest({
        scope,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:30:45.000Z',
      });

      expect(usage2.requestCount).toBe(2);
    });

    it('resets count when window expires', async () => {
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };

      await store.recordRequest({
        scope,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:30:15.000Z',
      });

      const usage2 = await store.recordRequest({
        scope,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:31:10.000Z', // New minute
      });

      expect(usage2.requestCount).toBe(1);
      expect(usage2.windowStartedAtIso).toBe('2026-02-22T10:31:00.000Z');
    });

    it('tracks different windows independently', async () => {
      const scope: RateLimitScope = { kind: 'User', userId: UserId('alice') };

      await store.recordRequest({
        scope,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:30:15.000Z',
      });

      await store.recordRequest({
        scope,
        window: 'PerHour',
        nowIso: '2026-02-22T10:30:20.000Z',
      });

      const minuteUsage = await store.getUsage({ scope, window: 'PerMinute' });
      const hourUsage = await store.getUsage({ scope, window: 'PerHour' });

      expect(minuteUsage?.requestCount).toBe(1);
      expect(hourUsage?.requestCount).toBe(1);
    });
  });

  describe('resetUsage', () => {
    it('clears all usage for a scope', async () => {
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme') };

      await store.recordRequest({
        scope,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:30:15.000Z',
      });

      await store.recordRequest({
        scope,
        window: 'PerHour',
        nowIso: '2026-02-22T10:30:20.000Z',
      });

      await store.resetUsage(scope);

      const minuteUsage = await store.getUsage({ scope, window: 'PerMinute' });
      const hourUsage = await store.getUsage({ scope, window: 'PerHour' });

      expect(minuteUsage).toBeNull();
      expect(hourUsage).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes all rules and usage', async () => {
      const scope: RateLimitScope = { kind: 'User', userId: UserId('alice') };
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope,
        window: 'PerMinute',
        maxRequests: 10,
      };

      store.setRules(scope, [rule]);
      await store.recordRequest({
        scope,
        window: 'PerMinute',
        nowIso: '2026-02-22T10:30:15.000Z',
      });

      store.clear();

      const rules = await store.getRulesForScope(scope);
      const usage = await store.getUsage({ scope, window: 'PerMinute' });

      expect(rules).toEqual([]);
      expect(usage).toBeNull();
    });
  });
});

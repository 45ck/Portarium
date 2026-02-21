import { describe, expect, it } from 'vitest';

import { ActionId, TenantId, UserId } from '../primitives/index.js';
import {
  computeWindowBoundaries,
  serializeRateLimitScope,
  type RateLimitRuleV1,
  type RateLimitScope,
} from './rate-limit-rule-v1.js';

describe('RateLimitRuleV1', () => {
  describe('serializeRateLimitScope', () => {
    it('serializes Tenant scope', () => {
      const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId('acme-corp') };
      expect(serializeRateLimitScope(scope)).toBe('tenant:acme-corp');
    });

    it('serializes User scope', () => {
      const scope: RateLimitScope = { kind: 'User', userId: UserId('alice') };
      expect(serializeRateLimitScope(scope)).toBe('user:alice');
    });

    it('serializes TenantAction scope', () => {
      const scope: RateLimitScope = {
        kind: 'TenantAction',
        tenantId: TenantId('acme-corp'),
        actionId: ActionId('start-workflow'),
      };
      expect(serializeRateLimitScope(scope)).toBe('tenant-action:acme-corp:start-workflow');
    });

    it('serializes UserAction scope', () => {
      const scope: RateLimitScope = {
        kind: 'UserAction',
        userId: UserId('alice'),
        actionId: ActionId('start-workflow'),
      };
      expect(serializeRateLimitScope(scope)).toBe('user-action:alice:start-workflow');
    });
  });

  describe('computeWindowBoundaries', () => {
    it('computes PerMinute boundaries', () => {
      const nowIso = '2026-02-22T10:45:37.123Z';
      const result = computeWindowBoundaries({ nowIso, window: 'PerMinute' });

      expect(result.windowStartedAtIso).toBe('2026-02-22T10:45:00.000Z');
      expect(result.windowResetsAtIso).toBe('2026-02-22T10:46:00.000Z');
    });

    it('computes PerHour boundaries', () => {
      const nowIso = '2026-02-22T10:45:37.123Z';
      const result = computeWindowBoundaries({ nowIso, window: 'PerHour' });

      expect(result.windowStartedAtIso).toBe('2026-02-22T10:00:00.000Z');
      expect(result.windowResetsAtIso).toBe('2026-02-22T11:00:00.000Z');
    });

    it('computes PerDay boundaries', () => {
      const nowIso = '2026-02-22T10:45:37.123Z';
      const result = computeWindowBoundaries({ nowIso, window: 'PerDay' });

      expect(result.windowStartedAtIso).toBe('2026-02-22T00:00:00.000Z');
      expect(result.windowResetsAtIso).toBe('2026-02-23T00:00:00.000Z');
    });

    it('handles day boundary correctly', () => {
      const nowIso = '2026-02-22T23:59:59.999Z';
      const result = computeWindowBoundaries({ nowIso, window: 'PerDay' });

      expect(result.windowStartedAtIso).toBe('2026-02-22T00:00:00.000Z');
      expect(result.windowResetsAtIso).toBe('2026-02-23T00:00:00.000Z');
    });
  });

  describe('RateLimitRuleV1 type', () => {
    it('accepts valid Tenant rule', () => {
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope: { kind: 'Tenant', tenantId: TenantId('acme-corp') },
        window: 'PerHour',
        maxRequests: 1000,
      };

      expect(rule.schemaVersion).toBe(1);
      expect(rule.maxRequests).toBe(1000);
    });

    it('accepts rule with burst allowance', () => {
      const rule: RateLimitRuleV1 = {
        schemaVersion: 1,
        scope: { kind: 'User', userId: UserId('alice') },
        window: 'PerMinute',
        maxRequests: 60,
        burstAllowance: 10,
      };

      expect(rule.burstAllowance).toBe(10);
    });
  });
});

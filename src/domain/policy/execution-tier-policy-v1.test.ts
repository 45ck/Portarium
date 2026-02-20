import { describe, expect, it } from 'vitest';

import { WorkspaceId } from '../primitives/index.js';
import {
  ENVIRONMENT_TIER_DEFAULTS,
  evaluateExecutionTierPolicy,
  validateTierOverride,
  type TierOverrideV1,
} from './execution-tier-policy-v1.js';

describe('evaluateExecutionTierPolicy', () => {
  describe('dev environment', () => {
    it('allows Auto tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'Auto',
        environmentTier: 'dev',
      });
      expect(result.decision).toBe('Allow');
      expect(result.enforcement).toBe('logged');
    });

    it('allows Assisted tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'Assisted',
        environmentTier: 'dev',
      });
      expect(result.decision).toBe('Allow');
    });

    it('allows HumanApprove tier in dev (below ManualOnly threshold)', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'HumanApprove',
        environmentTier: 'dev',
      });
      expect(result.decision).toBe('Allow');
    });

    it('denies ManualOnly tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'ManualOnly',
        environmentTier: 'dev',
      });
      expect(result.decision).toBe('Deny');
    });
  });

  describe('staging environment', () => {
    it('allows Auto tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'Auto',
        environmentTier: 'staging',
      });
      expect(result.decision).toBe('Allow');
    });

    it('allows Assisted tier in staging (below HumanApprove threshold)', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'Assisted',
        environmentTier: 'staging',
      });
      expect(result.decision).toBe('Allow');
    });

    it('requires approval for HumanApprove tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'HumanApprove',
        environmentTier: 'staging',
      });
      expect(result.decision).toBe('RequireApproval');
      expect(result.enforcement).toBe('strict');
    });

    it('denies ManualOnly tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'ManualOnly',
        environmentTier: 'staging',
      });
      expect(result.decision).toBe('Deny');
    });
  });

  describe('prod environment', () => {
    it('allows Auto tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'Auto',
        environmentTier: 'prod',
      });
      expect(result.decision).toBe('Allow');
    });

    it('requires approval for Assisted tier in prod', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'Assisted',
        environmentTier: 'prod',
      });
      expect(result.decision).toBe('RequireApproval');
      expect(result.enforcement).toBe('strict');
    });

    it('requires approval for HumanApprove tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'HumanApprove',
        environmentTier: 'prod',
      });
      expect(result.decision).toBe('RequireApproval');
    });

    it('denies ManualOnly tier', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'ManualOnly',
        environmentTier: 'prod',
      });
      expect(result.decision).toBe('Deny');
    });
  });

  describe('tier override', () => {
    const override: TierOverrideV1 = {
      workspaceId: WorkspaceId('ws-1'),
      originalTier: 'HumanApprove',
      overriddenTier: 'Auto',
      authorizedBy: 'user-admin',
      overriddenAtIso: '2026-02-21T00:00:00.000Z',
      reason: 'Emergency hotfix deployment',
    };

    it('uses overridden tier when override is provided', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'HumanApprove',
        environmentTier: 'prod',
        override,
      });
      expect(result.decision).toBe('Allow');
      expect(result.overrideApplied).toBe(true);
    });

    it('marks overrideApplied false when no override', () => {
      const result = evaluateExecutionTierPolicy({
        executionTier: 'Auto',
        environmentTier: 'prod',
      });
      expect(result.overrideApplied).toBe(false);
    });
  });
});

describe('validateTierOverride', () => {
  it('allows override in dev', () => {
    expect(validateTierOverride({ environmentTier: 'dev' })).toBe(true);
  });

  it('allows override in staging', () => {
    expect(validateTierOverride({ environmentTier: 'staging' })).toBe(true);
  });

  it('disallows override in prod', () => {
    expect(validateTierOverride({ environmentTier: 'prod' })).toBe(false);
  });
});

describe('ENVIRONMENT_TIER_DEFAULTS', () => {
  it('has expected dev defaults', () => {
    const dev = ENVIRONMENT_TIER_DEFAULTS.dev;
    expect(dev.enforcement).toBe('logged');
    expect(dev.allowOverride).toBe(true);
  });

  it('has expected prod defaults', () => {
    const prod = ENVIRONMENT_TIER_DEFAULTS.prod;
    expect(prod.enforcement).toBe('strict');
    expect(prod.allowOverride).toBe(false);
  });
});

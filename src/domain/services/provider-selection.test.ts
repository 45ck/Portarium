import { describe, expect, it } from 'vitest';

import type { AdapterRegistrationV1 } from '../adapters/adapter-registration-v1.js';
import { AdapterId, WorkspaceId, type PortFamily } from '../primitives/index.js';

import { selectProvider } from './provider-selection.js';

const makeAdapter = (
  overrides: Partial<{
    adapterId: string;
    portFamily: string;
    enabled: boolean;
    operations: string[];
  }> = {},
): AdapterRegistrationV1 => ({
  schemaVersion: 1,
  adapterId: AdapterId(overrides.adapterId ?? 'adapter-1'),
  workspaceId: WorkspaceId('ws-1'),
  providerSlug: 'test-provider',
  portFamily: (overrides.portFamily ?? 'FinanceAccounting') as PortFamily,
  enabled: overrides.enabled ?? true,
  capabilityMatrix: (overrides.operations ?? ['account:read']).map((op) => ({
    operation: op,
    requiresAuth: false,
  })),
});

describe('selectProvider', () => {
  it('returns no_matching_adapter when no adapters match portFamily', () => {
    const adapters = [makeAdapter({ portFamily: 'CrmSales' })];
    const result = selectProvider({
      adapters,
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result).toEqual({ ok: false, reason: 'no_matching_adapter' });
  });

  it('returns no_enabled_adapter when matching adapters are all disabled', () => {
    const adapters = [makeAdapter({ enabled: false })];
    const result = selectProvider({
      adapters,
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result).toEqual({ ok: false, reason: 'no_enabled_adapter' });
  });

  it('returns no_capable_adapter when no adapter has the operation', () => {
    const adapters = [makeAdapter({ operations: ['invoice:list'] })];
    const result = selectProvider({
      adapters,
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result).toEqual({ ok: false, reason: 'no_capable_adapter' });
  });

  it('returns ok with single capable adapter', () => {
    const adapter = makeAdapter();
    const result = selectProvider({
      adapters: [adapter],
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result).toEqual({ ok: true, adapter, alternativeCount: 0 });
  });

  it('returns ok with first adapter (sorted by adapterId) when multiple capable', () => {
    const adapterB = makeAdapter({ adapterId: 'beta-adapter' });
    const adapterA = makeAdapter({ adapterId: 'alpha-adapter' });
    const result = selectProvider({
      adapters: [adapterB, adapterA],
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.adapter.adapterId).toBe('alpha-adapter');
    }
  });

  it('returns correct alternativeCount', () => {
    const adapters = [
      makeAdapter({ adapterId: 'a1' }),
      makeAdapter({ adapterId: 'a2' }),
      makeAdapter({ adapterId: 'a3' }),
    ];
    const result = selectProvider({
      adapters,
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alternativeCount).toBe(2);
    }
  });

  it('handles empty adapters array', () => {
    const result = selectProvider({
      adapters: [],
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result).toEqual({ ok: false, reason: 'no_matching_adapter' });
  });

  it('ignores adapters with different portFamily', () => {
    const adapters = [
      makeAdapter({ adapterId: 'crm-1', portFamily: 'CrmSales' }),
      makeAdapter({ adapterId: 'fin-1', portFamily: 'FinanceAccounting' }),
    ];
    const result = selectProvider({
      adapters,
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.adapter.adapterId).toBe('fin-1');
      expect(result.alternativeCount).toBe(0);
    }
  });
});

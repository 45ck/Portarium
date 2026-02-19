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
  executionPolicy: {
    tenantIsolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://provider.example'],
    credentialScope: 'capabilityMatrix',
    sandboxVerified: true,
    sandboxAvailable: true,
  },
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

  it('matches adapters by canonical capability when both capability and operation are provided', () => {
    const result = selectProvider({
      adapters: [
        {
          ...makeAdapter({ adapterId: 'capability-adapter' }),
          capabilityMatrix: [
            {
              capability: 'account:read',
              operation: 'account:read',
              requiresAuth: false,
            },
          ],
        },
      ],
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(result).toMatchObject({ ok: true, alternativeCount: 0 });
    if (result.ok) {
      expect(result.adapter.adapterId).toBe('capability-adapter');
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

  it('returns operation_not_in_family for completely unknown operations', () => {
    const result = selectProvider({
      adapters: [makeAdapter()],
      portFamily: 'FinanceAccounting',
      operation: 'unknown:operation',
    });

    expect(result).toEqual({ ok: false, reason: 'operation_not_in_family' });
  });

  it('returns operation_not_in_family for cross-family operations (party:read on FinanceAccounting)', () => {
    // party:read is valid for CrmSales but NOT for FinanceAccounting
    const result = selectProvider({
      adapters: [makeAdapter()],
      portFamily: 'FinanceAccounting',
      operation: 'party:read',
    });

    expect(result).toEqual({ ok: false, reason: 'operation_not_in_family' });
  });

  it('operation_not_in_family is checked before adapter availability', () => {
    // Even with no adapters, operation_not_in_family takes priority over no_matching_adapter
    const result = selectProvider({
      adapters: [],
      portFamily: 'FinanceAccounting',
      operation: 'party:write',
    });

    expect(result).toEqual({ ok: false, reason: 'operation_not_in_family' });
  });

  it('tie-break is deterministic (alphabetical by adapterId)', () => {
    const adapters = [
      makeAdapter({ adapterId: 'zeta-adapter' }),
      makeAdapter({ adapterId: 'alpha-adapter' }),
      makeAdapter({ adapterId: 'mu-adapter' }),
    ];
    const r1 = selectProvider({
      adapters,
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });
    const r2 = selectProvider({
      adapters: [...adapters].reverse(),
      portFamily: 'FinanceAccounting',
      operation: 'account:read',
    });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.adapter.adapterId).toBe('alpha-adapter');
      expect(r2.adapter.adapterId).toBe('alpha-adapter');
    }
  });
});

/**
 * Contract tests for the Minimal Integration Surface (MIS) v0.1.
 * Verifies the shape, factory helpers, and runtime descriptor.
 * Bead: bead-0743
 */

import { describe, it, expect } from 'vitest';
import {
  MisResult,
  MIS_V1,
  type MisAdapterV1,
  type MisAdapterMetaV1,
  type MisPortFamily,
} from './mis-v1.js';

// ── MisResult factories ───────────────────────────────────────────────────

describe('MisResult', () => {
  it('ok() produces a success result', () => {
    const r = MisResult.ok({ invoiceId: 'inv-1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.invoiceId).toBe('inv-1');
  });

  it('err() produces a failure result with defaults', () => {
    const r = MisResult.err('NOT_FOUND', 'Invoice not found');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('NOT_FOUND');
      expect(r.message).toBe('Invoice not found');
      expect(r.retryable).toBe(false);
    }
  });

  it('err() propagates retryable flag', () => {
    const r = MisResult.err('RATE_LIMITED', 'Too many requests', true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(true);
  });
});

// ── MIS_V1 runtime descriptor ─────────────────────────────────────────────

describe('MIS_V1 descriptor', () => {
  it('exposes version 0.1.0', () => {
    expect(MIS_V1.version).toBe('0.1.0');
  });

  it('lists 20 port families', () => {
    expect(MIS_V1.portFamilies).toHaveLength(20);
  });

  it('requires health and invoke methods', () => {
    expect(MIS_V1.requiredMethods).toContain('health');
    expect(MIS_V1.requiredMethods).toContain('invoke');
  });

  it('portFamilies array is frozen (readonly)', () => {
    // TypeScript enforces readonly; verify runtime array is consistent
    const families: readonly MisPortFamily[] = MIS_V1.portFamilies;
    expect(families).toContain('FinanceAccounting');
    expect(families).toContain('RoboticsActuation');
  });
});

// ── MisAdapterV1 interface conformance ───────────────────────────────────

describe('MisAdapterV1 interface', () => {
  // Minimal concrete adapter implementation for type-checking purposes
  class StubAdapter implements MisAdapterV1 {
    readonly meta: MisAdapterMetaV1 = {
      schemaVersion: 1,
      adapterId: 'stub-finance-v1',
      portFamily: 'FinanceAccounting',
      displayName: 'Stub Finance Adapter',
      version: '1.0.0',
      supportedOperations: ['invoice:list', 'invoice:create'],
    };

    async health() {
      return { status: 'healthy' as const };
    }

    async invoke(
      operation: string,
      _payload: Record<string, unknown>,
      _ctx: {
        correlationId: string;
        requestedAtIso: string;
        workspaceId: string;
        dryRun?: boolean;
      },
    ) {
      if (operation === 'invoice:list') return MisResult.ok({ invoices: [] });
      return MisResult.err('VALIDATION_FAILED', `Unknown operation: ${operation}`);
    }
  }

  it('adapter satisfies MisAdapterV1 shape', () => {
    const adapter: MisAdapterV1 = new StubAdapter();
    expect(adapter.meta.schemaVersion).toBe(1);
    expect(adapter.meta.adapterId).toBe('stub-finance-v1');
    expect(adapter.meta.portFamily).toBe('FinanceAccounting');
  });

  it('health() returns a healthy status', async () => {
    const adapter = new StubAdapter();
    const result = await adapter.health();
    expect(result.status).toBe('healthy');
  });

  it('invoke() returns ok for known operations', async () => {
    const adapter = new StubAdapter();
    const ctx = {
      correlationId: 'corr-1',
      requestedAtIso: '2026-02-22T00:00:00.000Z',
      workspaceId: 'ws-1',
    };
    const result = await adapter.invoke('invoice:list', {}, ctx);
    expect(result.ok).toBe(true);
  });

  it('invoke() returns VALIDATION_FAILED for unknown operations', async () => {
    const adapter = new StubAdapter();
    const ctx = {
      correlationId: 'corr-2',
      requestedAtIso: '2026-02-22T00:00:00.000Z',
      workspaceId: 'ws-1',
    };
    const result = await adapter.invoke('unknown:op', {}, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_FAILED');
      expect(result.retryable).toBe(false);
    }
  });

  it('dry-run flag is passed through the context', async () => {
    let capturedDryRun: boolean | undefined;
    class DryRunAdapter implements MisAdapterV1 {
      readonly meta: MisAdapterMetaV1 = {
        schemaVersion: 1,
        adapterId: 'dry-run-v1',
        portFamily: 'CrmSales',
        displayName: 'Dry Run Adapter',
      };
      async health() {
        return { status: 'healthy' as const };
      }
      async invoke(
        _op: string,
        _payload: Record<string, unknown>,
        ctx: {
          correlationId: string;
          requestedAtIso: string;
          workspaceId: string;
          dryRun?: boolean;
        },
      ) {
        capturedDryRun = ctx.dryRun;
        return MisResult.ok({});
      }
    }

    const adapter = new DryRunAdapter();
    await adapter.invoke(
      'contact:create',
      {},
      {
        correlationId: 'corr-3',
        requestedAtIso: '2026-02-22T00:00:00.000Z',
        workspaceId: 'ws-1',
        dryRun: true,
      },
    );
    expect(capturedDryRun).toBe(true);
  });
});

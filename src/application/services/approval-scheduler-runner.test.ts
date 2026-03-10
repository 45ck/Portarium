import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApprovalId,
  CorrelationId,
  PlanId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { ApprovalPendingV1, EscalationStepV1 } from '../../domain/approvals/index.js';
import type { ApprovalQueryStore } from '../ports/approval-store.js';
import {
  resetSchedulerState,
  type ApprovalExpirySchedulerDeps,
  type SchedulerContext,
} from './approval-expiry-scheduler.js';
import { startApprovalScheduler, type SchedulerHandle } from './approval-scheduler-runner.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeChain(): readonly EscalationStepV1[] {
  return [{ stepOrder: 1, escalateToUserId: 'user-mgr', afterHours: 2 }];
}

function makePendingApproval(): ApprovalPendingV1 {
  return {
    schemaVersion: 1,
    approvalId: ApprovalId('appr-run'),
    workspaceId: WorkspaceId('ws-1'),
    runId: RunId('run-1'),
    planId: PlanId('plan-1'),
    prompt: 'Test',
    requestedAtIso: '2026-03-10T08:00:00.000Z',
    requestedByUserId: UserId('user-req'),
    status: 'Pending',
    escalationChain: makeChain(),
  };
}

function makeCtx(): SchedulerContext {
  return {
    tenantId: WorkspaceId('ws-1'),
    workspaceId: WorkspaceId('ws-1'),
    correlationId: CorrelationId('corr-runner'),
  };
}

function makeDeps(items: ApprovalPendingV1[]): ApprovalExpirySchedulerDeps {
  const store: ApprovalQueryStore = {
    listApprovals: vi.fn(async () => ({ items })),
  };
  return {
    approvalQueryStore: store,
    clock: { nowIso: vi.fn(() => '2026-03-10T11:00:00.000Z') },
    idGenerator: { generateId: vi.fn(() => `evt-${String(Math.random())}`) },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  resetSchedulerState();
});

afterEach(() => {
  vi.useRealTimers();
  resetSchedulerState();
});

describe('startApprovalScheduler', () => {
  let handle: SchedulerHandle;

  afterEach(() => {
    handle?.stop();
  });

  it('calls evaluatePendingApprovals periodically', async () => {
    const deps = makeDeps([]);
    const onSweep = vi.fn();
    handle = startApprovalScheduler(deps, makeCtx(), 100, onSweep);

    // Advance past two intervals
    await vi.advanceTimersByTimeAsync(250);

    expect(onSweep).toHaveBeenCalledTimes(2);
  });

  it('stop() prevents further sweeps', async () => {
    const deps = makeDeps([]);
    const onSweep = vi.fn();
    handle = startApprovalScheduler(deps, makeCtx(), 100, onSweep);

    await vi.advanceTimersByTimeAsync(150);
    expect(onSweep).toHaveBeenCalledTimes(1);

    handle.stop();

    await vi.advanceTimersByTimeAsync(300);
    // Should still be 1 — no further calls after stop
    expect(onSweep).toHaveBeenCalledTimes(1);
  });

  it('stop() is idempotent', () => {
    const deps = makeDeps([]);
    handle = startApprovalScheduler(deps, makeCtx(), 100);

    expect(() => {
      handle.stop();
      handle.stop();
    }).not.toThrow();
  });

  it('invokes onSweep callback with results containing escalation actions', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval]);
    const onSweep = vi.fn();
    handle = startApprovalScheduler(deps, makeCtx(), 100, onSweep);

    await vi.advanceTimersByTimeAsync(150);

    expect(onSweep).toHaveBeenCalledTimes(1);
    const result = onSweep.mock.calls[0]![0];
    expect(result.evaluated).toBe(1);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('continues running after sweep failure', async () => {
    const deps = makeDeps([]);
    // Make the first call reject, subsequent calls succeed
    const listApprovals = deps.approvalQueryStore.listApprovals as ReturnType<typeof vi.fn>;
    listApprovals
      .mockRejectedValueOnce(new Error('transient DB failure'))
      .mockResolvedValue({ items: [] });

    const onSweep = vi.fn();
    const onError = vi.fn();
    handle = startApprovalScheduler(deps, makeCtx(), 100, onSweep, onError);

    // First sweep fails
    await vi.advanceTimersByTimeAsync(150);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(onSweep).toHaveBeenCalledTimes(0);

    // Second sweep succeeds — scheduler recovered
    await vi.advanceTimersByTimeAsync(100);
    expect(onSweep).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('skips overlapping sweeps', async () => {
    const deps = makeDeps([]);
    // Make listApprovals take longer than the interval to resolve
    let resolveFirst!: (value: { items: never[] }) => void;
    const slowPromise = new Promise<{ items: never[] }>((resolve) => {
      resolveFirst = resolve;
    });
    const listApprovals = deps.approvalQueryStore.listApprovals as ReturnType<typeof vi.fn>;
    listApprovals.mockReturnValueOnce(slowPromise).mockResolvedValue({ items: [] });

    const onSweep = vi.fn();
    handle = startApprovalScheduler(deps, makeCtx(), 100, onSweep);

    // First interval fires — starts slow sweep
    await vi.advanceTimersByTimeAsync(150);
    expect(listApprovals).toHaveBeenCalledTimes(1);

    // Second interval fires — should be skipped (first sweep still in progress)
    await vi.advanceTimersByTimeAsync(100);
    // listApprovals was NOT called again because the guard prevented overlap
    expect(listApprovals).toHaveBeenCalledTimes(1);

    // Resolve the slow first sweep
    resolveFirst({ items: [] });
    await vi.advanceTimersByTimeAsync(0); // flush microtasks

    expect(onSweep).toHaveBeenCalledTimes(1);

    // Next interval — should fire normally now that the guard is released
    await vi.advanceTimersByTimeAsync(100);
    expect(listApprovals).toHaveBeenCalledTimes(2);
    expect(onSweep).toHaveBeenCalledTimes(2);
  });
});

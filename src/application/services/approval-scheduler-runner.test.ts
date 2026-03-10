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
import { resetSchedulerState, type ApprovalExpirySchedulerDeps, type SchedulerContext } from './approval-expiry-scheduler.js';
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
});

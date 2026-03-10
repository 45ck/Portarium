import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApprovalId,
  CorrelationId,
  EvidenceId,
  HashSha256,
  PlanId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { ApprovalPendingV1, EscalationStepV1 } from '../../domain/approvals/index.js';
import type { ApprovalQueryStore, ApprovalStore } from '../../application/ports/approval-store.js';
import type { EventPublisher } from '../../application/ports/event-publisher.js';
import type { EvidenceLogPort } from '../../application/ports/evidence-log.js';
import type { SweepExpiredApprovalsDeps } from '../../application/commands/sweep-expired-approvals.js';
import { resetSchedulerState } from '../../application/services/approval-expiry-scheduler.js';
import {
  createApprovalExpiryScheduler,
  type InfraApprovalExpirySchedulerOptions,
} from './approval-expiry-scheduler.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeChain(): readonly EscalationStepV1[] {
  return [{ stepOrder: 1, escalateToUserId: 'user-mgr', afterHours: 2 }];
}

function makePendingApproval(): ApprovalPendingV1 {
  return {
    schemaVersion: 1,
    approvalId: ApprovalId('appr-scheduler'),
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

function makeDeps(items: ApprovalPendingV1[]): SweepExpiredApprovalsDeps {
  const queryStore: ApprovalQueryStore = {
    listApprovals: vi.fn(async () => ({ items })),
  };

  const store: ApprovalStore = {
    getApprovalById: vi.fn(async (_t, _w, approvalId) => {
      return items.find((a) => a.approvalId === approvalId) ?? null;
    }),
    saveApproval: vi.fn(async () => {}),
  };

  const eventPublisher: EventPublisher = {
    publish: vi.fn(async () => {}),
  };

  const evidenceLog: EvidenceLogPort = {
    appendEntry: vi.fn(async () => ({
      schemaVersion: 1 as const,
      evidenceId: EvidenceId('ev-1'),
      workspaceId: WorkspaceId('ws-1'),
      correlationId: CorrelationId('corr-1'),
      occurredAtIso: '2026-03-10T11:00:00.000Z',
      category: 'System' as const,
      summary: '',
      actor: { kind: 'System' as const },
      links: {},
      previousHash: HashSha256('hash-prev'),
      hashSha256: HashSha256('hash-curr'),
    })),
  };

  return {
    approvalStore: store,
    approvalQueryStore: queryStore,
    clock: { nowIso: vi.fn(() => '2026-03-10T11:00:00.000Z') },
    idGenerator: { generateId: vi.fn(() => `evt-${String(Math.random())}`) },
    eventPublisher,
    evidenceLog,
  };
}

function makeOptions(
  items: ApprovalPendingV1[] = [],
  overrides: Partial<InfraApprovalExpirySchedulerOptions> = {},
): InfraApprovalExpirySchedulerOptions {
  return {
    deps: makeDeps(items),
    config: {
      workspaceId: 'ws-1',
      intervalMs: 100,
    },
    ...overrides,
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

describe('createApprovalExpiryScheduler', () => {
  it('starts and isRunning returns true', () => {
    const scheduler = createApprovalExpiryScheduler(makeOptions());
    expect(scheduler.isRunning()).toBe(false);

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
  });

  it('stop() sets isRunning to false', () => {
    const scheduler = createApprovalExpiryScheduler(makeOptions());
    scheduler.start();
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('stop() is idempotent', () => {
    const scheduler = createApprovalExpiryScheduler(makeOptions());
    scheduler.start();

    expect(() => {
      scheduler.stop();
      scheduler.stop();
    }).not.toThrow();

    expect(scheduler.isRunning()).toBe(false);
  });

  it('start() is idempotent (does not create duplicate intervals)', async () => {
    const onSweep = vi.fn();
    const scheduler = createApprovalExpiryScheduler(makeOptions([], { onSweep }));

    scheduler.start();
    scheduler.start(); // second start should be a no-op

    await vi.advanceTimersByTimeAsync(250);

    // Should have ~2 sweeps (at 100ms and 200ms), not 4
    expect(onSweep.mock.calls.length).toBeLessThanOrEqual(3);

    scheduler.stop();
  });

  it('calls onSweep callback periodically', async () => {
    const onSweep = vi.fn();
    const scheduler = createApprovalExpiryScheduler(makeOptions([], { onSweep }));

    scheduler.start();
    await vi.advanceTimersByTimeAsync(250);

    expect(onSweep).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('invokes onSweep with results containing counts', async () => {
    const approval = makePendingApproval();
    const onSweep = vi.fn();
    const scheduler = createApprovalExpiryScheduler(makeOptions([approval], { onSweep }));

    scheduler.start();
    await vi.advanceTimersByTimeAsync(150);

    expect(onSweep).toHaveBeenCalledTimes(1);
    const result = onSweep.mock.calls[0]![0];
    expect(result.evaluated).toBe(1);
    expect(typeof result.escalatedCount).toBe('number');

    scheduler.stop();
  });

  it('stop() prevents further sweeps', async () => {
    const onSweep = vi.fn();
    const scheduler = createApprovalExpiryScheduler(makeOptions([], { onSweep }));

    scheduler.start();
    await vi.advanceTimersByTimeAsync(150);
    expect(onSweep).toHaveBeenCalledTimes(1);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(300);
    expect(onSweep).toHaveBeenCalledTimes(1);
  });

  it('calls onError when sweep throws', async () => {
    const onError = vi.fn();
    const failingDeps = makeDeps([]);
    (failingDeps.approvalQueryStore.listApprovals as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Store failure'),
    );

    const scheduler = createApprovalExpiryScheduler({
      deps: failingDeps,
      config: { workspaceId: 'ws-1', intervalMs: 100 },
      onError,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(150);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);

    scheduler.stop();
  });
});

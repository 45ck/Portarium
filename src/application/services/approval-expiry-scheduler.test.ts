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
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import {
  evaluatePendingApprovals,
  resetSchedulerState,
  EXPIRY_GRACE_HOURS,
  type ApprovalExpirySchedulerDeps,
  type SchedulerContext,
} from './approval-expiry-scheduler.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEscalationChain(): readonly EscalationStepV1[] {
  return [
    { stepOrder: 1, escalateToUserId: 'user-mgr', afterHours: 2 },
    { stepOrder: 2, escalateToUserId: 'user-dir', afterHours: 6 },
  ];
}

function makePendingApproval(overrides: Partial<ApprovalPendingV1> = {}): ApprovalPendingV1 {
  return {
    schemaVersion: 1,
    approvalId: ApprovalId('appr-1'),
    workspaceId: WorkspaceId('ws-1'),
    runId: RunId('run-1'),
    planId: PlanId('plan-1'),
    prompt: 'Approve deployment',
    requestedAtIso: '2026-03-10T08:00:00.000Z',
    requestedByUserId: UserId('user-req'),
    status: 'Pending',
    escalationChain: makeEscalationChain(),
    ...overrides,
  };
}

function makeCtx(): SchedulerContext {
  return {
    tenantId: WorkspaceId('ws-1'),
    workspaceId: WorkspaceId('ws-1'),
    correlationId: CorrelationId('corr-scheduler'),
  };
}

let idCounter = 0;

function makeIdGenerator(): IdGenerator {
  return { generateId: vi.fn(() => `evt-${String(++idCounter)}`) };
}

function makeClock(iso: string): Clock {
  return { nowIso: vi.fn(() => iso) };
}

function makeQueryStore(items: ApprovalPendingV1[]): ApprovalQueryStore {
  return {
    listApprovals: vi.fn(async () => ({ items })),
  };
}

function makeDeps(items: ApprovalPendingV1[], nowIso: string): ApprovalExpirySchedulerDeps {
  return {
    approvalQueryStore: makeQueryStore(items),
    clock: makeClock(nowIso),
    idGenerator: makeIdGenerator(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  idCounter = 0;
  resetSchedulerState();
});

afterEach(() => {
  resetSchedulerState();
});

describe('evaluatePendingApprovals — no escalation', () => {
  it('returns no actions for approvals without escalation chains', async () => {
    const { escalationChain: _, ...withoutChain } = makePendingApproval();
    const approval: ApprovalPendingV1 = withoutChain;
    const deps = makeDeps([approval], '2026-03-10T12:00:00.000Z');
    const result = await evaluatePendingApprovals(deps, makeCtx());

    expect(result.evaluated).toBe(1);
    expect(result.actions).toHaveLength(0);
  });

  it('returns no actions for approvals with empty escalation chains', async () => {
    const approval = makePendingApproval({ escalationChain: [] });
    const deps = makeDeps([approval], '2026-03-10T12:00:00.000Z');
    const result = await evaluatePendingApprovals(deps, makeCtx());

    expect(result.evaluated).toBe(1);
    expect(result.actions).toHaveLength(0);
  });

  it('returns no actions when no approvals are pending', async () => {
    const deps = makeDeps([], '2026-03-10T12:00:00.000Z');
    const result = await evaluatePendingApprovals(deps, makeCtx());

    expect(result.evaluated).toBe(0);
    expect(result.actions).toHaveLength(0);
  });
});

describe('evaluatePendingApprovals — escalation detection', () => {
  it('emits ApprovalEscalated when first step is reached', async () => {
    const approval = makePendingApproval();
    // 3 hours after request => step 1 (afterHours=2) should be active
    const deps = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    const result = await evaluatePendingApprovals(deps, makeCtx());

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]!.kind).toBe('escalated');
    expect(result.actions[0]!.event.eventType).toBe('ApprovalEscalated');

    const payload = result.actions[0]!.event.payload as Record<string, unknown>;
    expect(payload['stepIndex']).toBe(0);
    expect(payload['escalateToUserId']).toBe('user-mgr');
  });

  it('emits ApprovalEscalated for step 2 when time advances', async () => {
    const approval = makePendingApproval();

    // First sweep at 3h => step 0 detected
    const deps1 = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    await evaluatePendingApprovals(deps1, makeCtx());

    // Second sweep at 7h => step 1 detected (afterHours=6)
    const deps2 = makeDeps([approval], '2026-03-10T15:00:00.000Z');
    const result = await evaluatePendingApprovals(deps2, makeCtx());

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]!.kind).toBe('escalated');

    const payload = result.actions[0]!.event.payload as Record<string, unknown>;
    expect(payload['stepIndex']).toBe(1);
    expect(payload['escalateToUserId']).toBe('user-dir');
  });

  it('does not re-emit for the same escalation step (idempotency)', async () => {
    const approval = makePendingApproval();

    // First sweep at 3h => step 0
    const deps1 = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    const r1 = await evaluatePendingApprovals(deps1, makeCtx());
    expect(r1.actions).toHaveLength(1);

    // Second sweep still at 3h => no new actions
    const deps2 = makeDeps([approval], '2026-03-10T11:30:00.000Z');
    const r2 = await evaluatePendingApprovals(deps2, makeCtx());
    expect(r2.actions).toHaveLength(0);
  });

  it('does not emit when time is before first escalation step', async () => {
    const approval = makePendingApproval();
    // Only 1h after request, first step is at afterHours=2
    const deps = makeDeps([approval], '2026-03-10T09:00:00.000Z');
    const result = await evaluatePendingApprovals(deps, makeCtx());

    expect(result.actions).toHaveLength(0);
  });
});

describe('evaluatePendingApprovals — expiry detection', () => {
  it('emits ApprovalExpired when past final deadline + grace period', async () => {
    const approval = makePendingApproval();
    // Chain: step1 at 2h, step2 at 6h. Grace = 4h. Expiry at 10h.
    // 11h after request => expired
    const deps = makeDeps([approval], '2026-03-10T19:00:00.000Z');
    const result = await evaluatePendingApprovals(deps, makeCtx());

    const expiredActions = result.actions.filter((a) => a.kind === 'expired');
    expect(expiredActions).toHaveLength(1);
    expect(expiredActions[0]!.event.eventType).toBe('ApprovalExpired');

    const payload = expiredActions[0]!.event.payload as Record<string, unknown>;
    expect(payload['approvalId']).toBe('appr-1');
    expect(payload['reason']).toContain(String(EXPIRY_GRACE_HOURS));
  });

  it('does not expire when within grace period after final escalation', async () => {
    const approval = makePendingApproval();
    // 8h after request: fully escalated (past 6h) but within 4h grace => not expired
    // First sweep to register escalation state
    const deps1 = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    await evaluatePendingApprovals(deps1, makeCtx());

    // Now at 8h - within grace
    resetSchedulerState(); // reset so we can check cleanly
    const deps2 = makeDeps([approval], '2026-03-10T16:00:00.000Z');
    const result = await evaluatePendingApprovals(deps2, makeCtx());

    const expiredActions = result.actions.filter((a) => a.kind === 'expired');
    expect(expiredActions).toHaveLength(0);
  });
});

describe('evaluatePendingApprovals — multiple approvals', () => {
  it('handles multiple approvals independently', async () => {
    const a1 = makePendingApproval({ approvalId: ApprovalId('appr-1') });
    const a2 = makePendingApproval({
      approvalId: ApprovalId('appr-2'),
      requestedAtIso: '2026-03-10T06:00:00.000Z',
    });

    // At 11:00 UTC:
    //   a1 (requested 08:00): 3h elapsed => step 0 (afterHours=2)
    //   a2 (requested 06:00): 5h elapsed => step 0 (afterHours=2)
    const deps = makeDeps([a1, a2], '2026-03-10T11:00:00.000Z');
    const result = await evaluatePendingApprovals(deps, makeCtx());

    expect(result.evaluated).toBe(2);
    expect(result.actions).toHaveLength(2);
    expect(result.actions.every((a) => a.kind === 'escalated')).toBe(true);
  });
});

describe('evaluatePendingApprovals — domain event shape', () => {
  it('produces well-formed DomainEventV1 for escalation', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    const ctx = makeCtx();
    const result = await evaluatePendingApprovals(deps, ctx);

    const event = result.actions[0]!.event;
    expect(event.schemaVersion).toBe(1);
    expect(event.eventType).toBe('ApprovalEscalated');
    expect(event.aggregateKind).toBe('Approval');
    expect(event.aggregateId).toBe('appr-1');
    expect(event.workspaceId).toBe(ctx.workspaceId);
    expect(event.correlationId).toBe(ctx.correlationId);
    expect(typeof event.eventId).toBe('string');
    expect(event.occurredAtIso).toBe('2026-03-10T11:00:00.000Z');
  });
});

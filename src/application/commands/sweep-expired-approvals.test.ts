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
import type { ApprovalQueryStore, ApprovalStore } from '../ports/approval-store.js';
import type { EventPublisher } from '../ports/index.js';
import type { EvidenceLogPort } from '../ports/evidence-log.js';
import { resetSchedulerState } from '../services/approval-expiry-scheduler.js';
import {
  sweepExpiredApprovals,
  type SweepExpiredApprovalsDeps,
} from './sweep-expired-approvals.js';

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

let idCounter = 0;

function makeDeps(
  items: ApprovalPendingV1[],
  nowIso: string,
): SweepExpiredApprovalsDeps & {
  mocks: {
    eventPublisher: ReturnType<typeof vi.fn>;
    evidenceLog: ReturnType<typeof vi.fn>;
    saveApproval: ReturnType<typeof vi.fn>;
  };
} {
  const saveApproval = vi.fn(async () => {});
  const publishMock = vi.fn(async () => {});
  const appendEntry = vi.fn(async () => ({
    schemaVersion: 1 as const,
    evidenceId: EvidenceId('ev-1'),
    workspaceId: WorkspaceId('ws-1'),
    correlationId: CorrelationId('corr-1'),
    occurredAtIso: nowIso,
    category: 'System' as const,
    summary: '',
    actor: { kind: 'System' as const },
    links: {},
    previousHash: HashSha256('hash-prev'),
    hashSha256: HashSha256('hash-curr'),
  }));

  const queryStore: ApprovalQueryStore = {
    listApprovals: vi.fn(async () => ({ items })),
  };

  const store: ApprovalStore = {
    getApprovalById: vi.fn(async (_t, _w, approvalId) => {
      return items.find((a) => a.approvalId === approvalId) ?? null;
    }),
    saveApproval,
  };

  const eventPublisher: EventPublisher = {
    publish: publishMock,
  };

  const evidenceLog: EvidenceLogPort = {
    appendEntry,
  };

  return {
    approvalStore: store,
    approvalQueryStore: queryStore,
    clock: { nowIso: vi.fn(() => nowIso) },
    idGenerator: { generateId: vi.fn(() => `id-${String(++idCounter)}`) },
    eventPublisher,
    evidenceLog,
    mocks: {
      eventPublisher: publishMock,
      evidenceLog: appendEntry,
      saveApproval,
    },
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

describe('sweepExpiredApprovals', () => {
  it('returns zero counts when no approvals are pending', async () => {
    const deps = makeDeps([], '2026-03-10T12:00:00.000Z');
    const result = await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.evaluated).toBe(0);
    expect(result.expiredCount).toBe(0);
    expect(result.escalatedCount).toBe(0);
  });

  it('does not expire approvals within grace period', async () => {
    const approval = makePendingApproval();
    // 8h after request: fully escalated (past 6h) but within 4h grace
    const deps = makeDeps([approval], '2026-03-10T16:00:00.000Z');
    const result = await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.expiredCount).toBe(0);
  });

  it('expires approvals past final deadline + grace period', async () => {
    const approval = makePendingApproval();
    // Chain: step1 at 2h, step2 at 6h. Grace = 4h. Expiry at 10h.
    // 11h after request => expired
    const deps = makeDeps([approval], '2026-03-10T19:00:00.000Z');
    const result = await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.expiredCount).toBe(1);
  });

  it('publishes CloudEvent for expired approval', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T19:00:00.000Z');
    await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(deps.mocks.eventPublisher).toHaveBeenCalled();
    const publishedEvent = deps.mocks.eventPublisher.mock.calls[0]![0];
    expect(publishedEvent.type).toContain('ApprovalExpired');
  });

  it('creates evidence audit entry for expired approval', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T19:00:00.000Z');
    await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(deps.mocks.evidenceLog).toHaveBeenCalled();
    const evidenceCall = deps.mocks.evidenceLog.mock.calls.find((c: unknown[]) => {
      const entry = c[1] as Record<string, unknown>;
      const summary = entry['summary'];
      return typeof summary === 'string' && summary.includes('expired');
    });
    expect(evidenceCall).toBeDefined();
  });

  it('saves expired approval to store with Denied status', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T19:00:00.000Z');
    await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(deps.mocks.saveApproval).toHaveBeenCalled();
    const savedApproval = deps.mocks.saveApproval.mock.calls[0]![1];
    expect(savedApproval.status).toBe('Denied');
    expect(savedApproval.rationale).toContain('grace period');
  });

  it('detects escalation and publishes CloudEvent', async () => {
    const approval = makePendingApproval();
    // 3h after request => step 0 (afterHours=2) is active
    const deps = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    const result = await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.escalatedCount).toBe(1);
    expect(deps.mocks.eventPublisher).toHaveBeenCalled();
  });

  it('creates evidence audit entry for escalation', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(deps.mocks.evidenceLog).toHaveBeenCalled();
    const evidenceCall = deps.mocks.evidenceLog.mock.calls.find((c: unknown[]) => {
      const entry = c[1] as Record<string, unknown>;
      const summary = entry['summary'];
      return typeof summary === 'string' && summary.includes('escalated');
    });
    expect(evidenceCall).toBeDefined();
  });

  it('skips approvals without escalation chains', async () => {
    const { escalationChain: _, ...withoutChain } = makePendingApproval();
    const approval: ApprovalPendingV1 = withoutChain;
    const deps = makeDeps([approval], '2026-03-10T19:00:00.000Z');
    const result = await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.evaluated).toBe(1);
    expect(result.expiredCount).toBe(0);
    expect(result.escalatedCount).toBe(0);
  });

  it('works without evidence log (optional dependency)', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T19:00:00.000Z');
    // Remove evidence log
    const { evidenceLog: _, ...depsWithoutLog } = deps;
    const result = await sweepExpiredApprovals(depsWithoutLog, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.expiredCount).toBe(1);
    // Should not throw even without evidence log
  });

  it('handles multiple approvals independently', async () => {
    const a1 = makePendingApproval({ approvalId: ApprovalId('appr-1') });
    const a2 = makePendingApproval({
      approvalId: ApprovalId('appr-2'),
      requestedAtIso: '2026-03-10T06:00:00.000Z', // 13h elapsed at 19:00 => expired
    });

    const deps = makeDeps([a1, a2], '2026-03-10T19:00:00.000Z');
    const result = await sweepExpiredApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.evaluated).toBe(2);
    expect(result.expiredCount).toBe(2);
  });
});

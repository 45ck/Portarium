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
import type { ApprovalQueryStore } from '../ports/approval-store.js';
import type { EvidenceLogPort } from '../ports/evidence-log.js';
import {
  resetEscalationAuditState,
  getEscalationAuditStateSize,
  sweepEscalationApprovals,
  type SweepEscalationDeps,
} from './sweep-escalation-approvals.js';

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
    approvalId: ApprovalId('appr-esc-1'),
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
): SweepEscalationDeps & { mocks: { evidenceLog: ReturnType<typeof vi.fn> } } {
  const appendEntry = vi.fn(async () => ({
    schemaVersion: 1 as const,
    evidenceId: EvidenceId('ev-1'),
    workspaceId: WorkspaceId('ws-1'),
    correlationId: CorrelationId('corr-1'),
    occurredAtIso: nowIso,
    category: 'Approval' as const,
    summary: '',
    actor: { kind: 'System' as const },
    links: {},
    previousHash: HashSha256('hash-prev'),
    hashSha256: HashSha256('hash-curr'),
  }));

  const queryStore: ApprovalQueryStore = {
    listApprovals: vi.fn(async () => ({ items })),
  };

  const evidenceLog: EvidenceLogPort = {
    appendEntry,
  };

  return {
    approvalQueryStore: queryStore,
    clock: { nowIso: vi.fn(() => nowIso) },
    idGenerator: { generateId: vi.fn(() => `id-${String(++idCounter)}`) },
    evidenceLog,
    mocks: {
      evidenceLog: appendEntry,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  idCounter = 0;
  resetEscalationAuditState();
});

afterEach(() => {
  resetEscalationAuditState();
});

describe('sweepEscalationApprovals', () => {
  it('returns zero counts when no approvals are pending', async () => {
    const deps = makeDeps([], '2026-03-10T12:00:00.000Z');
    const result = await sweepEscalationApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.evaluated).toBe(0);
    expect(result.escalationsRecorded).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  it('records escalation when first step is reached', async () => {
    const approval = makePendingApproval();
    // 3h after request => step 0 (afterHours=2) is active
    const deps = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    const result = await sweepEscalationApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.evaluated).toBe(1);
    expect(result.escalationsRecorded).toBe(1);
    expect(result.entries[0]!.stepIndex).toBe(0);
    expect(result.entries[0]!.escalateToUserId).toBe('user-mgr');
  });

  it('creates evidence audit entry for escalation', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    await sweepEscalationApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(deps.mocks.evidenceLog).toHaveBeenCalledTimes(1);
    const entry = deps.mocks.evidenceLog.mock.calls[0]![1] as Record<string, unknown>;
    expect(entry['category']).toBe('Approval');
    expect(entry['summary'] as string).toContain('escalated');
    expect(entry['summary'] as string).toContain('user-mgr');
  });

  it('does not re-audit the same escalation step (idempotency)', async () => {
    const approval = makePendingApproval();

    // First sweep at 3h => step 0
    const deps1 = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    const r1 = await sweepEscalationApprovals(deps1, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });
    expect(r1.escalationsRecorded).toBe(1);

    // Second sweep still at 3h => no new audit entries
    const deps2 = makeDeps([approval], '2026-03-10T11:30:00.000Z');
    const r2 = await sweepEscalationApprovals(deps2, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });
    expect(r2.escalationsRecorded).toBe(0);
  });

  it('records new audit entry when escalation advances to next step', async () => {
    const approval = makePendingApproval();

    // First sweep at 3h => step 0
    const deps1 = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    await sweepEscalationApprovals(deps1, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    // Second sweep at 7h => step 1 (afterHours=6)
    const deps2 = makeDeps([approval], '2026-03-10T15:00:00.000Z');
    const r2 = await sweepEscalationApprovals(deps2, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(r2.escalationsRecorded).toBe(1);
    expect(r2.entries[0]!.stepIndex).toBe(1);
    expect(r2.entries[0]!.escalateToUserId).toBe('user-dir');
  });

  it('does not record escalation before first step is reached', async () => {
    const approval = makePendingApproval();
    // 1h after request, first step at afterHours=2
    const deps = makeDeps([approval], '2026-03-10T09:00:00.000Z');
    const result = await sweepEscalationApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.escalationsRecorded).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  it('skips approvals without escalation chains', async () => {
    const { escalationChain: _, ...withoutChain } = makePendingApproval();
    const approval: ApprovalPendingV1 = withoutChain;
    const deps = makeDeps([approval], '2026-03-10T12:00:00.000Z');
    const result = await sweepEscalationApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.evaluated).toBe(1);
    expect(result.escalationsRecorded).toBe(0);
  });

  it('handles multiple approvals independently', async () => {
    const a1 = makePendingApproval({ approvalId: ApprovalId('appr-1') });
    const a2 = makePendingApproval({
      approvalId: ApprovalId('appr-2'),
      requestedAtIso: '2026-03-10T06:00:00.000Z', // 5h elapsed at 11:00
    });

    const deps = makeDeps([a1, a2], '2026-03-10T11:00:00.000Z');
    const result = await sweepEscalationApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.evaluated).toBe(2);
    expect(result.escalationsRecorded).toBe(2);
  });

  it('works without evidence log (optional dependency)', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    const { evidenceLog: _, ...depsWithoutLog } = deps;
    const result = await sweepEscalationApprovals(depsWithoutLog, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.escalationsRecorded).toBe(1);
  });

  it('includes elapsed hours in the audit entry', async () => {
    const approval = makePendingApproval();
    const deps = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    const result = await sweepEscalationApprovals(deps, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });

    expect(result.entries[0]!.elapsedHours).toBeCloseTo(3, 1);
  });

  it('prunes state map entries when an approval is no longer pending', async () => {
    const approval = makePendingApproval();
    // First sweep at 3h => step 0 recorded
    const deps1 = makeDeps([approval], '2026-03-10T11:00:00.000Z');
    await sweepEscalationApprovals(deps1, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });
    expect(getEscalationAuditStateSize()).toBe(1);

    // Second sweep: approval is no longer pending (human approved it)
    const deps2 = makeDeps([], '2026-03-10T12:00:00.000Z');
    await sweepEscalationApprovals(deps2, {
      workspaceId: 'ws-1',
      correlationId: 'corr-test',
    });
    expect(getEscalationAuditStateSize()).toBe(0);
  });
});

/**
 * Scenario: execution reservation recovery.
 *
 * This deterministic eval proves the core bead-1142 recovery contract without
 * live provider credentials: once an approved Action is reserved for execution,
 * retries observe the active reservation instead of dispatching the Action
 * again.
 */

import { describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../src/application/common/context.js';
import { executeApprovedAgentAction } from '../../src/application/commands/execute-approved-agent-action.js';
import type {
  ActionRunnerPort,
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  UnitOfWork,
} from '../../src/application/ports/index.js';
import {
  ApprovalId,
  PlanId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';
import type { ApprovalDecidedV1 } from '../../src/domain/approvals/index.js';

const APPROVED: ApprovalDecidedV1 = {
  schemaVersion: 1,
  approvalId: ApprovalId('appr-reservation-1'),
  workspaceId: WorkspaceId('ws-reservation'),
  runId: RunId('run-reservation'),
  planId: PlanId('plan-reservation'),
  prompt: 'Execute governed Action.',
  requestedAtIso: '2026-05-01T00:00:00.000Z',
  requestedByUserId: UserId('requester-1'),
  status: 'Approved',
  decidedAtIso: '2026-05-01T00:01:00.000Z',
  decidedByUserId: UserId('approver-1'),
  rationale: 'Approved for deterministic recovery eval.',
};

type ReservationEnvelope = Readonly<{
  status: 'InProgress' | 'Completed';
  fingerprint: string;
  leaseExpiresAtIso?: string;
  value?: unknown;
}>;

function makeReservationStore() {
  const records = new Map<string, ReservationEnvelope>();
  const keyOf = (key: IdempotencyKey) => `${key.tenantId}:${key.commandName}:${key.requestKey}`;

  const store: IdempotencyStore = {
    get: async <T>(key: IdempotencyKey) => (records.get(keyOf(key)) as T | undefined) ?? null,
    set: vi.fn(async <T>(key: IdempotencyKey, value: T) => {
      records.set(keyOf(key), value as ReservationEnvelope);
    }),
    begin: vi.fn(async (key, input) => {
      const mapKey = keyOf(key);
      const existing = records.get(mapKey);
      if (existing?.status === 'Completed') {
        return {
          status: 'Completed' as const,
          fingerprint: existing.fingerprint,
          value: existing.value,
        };
      }
      if (existing?.status === 'InProgress') {
        return {
          status: 'InProgress' as const,
          fingerprint: existing.fingerprint,
          ...(existing.leaseExpiresAtIso ? { leaseExpiresAtIso: existing.leaseExpiresAtIso } : {}),
        };
      }
      records.set(mapKey, {
        status: 'InProgress',
        fingerprint: input.fingerprint,
        leaseExpiresAtIso: input.leaseExpiresAtIso,
      });
      return { status: 'Began' as const };
    }),
    complete: vi.fn(async (key: IdempotencyKey, input) => {
      records.set(keyOf(key), {
        status: 'Completed',
        fingerprint: input.fingerprint,
        value: input.value,
      });
      return true;
    }),
    release: vi.fn(async (key) => {
      records.delete(keyOf(key));
      return true;
    }),
  };

  return { records, store };
}

function makeHarness(initialApproval: ApprovalDecidedV1 = APPROVED) {
  let storedApproval = initialApproval;
  const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
  const clock: Clock = { nowIso: vi.fn(() => '2026-05-01T00:05:00.000Z') };
  const idGenerator: IdGenerator = { generateId: vi.fn(() => 'scenario-id') };
  const approvalStore: ApprovalStore = {
    getApprovalById: vi.fn(async () => storedApproval),
    saveApproval: vi.fn(async (_tenantId, approval) => {
      storedApproval = approval as ApprovalDecidedV1;
    }),
    saveApprovalIfStatus: vi.fn(async (_tenantId, _workspaceId, _approvalId, expected, next) => {
      if (storedApproval.status !== expected) return false;
      storedApproval = next as ApprovalDecidedV1;
      return true;
    }),
  };
  const unitOfWork: UnitOfWork = { execute: vi.fn(async (fn) => fn()) };
  const eventPublisher: EventPublisher = { publish: vi.fn(async () => undefined) };
  const actionRunner: ActionRunnerPort = {
    dispatchAction: vi.fn(async () => ({ ok: true as const, output: { accepted: true } })),
  };
  const reservation = makeReservationStore();
  const ctx = toAppContext({
    tenantId: 'tenant-reservation',
    principalId: 'agent-1',
    correlationId: 'corr-reservation',
    roles: ['operator'],
  });
  const input = {
    workspaceId: 'ws-reservation',
    approvalId: 'appr-reservation-1',
    flowRef: 'flow-reservation',
    payload: { operation: 'send-once' },
    idempotencyKey: 'exec-reservation-1',
  };

  return {
    actionRunner,
    approvalStore,
    eventPublisher,
    input,
    reservation,
    ctx,
    unitOfWork,
    get storedApproval() {
      return storedApproval;
    },
    deps() {
      return {
        authorization,
        clock,
        idGenerator,
        approvalStore,
        unitOfWork,
        eventPublisher,
        actionRunner,
        idempotency: reservation.store,
      };
    },
  };
}

describe('Scenario: execution reservation recovery', { timeout: 10_000 }, () => {
  it('allows only one concurrent first execution to dispatch', async () => {
    const harness = makeHarness();
    let readCount = 0;
    let releaseReads: (() => void) | undefined;
    const bothRead = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });

    harness.approvalStore.getApprovalById = vi.fn(async () => {
      readCount += 1;
      if (readCount === 2) releaseReads?.();
      if (readCount <= 2) await bothRead;
      return APPROVED;
    });

    const [first, second] = await Promise.all([
      executeApprovedAgentAction(harness.deps(), harness.ctx, harness.input),
      executeApprovedAgentAction(harness.deps(), harness.ctx, harness.input),
    ]);

    expect([first, second].filter((result) => result.ok)).toHaveLength(2);
    expect(
      [first, second].filter((result) => result.ok && result.value.status === 'Executed'),
    ).toHaveLength(1);
    expect(
      [first, second].filter((result) => result.ok && result.value.status === 'Executing'),
    ).toHaveLength(1);
    expect(harness.actionRunner.dispatchAction).toHaveBeenCalledTimes(1);
    expect(harness.eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('keeps a crash-after-dispatch retry in Executing without dispatching again', async () => {
    const harness = makeHarness();
    harness.unitOfWork.execute = vi.fn(async () => {
      throw new Error('event store unavailable after dispatch');
    });

    const first = await executeApprovedAgentAction(harness.deps(), harness.ctx, harness.input);
    const retry = await executeApprovedAgentAction(harness.deps(), harness.ctx, harness.input);

    expect(first.ok).toBe(false);
    expect(retry.ok).toBe(true);
    if (!retry.ok) throw new Error('Expected in-progress retry response.');
    expect(retry.value).toMatchObject({
      executionId: 'exec-reservation-1',
      approvalId: ApprovalId('appr-reservation-1'),
      status: 'Executing',
    });
    expect(harness.actionRunner.dispatchAction).toHaveBeenCalledTimes(1);
    expect(harness.eventPublisher.publish).not.toHaveBeenCalled();
    expect(harness.storedApproval.status).toBe('Executing');
  });

  it('returns Executing for an active Executing retry without dispatching again', async () => {
    const harness = makeHarness({
      ...APPROVED,
      status: 'Executing',
      decidedAtIso: '2026-05-01T00:05:00.000Z',
      rationale: 'Execution already claimed before process restart.',
    });
    harness.reservation.records.set(
      'tenant-reservation:ExecuteApprovedAgentAction:exec-reservation-1',
      {
        status: 'InProgress',
        fingerprint:
          '{"approvalId":"appr-reservation-1","flowRef":"flow-reservation","payload":{"operation":"send-once"},"principalId":"agent-1","workspaceId":"ws-reservation"}',
        leaseExpiresAtIso: '2026-05-01T00:20:00.000Z',
      },
    );

    const retry = await executeApprovedAgentAction(harness.deps(), harness.ctx, harness.input);

    expect(retry.ok).toBe(true);
    if (!retry.ok) throw new Error('Expected active execution response.');
    expect(retry.value).toEqual({
      executionId: 'exec-reservation-1',
      approvalId: ApprovalId('appr-reservation-1'),
      status: 'Executing',
    });
    expect(harness.actionRunner.dispatchAction).not.toHaveBeenCalled();
    expect(harness.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('replays the terminal result from the completed reservation and rejects incompatible replay', async () => {
    const harness = makeHarness();

    const first = await executeApprovedAgentAction(harness.deps(), harness.ctx, harness.input);
    vi.mocked(harness.actionRunner.dispatchAction).mockClear();
    vi.mocked(harness.eventPublisher.publish).mockClear();

    const replay = await executeApprovedAgentAction(harness.deps(), harness.ctx, harness.input);
    const incompatibleReplay = await executeApprovedAgentAction(harness.deps(), harness.ctx, {
      ...harness.input,
      payload: { operation: 'send-twice' },
    });

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    expect(incompatibleReplay.ok).toBe(false);
    if (!replay.ok || incompatibleReplay.ok) throw new Error('Expected replay then conflict.');
    expect(replay.value.status).toBe('Executed');
    expect(replay.value.replayed).toBe(true);
    expect(incompatibleReplay.error.kind).toBe('Conflict');
    expect(harness.actionRunner.dispatchAction).not.toHaveBeenCalled();
    expect(harness.eventPublisher.publish).not.toHaveBeenCalled();
  });
});

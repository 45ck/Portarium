/**
 * bead-54g5: Integration test — submit-approval orchestration flow.
 *
 * Verifies the end-to-end path: a pending approval is fetched, decided,
 * persisted, and a CloudEvent is published — all coordinated through the
 * submitApproval command.
 */

import { describe, expect, it } from 'vitest';

import { parseApprovalV1, type ApprovalV1 } from '../../domain/approvals/approval-v1.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import { toAppContext } from '../common/context.js';
import { submitApproval } from '../commands/submit-approval.js';
import type {
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';

// ---------------------------------------------------------------------------
// In-memory stubs
// ---------------------------------------------------------------------------

class InMemoryApprovalStore implements ApprovalStore {
  readonly #byId = new Map<string, ApprovalV1>();

  seed(approval: ApprovalV1) {
    this.#byId.set(String(approval.approvalId), approval);
  }

  async getApprovalById(
    _tenantId: unknown,
    _workspaceId: unknown,
    approvalId: unknown,
  ): Promise<ApprovalV1 | null> {
    return this.#byId.get(String(approvalId)) ?? null;
  }

  async saveApproval(_tenantId: unknown, approval: ApprovalV1): Promise<void> {
    this.#byId.set(String(approval.approvalId), approval);
  }

  get(approvalId: string): ApprovalV1 | undefined {
    return this.#byId.get(approvalId);
  }
}

class CapturingEventPublisher implements EventPublisher {
  readonly published: PortariumCloudEventV1[] = [];

  async publish(event: PortariumCloudEventV1): Promise<void> {
    this.published.push(event);
  }
}

function makeAlwaysAllowed(): AuthorizationPort {
  return { isAllowed: async () => true };
}

function makeClock(iso = '2026-02-22T10:00:00.000Z'): Clock {
  return { nowIso: () => iso };
}

function makeIdGenerator(id = 'evt-integration-1'): IdGenerator {
  return { generateId: () => id };
}

function makeUow(): UnitOfWork {
  return { execute: async (fn) => fn() };
}

const PENDING_APPROVAL = parseApprovalV1({
  schemaVersion: 1,
  approvalId: 'approval-int-1',
  workspaceId: 'ws-int-1',
  runId: 'run-int-1',
  planId: 'plan-int-1',
  prompt: 'Approve the integration workflow run.',
  requestedAtIso: '2026-02-22T09:00:00.000Z',
  requestedByUserId: 'user-requester',
  status: 'Pending',
});

function makeCtx(userId = 'user-approver') {
  return toAppContext({
    tenantId: 'tenant-int-1',
    principalId: userId,
    roles: ['operator'],
    correlationId: 'corr-int-1',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitApproval integration flow', () => {
  it('Approved decision persists approval and publishes CloudEvent', async () => {
    const approvalStore = new InMemoryApprovalStore();
    approvalStore.seed(PENDING_APPROVAL);
    const publisher = new CapturingEventPublisher();

    const result = await submitApproval(
      {
        authorization: makeAlwaysAllowed(),
        clock: makeClock(),
        idGenerator: makeIdGenerator(),
        approvalStore,
        unitOfWork: makeUow(),
        eventPublisher: publisher,
      },
      makeCtx(),
      {
        workspaceId: 'ws-int-1',
        approvalId: 'approval-int-1',
        decision: 'Approved',
        rationale: 'Looks good.',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.approvalId).toBe('approval-int-1' as any);

    // Approval persisted with Approved status
    const saved = approvalStore.get('approval-int-1');
    expect(saved?.status).toBe('Approved');

    // CloudEvent published
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toMatch(/approval/i);
  });

  it('Denied decision persists approval and publishes CloudEvent', async () => {
    const approvalStore = new InMemoryApprovalStore();
    approvalStore.seed(PENDING_APPROVAL);
    const publisher = new CapturingEventPublisher();

    const result = await submitApproval(
      {
        authorization: makeAlwaysAllowed(),
        clock: makeClock(),
        idGenerator: makeIdGenerator('evt-denied-1'),
        approvalStore,
        unitOfWork: makeUow(),
        eventPublisher: publisher,
      },
      makeCtx(),
      {
        workspaceId: 'ws-int-1',
        approvalId: 'approval-int-1',
        decision: 'Denied',
        rationale: 'Not enough evidence.',
      },
    );

    expect(result.ok).toBe(true);
    const saved = approvalStore.get('approval-int-1');
    expect(saved?.status).toBe('Denied');
    expect(publisher.published).toHaveLength(1);
  });

  it('returns NotFound when approval does not exist', async () => {
    const approvalStore = new InMemoryApprovalStore(); // empty store
    const result = await submitApproval(
      {
        authorization: makeAlwaysAllowed(),
        clock: makeClock(),
        idGenerator: makeIdGenerator(),
        approvalStore,
        unitOfWork: makeUow(),
        eventPublisher: new CapturingEventPublisher(),
      },
      makeCtx(),
      {
        workspaceId: 'ws-int-1',
        approvalId: 'nonexistent-id',
        decision: 'Approved',
        rationale: 'ok',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns Forbidden when authorization denies the action', async () => {
    const approvalStore = new InMemoryApprovalStore();
    approvalStore.seed(PENDING_APPROVAL);
    const result = await submitApproval(
      {
        authorization: { isAllowed: async () => false },
        clock: makeClock(),
        idGenerator: makeIdGenerator(),
        approvalStore,
        unitOfWork: makeUow(),
        eventPublisher: new CapturingEventPublisher(),
      },
      makeCtx(),
      {
        workspaceId: 'ws-int-1',
        approvalId: 'approval-int-1',
        decision: 'Approved',
        rationale: 'ok',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });

  it('self-approval is rejected (SoD constraint)', async () => {
    const approvalStore = new InMemoryApprovalStore();
    approvalStore.seed(PENDING_APPROVAL);

    // Approve as the same user who requested
    const result = await submitApproval(
      {
        authorization: makeAlwaysAllowed(),
        clock: makeClock(),
        idGenerator: makeIdGenerator(),
        approvalStore,
        unitOfWork: makeUow(),
        eventPublisher: new CapturingEventPublisher(),
      },
      makeCtx('user-requester'), // same as requestedByUserId
      {
        workspaceId: 'ws-int-1',
        approvalId: 'approval-int-1',
        decision: 'Approved',
        rationale: 'Self-approving.',
        sodConstraints: [{ kind: 'MakerChecker' }],
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });
});

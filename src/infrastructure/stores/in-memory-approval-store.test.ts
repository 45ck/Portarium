import { describe, expect, it } from 'vitest';

import {
  ApprovalId,
  PlanId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type {
  ApprovalPendingV1,
  ApprovalDecidedV1,
  ApprovalV1,
} from '../../domain/approvals/index.js';
import { InMemoryApprovalStore } from './in-memory-approval-store.js';

const TENANT = TenantId('t-1');
const WS = WorkspaceId('ws-1');

function makePending(overrides?: Partial<ApprovalPendingV1>): ApprovalPendingV1 {
  return {
    schemaVersion: 1,
    approvalId: ApprovalId('appr-1'),
    workspaceId: WS,
    runId: RunId('run-1'),
    planId: PlanId('plan-1'),
    prompt: 'Approve deploying to production?',
    requestedAtIso: '2026-03-01T00:00:00.000Z',
    requestedByUserId: UserId('user-1'),
    status: 'Pending',
    ...overrides,
  };
}

function makeDecided(overrides?: Partial<ApprovalDecidedV1>): ApprovalDecidedV1 {
  return {
    schemaVersion: 1,
    approvalId: ApprovalId('appr-2'),
    workspaceId: WS,
    runId: RunId('run-1'),
    planId: PlanId('plan-1'),
    prompt: 'Approve deploying to production?',
    requestedAtIso: '2026-03-01T00:00:00.000Z',
    requestedByUserId: UserId('user-1'),
    status: 'Approved',
    decidedAtIso: '2026-03-01T01:00:00.000Z',
    decidedByUserId: UserId('user-2'),
    rationale: 'Looks good.',
    ...overrides,
  };
}

describe('InMemoryApprovalStore', () => {
  it('returns null for unknown approvalId', async () => {
    const store = new InMemoryApprovalStore();
    const result = await store.getApprovalById(TENANT, WS, ApprovalId('nonexistent'));
    expect(result).toBeNull();
  });

  it('saves and retrieves a pending approval', async () => {
    const store = new InMemoryApprovalStore();
    const approval = makePending();

    await store.saveApproval(TENANT, approval);
    const result = await store.getApprovalById(TENANT, WS, approval.approvalId);

    expect(result).toEqual(approval);
    expect(result?.status).toBe('Pending');
  });

  it('saves and retrieves a decided approval', async () => {
    const store = new InMemoryApprovalStore();
    const approval = makeDecided();

    await store.saveApproval(TENANT, approval);
    const result = await store.getApprovalById(TENANT, WS, approval.approvalId);

    expect(result).toEqual(approval);
    expect(result?.status).toBe('Approved');
  });

  it('overwrites on duplicate save (idempotent upsert)', async () => {
    const store = new InMemoryApprovalStore();
    const pending = makePending();
    const decided = makeDecided({ approvalId: pending.approvalId });

    await store.saveApproval(TENANT, pending);
    await store.saveApproval(TENANT, decided);
    const result = await store.getApprovalById(TENANT, WS, pending.approvalId);

    expect(result?.status).toBe('Approved');
  });

  it('isolates approvals by tenantId', async () => {
    const store = new InMemoryApprovalStore();
    const tenantA = TenantId('tenant-a');
    const tenantB = TenantId('tenant-b');
    const approval = makePending();

    await store.saveApproval(tenantA, approval);

    const fromA = await store.getApprovalById(tenantA, WS, approval.approvalId);
    const fromB = await store.getApprovalById(tenantB, WS, approval.approvalId);

    expect(fromA).toEqual(approval);
    expect(fromB).toBeNull();
  });

  it('validates workspaceId on retrieval', async () => {
    const store = new InMemoryApprovalStore();
    const approval = makePending();

    await store.saveApproval(TENANT, approval);

    const sameWs = await store.getApprovalById(TENANT, WS, approval.approvalId);
    const otherWs = await store.getApprovalById(
      TENANT,
      WorkspaceId('ws-other'),
      approval.approvalId,
    );

    expect(sameWs).toEqual(approval);
    expect(otherWs).toBeNull();
  });
});

describe('InMemoryApprovalStore — listApprovals', () => {
  it('returns empty list when no approvals exist', async () => {
    const store = new InMemoryApprovalStore();
    const result = await store.listApprovals(TENANT, WS, {});
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it('lists approvals filtered by workspace', async () => {
    const store = new InMemoryApprovalStore();
    const a1 = makePending({ approvalId: ApprovalId('a-1'), workspaceId: WS });
    const a2 = makePending({ approvalId: ApprovalId('a-2'), workspaceId: WorkspaceId('ws-other') });

    await store.saveApproval(TENANT, a1);
    await store.saveApproval(TENANT, a2);

    const result = await store.listApprovals(TENANT, WS, {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.approvalId).toBe(a1.approvalId);
  });

  it('filters by status', async () => {
    const store = new InMemoryApprovalStore();
    const pending = makePending({ approvalId: ApprovalId('a-1') });
    const decided = makeDecided({ approvalId: ApprovalId('a-2') });

    await store.saveApproval(TENANT, pending);
    await store.saveApproval(TENANT, decided);

    const pendingOnly = await store.listApprovals(TENANT, WS, { status: 'Pending' });
    expect(pendingOnly.items).toHaveLength(1);
    expect(pendingOnly.items[0]?.status).toBe('Pending');

    const approvedOnly = await store.listApprovals(TENANT, WS, { status: 'Approved' });
    expect(approvedOnly.items).toHaveLength(1);
    expect(approvedOnly.items[0]?.status).toBe('Approved');
  });

  it('filters by runId', async () => {
    const store = new InMemoryApprovalStore();
    const a1 = makePending({ approvalId: ApprovalId('a-1'), runId: RunId('run-x') });
    const a2 = makePending({ approvalId: ApprovalId('a-2'), runId: RunId('run-y') });

    await store.saveApproval(TENANT, a1);
    await store.saveApproval(TENANT, a2);

    const result = await store.listApprovals(TENANT, WS, { runId: 'run-x' });
    expect(result.items).toHaveLength(1);
    expect(String(result.items[0]?.runId)).toBe('run-x');
  });

  it('filters by assigneeUserId', async () => {
    const store = new InMemoryApprovalStore();
    const a1 = makePending({ approvalId: ApprovalId('a-1'), assigneeUserId: UserId('assignee-1') });
    const a2 = makePending({ approvalId: ApprovalId('a-2') }); // no assignee

    await store.saveApproval(TENANT, a1);
    await store.saveApproval(TENANT, a2);

    const result = await store.listApprovals(TENANT, WS, { assigneeUserId: 'assignee-1' });
    expect(result.items).toHaveLength(1);
    expect(String(result.items[0]?.assigneeUserId)).toBe('assignee-1');
  });

  it('paginates with limit and cursor', async () => {
    const store = new InMemoryApprovalStore();
    const approvals: ApprovalV1[] = [];
    for (let i = 1; i <= 5; i++) {
      const a = makePending({ approvalId: ApprovalId(`a-${i}`) });
      approvals.push(a);
      await store.saveApproval(TENANT, a);
    }

    const page1 = await store.listApprovals(TENANT, WS, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await store.listApprovals(TENANT, WS, {
      limit: 2,
      ...(page1.nextCursor ? { cursor: page1.nextCursor } : {}),
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeDefined();

    const page3 = await store.listApprovals(TENANT, WS, {
      limit: 2,
      ...(page2.nextCursor ? { cursor: page2.nextCursor } : {}),
    });
    expect(page3.items).toHaveLength(1);
    expect(page3.nextCursor).toBeUndefined();

    // All 5 unique
    const allIds = [...page1.items, ...page2.items, ...page3.items].map((a) =>
      String(a.approvalId),
    );
    expect(new Set(allIds).size).toBe(5);
  });

  it('sorts results by approvalId', async () => {
    const store = new InMemoryApprovalStore();
    // Insert out of order
    await store.saveApproval(TENANT, makePending({ approvalId: ApprovalId('c') }));
    await store.saveApproval(TENANT, makePending({ approvalId: ApprovalId('a') }));
    await store.saveApproval(TENANT, makePending({ approvalId: ApprovalId('b') }));

    const result = await store.listApprovals(TENANT, WS, {});
    const ids = result.items.map((a) => String(a.approvalId));
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

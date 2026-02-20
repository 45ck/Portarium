import { describe, expect, it, vi } from 'vitest';

import { parseApprovalV1 } from '../../domain/approvals/approval-v1.js';
import { toAppContext } from '../common/context.js';
import type { ApprovalQueryStore, AuthorizationPort } from '../ports/index.js';
import { listApprovals } from './list-approvals.js';

const APPROVAL = parseApprovalV1({
  schemaVersion: 1,
  approvalId: 'approval-1',
  workspaceId: 'ws-1',
  runId: 'run-1',
  planId: 'plan-1',
  workItemId: 'wi-1',
  prompt: 'Approve change',
  status: 'Pending',
  requestedAtIso: '2026-02-20T00:00:00.000Z',
  requestedByUserId: 'user-1',
  assigneeUserId: 'user-2',
});

describe('listApprovals', () => {
  it('returns approvals page for valid filters', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const approvalStore: ApprovalQueryStore = {
      listApprovals: vi.fn(async () => ({ items: [APPROVAL], nextCursor: 'approval-1' })),
    };

    const result = await listApprovals(
      { authorization, approvalStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-3',
        correlationId: 'cor-1',
        roles: ['approver'],
      }),
      {
        workspaceId: 'ws-1',
        status: 'Pending',
        runId: 'run-1',
        planId: 'plan-1',
        workItemId: 'wi-1',
        assigneeUserId: 'user-2',
        requestedByUserId: 'user-1',
        limit: 10,
        cursor: 'approval-0',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.nextCursor).toBe('approval-1');
  });

  it('rejects empty workspaceId', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const approvalStore: ApprovalQueryStore = {
      listApprovals: vi.fn(async () => ({ items: [] })),
    };

    const result = await listApprovals(
      { authorization, approvalStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-3',
        correlationId: 'cor-1',
        roles: ['approver'],
      }),
      { workspaceId: '' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
  });

  it('returns forbidden when caller lacks approval:read', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => false),
    };
    const approvalStore: ApprovalQueryStore = {
      listApprovals: vi.fn(async () => ({ items: [] })),
    };

    const result = await listApprovals(
      { authorization, approvalStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-3',
        correlationId: 'cor-1',
        roles: ['auditor'],
      }),
      { workspaceId: 'ws-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });
});

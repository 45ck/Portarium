import { describe, expect, it, vi } from 'vitest';

import { parseApprovalV1 } from '../../domain/approvals/approval-v1.js';
import { toAppContext } from '../common/context.js';
import type { ApprovalStore, AuthorizationPort } from '../ports/index.js';
import { getApproval } from './get-approval.js';

const APPROVAL = parseApprovalV1({
  schemaVersion: 1,
  approvalId: 'approval-1',
  workspaceId: 'ws-1',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Approve change',
  status: 'Pending',
  requestedAtIso: '2026-02-20T00:00:00.000Z',
  requestedByUserId: 'user-1',
});

describe('getApproval', () => {
  it('returns approval when present', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const approvalStore: ApprovalStore = {
      getApprovalById: vi.fn(async () => APPROVAL),
      saveApproval: vi.fn(async () => undefined),
    };

    const result = await getApproval(
      { authorization, approvalStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-2',
        correlationId: 'cor-1',
        roles: ['approver'],
      }),
      { workspaceId: 'ws-1', approvalId: 'approval-1' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.approvalId).toBe('approval-1');
  });

  it('returns not found when approval is missing', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const approvalStore: ApprovalStore = {
      getApprovalById: vi.fn(async () => null),
      saveApproval: vi.fn(async () => undefined),
    };

    const result = await getApproval(
      { authorization, approvalStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-2',
        correlationId: 'cor-1',
        roles: ['approver'],
      }),
      { workspaceId: 'ws-1', approvalId: 'approval-missing' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns forbidden when caller lacks approval:read', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => false),
    };
    const approvalStore: ApprovalStore = {
      getApprovalById: vi.fn(async () => APPROVAL),
      saveApproval: vi.fn(async () => undefined),
    };

    const result = await getApproval(
      { authorization, approvalStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-2',
        correlationId: 'cor-1',
        roles: ['auditor'],
      }),
      { workspaceId: 'ws-1', approvalId: 'approval-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });
});

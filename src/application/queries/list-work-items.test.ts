import { describe, expect, it, vi } from 'vitest';

import { parseWorkItemV1 } from '../../domain/work-items/work-item-v1.js';
import { TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import { createCanonicalWorkItemSeedV1 } from '../../domain/testing/canonical-seeds-v1.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import { type AuthorizationPort, type WorkItemStore } from '../ports/index.js';
import { listWorkItems } from './list-work-items.js';

const WORK_ITEM = parseWorkItemV1(createCanonicalWorkItemSeedV1());

describe('listWorkItems', () => {
  it('passes linkage filters to store and returns page', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const workItemStore: WorkItemStore = {
      getWorkItemById: vi.fn(async () => WORK_ITEM),
      listWorkItems: vi.fn(async () => ({ items: [WORK_ITEM], nextCursor: 'cursor-2' })),
      saveWorkItem: vi.fn(async () => undefined),
    };

    const result = await listWorkItems(
      { authorization, workItemStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        runId: 'run-1',
        workflowId: 'wf-1',
        approvalId: 'approval-1',
        evidenceId: 'evi-1',
        limit: 25,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.items).toHaveLength(1);
    expect(workItemStore.listWorkItems).toHaveBeenCalledWith(
      TenantId('tenant-1'),
      WorkspaceId('ws-1'),
      expect.objectContaining({
        runId: 'run-1',
        workflowId: 'wf-1',
        approvalId: 'approval-1',
        evidenceId: 'evi-1',
        limit: 25,
      }),
    );
  });

  it('returns ValidationFailed for invalid linkage filter IDs', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const workItemStore: WorkItemStore = {
      getWorkItemById: vi.fn(async () => WORK_ITEM),
      listWorkItems: vi.fn(async () => ({ items: [WORK_ITEM] })),
      saveWorkItem: vi.fn(async () => undefined),
    };

    const result = await listWorkItems(
      { authorization, workItemStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        runId: '   ',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ValidationFailed.');
    expect(result.error.kind).toBe('ValidationFailed');
  });

  it('denies access without work-item:read capability', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => false) };
    const workItemStore: WorkItemStore = {
      getWorkItemById: vi.fn(async () => WORK_ITEM),
      listWorkItems: vi.fn(async () => ({ items: [WORK_ITEM] })),
      saveWorkItem: vi.fn(async () => undefined),
    };

    const result = await listWorkItems(
      { authorization, workItemStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['auditor'],
      }),
      { workspaceId: 'ws-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected Forbidden.');
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.workItemRead,
    );
    expect(workItemStore.listWorkItems).not.toHaveBeenCalled();
  });
});

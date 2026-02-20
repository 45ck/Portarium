import { describe, expect, it, vi } from 'vitest';

import { parseWorkItemV1 } from '../../domain/work-items/work-item-v1.js';
import { TenantId } from '../../domain/primitives/index.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import { type AuthorizationPort, type WorkItemStore } from '../ports/index.js';
import { getWorkItem } from './get-work-item.js';
import { createCanonicalWorkItemSeedV1 } from '../../domain/testing/canonical-seeds-v1.js';

const WORK_ITEM = parseWorkItemV1(createCanonicalWorkItemSeedV1());

describe('getWorkItem', () => {
  it('returns work item when present', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const workItemStore: WorkItemStore = {
      getWorkItemById: vi.fn(async () => WORK_ITEM),
      listWorkItems: vi.fn(async () => ({ items: [WORK_ITEM] })),
      saveWorkItem: vi.fn(async () => undefined),
    };

    const result = await getWorkItem(
      { authorization, workItemStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { workspaceId: 'ws-1', workItemId: 'wi-1' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.links?.workflowIds).toEqual(['wf-1']);
  });

  it('returns NotFound when missing', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const workItemStore: WorkItemStore = {
      getWorkItemById: vi.fn(async () => null),
      listWorkItems: vi.fn(async () => ({ items: [] })),
      saveWorkItem: vi.fn(async () => undefined),
    };

    const result = await getWorkItem(
      { authorization, workItemStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { workspaceId: 'ws-1', workItemId: 'wi-404' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected NotFound.');
    expect(result.error.kind).toBe('NotFound');
  });

  it('denies access without work-item:read capability', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => false) };
    const workItemStore: WorkItemStore = {
      getWorkItemById: vi.fn(async () => WORK_ITEM),
      listWorkItems: vi.fn(async () => ({ items: [WORK_ITEM] })),
      saveWorkItem: vi.fn(async () => undefined),
    };

    const result = await getWorkItem(
      { authorization, workItemStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['auditor'],
      }),
      { workspaceId: 'ws-1', workItemId: 'wi-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden response.');
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.workItemRead,
    );
    expect(workItemStore.getWorkItemById).not.toHaveBeenCalled();
  });
});

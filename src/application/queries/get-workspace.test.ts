import { describe, expect, it, vi } from 'vitest';

import { TenantId } from '../../domain/primitives/index.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import { type AuthorizationPort, type WorkspaceStore } from '../ports/index.js';
import { getWorkspace } from './get-workspace.js';
import { parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';

const WORKSPACE = parseWorkspaceV1({
  schemaVersion: 1,
  workspaceId: 'ws-1',
  tenantId: 'tenant-1',
  name: 'Primary Workspace',
  createdAtIso: '2026-02-17T00:00:00.000Z',
});

describe('getWorkspace', () => {
  it('returns NotFound when workspace is absent', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const workspaceStore: WorkspaceStore = {
      getWorkspaceById: vi.fn(async () => null),
      saveWorkspace: vi.fn(async () => undefined),
    };

    const result = await getWorkspace(
      { authorization, workspaceStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { workspaceId: 'ws-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected not found response.');
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns workspace when present', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const workspaceStore: WorkspaceStore = {
      getWorkspaceById: vi.fn(async () => WORKSPACE),
      saveWorkspace: vi.fn(async () => undefined),
    };

    const result = await getWorkspace(
      { authorization, workspaceStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { workspaceId: 'ws-1' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.workspaceId).toBe('ws-1');
    expect(result.value.name).toBe('Primary Workspace');
  });

  it('is denied without workspace:read capability', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => false),
    };
    const workspaceStore: WorkspaceStore = {
      getWorkspaceById: vi.fn(async () => WORKSPACE),
      saveWorkspace: vi.fn(async () => undefined),
    };

    const result = await getWorkspace(
      { authorization, workspaceStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['auditor'],
      }),
      { workspaceId: 'ws-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden response.');
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.workspaceRead,
    );
    expect(workspaceStore.getWorkspaceById).not.toHaveBeenCalled();
  });
});

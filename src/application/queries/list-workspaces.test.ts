import { describe, expect, it, vi } from 'vitest';

import { parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { toAppContext } from '../common/context.js';
import type { AuthorizationPort, WorkspaceQueryStore } from '../ports/index.js';
import { listWorkspaces } from './list-workspaces.js';

const WORKSPACE = parseWorkspaceV1({
  workspaceId: 'ws-1',
  tenantId: 'ws-1',
  name: 'Demo',
  createdAtIso: '2026-02-20T00:00:00.000Z',
});

describe('listWorkspaces', () => {
  it('returns paged workspaces when caller is authorized', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const workspaceStore: WorkspaceQueryStore = {
      listWorkspaces: vi.fn(async () => ({ items: [WORKSPACE], nextCursor: 'ws-1' })),
    };

    const result = await listWorkspaces(
      { authorization, workspaceStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-1',
        correlationId: 'cor-1',
        roles: ['operator'],
      }),
      { limit: 10, cursor: 'ws-0', nameQuery: 'Demo' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.nextCursor).toBe('ws-1');
  });

  it('rejects invalid cursor', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const workspaceStore: WorkspaceQueryStore = {
      listWorkspaces: vi.fn(async () => ({ items: [] })),
    };

    const result = await listWorkspaces(
      { authorization, workspaceStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-1',
        correlationId: 'cor-1',
        roles: ['operator'],
      }),
      { cursor: '   ' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
  });

  it('returns forbidden when caller lacks workspace:read', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => false),
    };
    const workspaceStore: WorkspaceQueryStore = {
      listWorkspaces: vi.fn(async () => ({ items: [] })),
    };

    const result = await listWorkspaces(
      { authorization, workspaceStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-1',
        correlationId: 'cor-1',
        roles: ['auditor'],
      }),
      {},
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });
});

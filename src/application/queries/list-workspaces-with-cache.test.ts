import { describe, expect, it, vi } from 'vitest';

import { parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { createCanonicalWorkspaceSeedV1 } from '../../domain/testing/canonical-seeds-v1.js';
import { InMemoryQueryCache } from '../../infrastructure/caching/in-memory-query-cache.js';
import { toAppContext } from '../common/context.js';
import type { AuthorizationPort, WorkspaceQueryStore } from '../ports/index.js';
import { listWorkspaces } from './list-workspaces.js';

const WORKSPACE = parseWorkspaceV1(createCanonicalWorkspaceSeedV1());

const CTX = toAppContext({
  tenantId: 'tenant-1',
  principalId: 'user-1',
  correlationId: 'cor-1',
  roles: ['operator'],
});

function makeAuthorization(): AuthorizationPort {
  return { isAllowed: vi.fn(async () => true) };
}

describe('listWorkspaces with QueryCache', () => {
  it('returns result and caches on first call', async () => {
    const cache = new InMemoryQueryCache();
    const listWorkspacesFn = vi.fn(async () => ({ items: [WORKSPACE] }));
    const workspaceStore: WorkspaceQueryStore = { listWorkspaces: listWorkspacesFn };

    const result = await listWorkspaces(
      { authorization: makeAuthorization(), workspaceStore, queryCache: cache },
      CTX,
      {},
    );

    expect(result.ok).toBe(true);
    expect(listWorkspacesFn).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
  });

  it('serves from cache on second call without hitting the store', async () => {
    const cache = new InMemoryQueryCache();
    const listWorkspacesFn = vi.fn(async () => ({ items: [WORKSPACE] }));
    const workspaceStore: WorkspaceQueryStore = { listWorkspaces: listWorkspacesFn };

    await listWorkspaces(
      { authorization: makeAuthorization(), workspaceStore, queryCache: cache },
      CTX,
      {},
    );
    const result = await listWorkspaces(
      { authorization: makeAuthorization(), workspaceStore, queryCache: cache },
      CTX,
      {},
    );

    expect(result.ok).toBe(true);
    expect(listWorkspacesFn).toHaveBeenCalledTimes(1);
  });

  it('works without a cache (null queryCache)', async () => {
    const listWorkspacesFn = vi.fn(async () => ({ items: [WORKSPACE], nextCursor: 'next' }));
    const workspaceStore: WorkspaceQueryStore = { listWorkspaces: listWorkspacesFn };

    const result = await listWorkspaces(
      { authorization: makeAuthorization(), workspaceStore, queryCache: null },
      CTX,
      {},
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nextCursor).toBe('next');
    expect(listWorkspacesFn).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid limit via cache path', async () => {
    const cache = new InMemoryQueryCache();
    const workspaceStore: WorkspaceQueryStore = {
      listWorkspaces: vi.fn(async () => ({ items: [] })),
    };

    const result = await listWorkspaces(
      { authorization: makeAuthorization(), workspaceStore, queryCache: cache },
      CTX,
      { limit: -5 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
  });
});

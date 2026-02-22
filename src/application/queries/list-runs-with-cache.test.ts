import { describe, expect, it, vi } from 'vitest';

import { parseRunV1 } from '../../domain/runs/run-v1.js';
import { createCanonicalRunSeedV1 } from '../../domain/testing/canonical-seeds-v1.js';
import { InMemoryQueryCache } from '../../infrastructure/caching/in-memory-query-cache.js';
import { toAppContext } from '../common/context.js';
import type { AuthorizationPort, RunQueryStore } from '../ports/index.js';
import { queryCacheKey } from '../ports/query-cache.js';
import { listRuns } from './list-runs.js';

const RUN = parseRunV1(createCanonicalRunSeedV1());

const CTX = toAppContext({
  tenantId: 'tenant-1',
  principalId: 'user-1',
  correlationId: 'cor-1',
  roles: ['operator'],
});

function makeAuthorization(): AuthorizationPort {
  return { isAllowed: vi.fn(async () => true) };
}

describe('listRuns with QueryCache', () => {
  it('returns result and caches on first call', async () => {
    const cache = new InMemoryQueryCache();
    const listRunsFn = vi.fn(async () => ({ items: [RUN] }));
    const runStore: RunQueryStore = { listRuns: listRunsFn };

    const result = await listRuns(
      { authorization: makeAuthorization(), runStore, queryCache: cache },
      CTX,
      { workspaceId: 'ws-1' },
    );

    expect(result.ok).toBe(true);
    expect(listRunsFn).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
  });

  it('serves from cache on second call without hitting the store', async () => {
    const cache = new InMemoryQueryCache();
    const listRunsFn = vi.fn(async () => ({ items: [RUN] }));
    const runStore: RunQueryStore = { listRuns: listRunsFn };

    const input = { workspaceId: 'ws-1' };

    // First call populates cache
    await listRuns({ authorization: makeAuthorization(), runStore, queryCache: cache }, CTX, input);
    // Second call should use cache
    const result = await listRuns(
      { authorization: makeAuthorization(), runStore, queryCache: cache },
      CTX,
      input,
    );

    expect(result.ok).toBe(true);
    expect(listRunsFn).toHaveBeenCalledTimes(1);
  });

  it('different inputs produce different cache keys', async () => {
    const cache = new InMemoryQueryCache();
    const listRunsFn = vi.fn(async () => ({ items: [RUN] }));
    const runStore: RunQueryStore = { listRuns: listRunsFn };

    await listRuns({ authorization: makeAuthorization(), runStore, queryCache: cache }, CTX, {
      workspaceId: 'ws-1',
    });
    await listRuns({ authorization: makeAuthorization(), runStore, queryCache: cache }, CTX, {
      workspaceId: 'ws-2',
    });

    expect(listRunsFn).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it('works without a cache (null queryCache)', async () => {
    const listRunsFn = vi.fn(async () => ({ items: [RUN] }));
    const runStore: RunQueryStore = { listRuns: listRunsFn };

    const result = await listRuns(
      { authorization: makeAuthorization(), runStore, queryCache: null },
      CTX,
      { workspaceId: 'ws-1' },
    );

    expect(result.ok).toBe(true);
    expect(listRunsFn).toHaveBeenCalledTimes(1);
  });

  it('works without a cache (omitted queryCache)', async () => {
    const listRunsFn = vi.fn(async () => ({ items: [RUN] }));
    const runStore: RunQueryStore = { listRuns: listRunsFn };

    const result = await listRuns({ authorization: makeAuthorization(), runStore }, CTX, {
      workspaceId: 'ws-1',
    });

    expect(result.ok).toBe(true);
    expect(listRunsFn).toHaveBeenCalledTimes(1);
  });

  it('cache key includes tenantId, handler, workspaceId, sort, cursor, limit', () => {
    const key = queryCacheKey('tenant-1', 'listRuns', 'ws-1', 'undefined', '', '10');
    expect(key).toBe('tenant-1:listRuns:ws-1:undefined::10');
  });

  it('cache miss after TTL expiry causes store to be called again', async () => {
    const cache = new InMemoryQueryCache();
    const listRunsFn = vi.fn(async () => ({ items: [RUN] }));
    const runStore: RunQueryStore = { listRuns: listRunsFn };

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await listRuns({ authorization: makeAuthorization(), runStore, queryCache: cache }, CTX, {
      workspaceId: 'ws-1',
    });

    // Advance past the 30 second TTL
    vi.spyOn(Date, 'now').mockReturnValue(now + 31_000);

    await listRuns({ authorization: makeAuthorization(), runStore, queryCache: cache }, CTX, {
      workspaceId: 'ws-1',
    });

    expect(listRunsFn).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});

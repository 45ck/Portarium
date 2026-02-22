import { describe, expect, it, vi } from 'vitest';
import { CacheInvalidationService } from './cache-invalidation-service.js';
import type { QueryCache } from '../ports/query-cache.js';

function makeCache(): QueryCache {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidatePrefix: vi.fn().mockResolvedValue(undefined),
  };
}

describe('CacheInvalidationService', () => {
  it('onRunChanged invalidates listRuns and getRun prefixes for tenant', async () => {
    const cache = makeCache();
    const svc = new CacheInvalidationService(cache);

    await svc.onRunChanged('tenant-1', 'ws-1');

    expect(cache.invalidatePrefix).toHaveBeenCalledWith('tenant-1:listRuns:');
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('tenant-1:getRun:');
    expect(cache.invalidatePrefix).toHaveBeenCalledTimes(2);
  });

  it('onWorkspaceChanged invalidates listWorkspaces and getWorkspace prefixes', async () => {
    const cache = makeCache();
    const svc = new CacheInvalidationService(cache);

    await svc.onWorkspaceChanged('tenant-2');

    expect(cache.invalidatePrefix).toHaveBeenCalledWith('tenant-2:listWorkspaces:');
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('tenant-2:getWorkspace:');
    expect(cache.invalidatePrefix).toHaveBeenCalledTimes(2);
  });
});

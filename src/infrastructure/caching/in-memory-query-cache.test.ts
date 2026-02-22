import { describe, expect, it, vi } from 'vitest';

import { InMemoryQueryCache } from './in-memory-query-cache.js';

describe('InMemoryQueryCache', () => {
  it('returns null for a key that was never set', async () => {
    const cache = new InMemoryQueryCache();
    expect(await cache.get('missing')).toBeNull();
  });

  it('returns the stored value within TTL', async () => {
    const cache = new InMemoryQueryCache();
    await cache.set('key1', { data: 'hello' }, 60);
    expect(await cache.get('key1')).toEqual({ data: 'hello' });
  });

  it('returns null after TTL expires', async () => {
    const cache = new InMemoryQueryCache();

    // Freeze time then advance it
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await cache.set('key2', 'value', 1); // 1 second TTL

    // Advance time beyond TTL
    vi.spyOn(Date, 'now').mockReturnValue(now + 2000);

    expect(await cache.get('key2')).toBeNull();
    vi.restoreAllMocks();
  });

  it('removes the expired entry from the store on get', async () => {
    const cache = new InMemoryQueryCache();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await cache.set('key3', 'value', 1);
    expect(cache.size).toBe(1);

    vi.spyOn(Date, 'now').mockReturnValue(now + 2000);
    await cache.get('key3');

    expect(cache.size).toBe(0);
    vi.restoreAllMocks();
  });

  it('invalidate removes a specific key', async () => {
    const cache = new InMemoryQueryCache();
    await cache.set('a', 1, 60);
    await cache.set('b', 2, 60);

    await cache.invalidate('a');

    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).toBe(2);
  });

  it('invalidatePrefix removes all matching keys', async () => {
    const cache = new InMemoryQueryCache();
    await cache.set('tenant1:listRuns:ws-1', 'runs1', 60);
    await cache.set('tenant1:listRuns:ws-2', 'runs2', 60);
    await cache.set('tenant1:getRun:run-1', 'run1', 60);
    await cache.set('tenant2:listRuns:ws-1', 'runs-other', 60);

    await cache.invalidatePrefix('tenant1:listRuns:');

    expect(await cache.get('tenant1:listRuns:ws-1')).toBeNull();
    expect(await cache.get('tenant1:listRuns:ws-2')).toBeNull();
    // Other prefixes not affected
    expect(await cache.get('tenant1:getRun:run-1')).toBe('run1');
    expect(await cache.get('tenant2:listRuns:ws-1')).toBe('runs-other');
  });

  it('invalidatePrefix is a no-op when no keys match', async () => {
    const cache = new InMemoryQueryCache();
    await cache.set('x:key', 'value', 60);
    await cache.invalidatePrefix('y:');
    expect(cache.size).toBe(1);
  });

  it('clear removes all entries', async () => {
    const cache = new InMemoryQueryCache();
    await cache.set('a', 1, 60);
    await cache.set('b', 2, 60);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('overwriting a key updates the value and TTL', async () => {
    const cache = new InMemoryQueryCache();
    await cache.set('key', 'old', 60);
    await cache.set('key', 'new', 60);
    expect(await cache.get('key')).toBe('new');
    expect(cache.size).toBe(1);
  });
});

/**
 * In-memory cache-aside implementation of QueryCache.
 * For production use a Redis adapter; this implementation
 * covers local-dev and test environments.
 * Bead: bead-0315
 */
import type { QueryCache } from '../../application/ports/query-cache.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Date.now() + ttl * 1000
}

export class InMemoryQueryCache implements QueryCache {
  readonly #store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.#store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.#store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.#store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async invalidate(key: string): Promise<void> {
    this.#store.delete(key);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    for (const key of this.#store.keys()) {
      if (key.startsWith(prefix)) this.#store.delete(key);
    }
  }

  /** Expose for testing */
  get size(): number {
    return this.#store.size;
  }

  clear(): void {
    this.#store.clear();
  }
}

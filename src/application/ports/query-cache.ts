/**
 * Cache-aside query cache port.
 * Implementations are short-lived TTL caches, NOT sources of truth.
 * Bead: bead-0315
 */

export interface QueryCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePrefix(prefix: string): Promise<void>;
}

/** Build a tenant-scoped cache key for a query */
export function queryCacheKey(tenantId: string, handler: string, ...parts: string[]): string {
  return `${tenantId}:${handler}:${parts.join(':')}`;
}

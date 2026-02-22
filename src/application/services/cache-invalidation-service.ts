/**
 * Subscribes to domain events and invalidates query cache entries.
 * Call after command handlers emit events.
 * Bead: bead-0315
 */
import type { QueryCache } from '../ports/query-cache.js';

export class CacheInvalidationService {
  constructor(private readonly cache: QueryCache) {}

  async onRunChanged(tenantId: string, _workspaceId: string): Promise<void> {
    await this.cache.invalidatePrefix(`${tenantId}:listRuns:`);
    await this.cache.invalidatePrefix(`${tenantId}:getRun:`);
  }

  async onWorkspaceChanged(tenantId: string): Promise<void> {
    await this.cache.invalidatePrefix(`${tenantId}:listWorkspaces:`);
    await this.cache.invalidatePrefix(`${tenantId}:getWorkspace:`);
  }
}

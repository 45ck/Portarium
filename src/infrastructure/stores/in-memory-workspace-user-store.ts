import type { WorkspaceUserStore } from '../../application/ports/workspace-user-store.js';
import { clampLimit, type Page, type PaginationParams } from '../../application/common/query.js';
import type { TenantId, UserId, WorkspaceId } from '../../domain/primitives/index.js';
import type { WorkspaceUserV1 } from '../../domain/users/index.js';

export class InMemoryWorkspaceUserStore implements WorkspaceUserStore {
  readonly #store = new Map<string, WorkspaceUserV1>();

  async listWorkspaceUsers(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    pagination: PaginationParams = {},
  ): Promise<Page<WorkspaceUserV1>> {
    const prefix = `${String(tenantId)}::${String(workspaceId)}::`;
    const limit = clampLimit(pagination.limit);
    const rows = [...this.#store.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, user]) => user)
      .filter((user) => (pagination.cursor ? String(user.userId) > pagination.cursor : true))
      .sort((left, right) => String(left.userId).localeCompare(String(right.userId)));

    const items = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    return {
      items,
      ...(hasMore && items.length > 0
        ? { nextCursor: String(items[items.length - 1]!.userId) }
        : {}),
    };
  }

  async getWorkspaceUserById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<WorkspaceUserV1 | null> {
    return this.#store.get(this.#key(tenantId, workspaceId, userId)) ?? null;
  }

  async saveWorkspaceUser(tenantId: TenantId, user: WorkspaceUserV1): Promise<void> {
    this.#store.set(this.#key(tenantId, user.workspaceId, user.userId), user);
  }

  async removeWorkspaceUser(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<void> {
    this.#store.delete(this.#key(tenantId, workspaceId, userId));
  }

  #key(tenantId: TenantId, workspaceId: WorkspaceId, userId: UserId): string {
    return `${String(tenantId)}::${String(workspaceId)}::${String(userId)}`;
  }
}

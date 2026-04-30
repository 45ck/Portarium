import type { TenantId, WorkforceQueueId, WorkspaceId } from '../../domain/primitives/index.js';
import type { WorkforceCapability, WorkforceQueueV1 } from '../../domain/workforce/index.js';

export type ListWorkforceQueuesFilter = Readonly<{
  workspaceId: WorkspaceId | string;
  capability?: WorkforceCapability | string;
  limit?: number;
  cursor?: string;
}>;

export type WorkforceQueueListPage = Readonly<{
  items: readonly WorkforceQueueV1[];
  nextCursor?: string;
}>;

export interface WorkforceQueueStore {
  getWorkforceQueueById(
    tenantId: TenantId,
    workforceQueueId: WorkforceQueueId,
    workspaceId?: WorkspaceId | string,
  ): Promise<WorkforceQueueV1 | null>;

  listWorkforceQueues?(
    tenantId: TenantId,
    filter: ListWorkforceQueuesFilter,
  ): Promise<WorkforceQueueListPage>;

  saveWorkforceQueue?(
    tenantId: TenantId,
    queue: WorkforceQueueV1,
    workspaceId?: WorkspaceId | string,
  ): Promise<void>;
}

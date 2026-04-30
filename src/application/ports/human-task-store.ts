import type { HumanTaskId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { HumanTaskStatus, HumanTaskV1 } from '../../domain/workforce/index.js';

export type ListHumanTasksFilter = Readonly<{
  workspaceId: WorkspaceId | string;
  assigneeId?: string;
  status?: HumanTaskStatus;
  runId?: string;
  limit?: number;
  cursor?: string;
}>;

export type HumanTaskListPage = Readonly<{
  items: readonly HumanTaskV1[];
  nextCursor?: string;
}>;

export interface HumanTaskStore {
  getHumanTaskById(
    tenantId: TenantId,
    humanTaskId: HumanTaskId,
    workspaceId?: WorkspaceId | string,
  ): Promise<HumanTaskV1 | null>;

  saveHumanTask(
    tenantId: TenantId,
    task: HumanTaskV1,
    workspaceId?: WorkspaceId | string,
  ): Promise<void>;

  listHumanTasks?(tenantId: TenantId, filter: ListHumanTasksFilter): Promise<HumanTaskListPage>;
}

import type {
  HumanTaskListPage,
  HumanTaskStore,
  ListHumanTasksFilter,
  ListWorkforceMembersFilter,
  ListWorkforceQueuesFilter,
  WorkforceMemberListPage,
  WorkforceMemberStore,
  WorkforceQueueListPage,
  WorkforceQueueStore,
} from '../../application/ports/index.js';
import type {
  HumanTaskV1,
  WorkforceMemberV1,
  WorkforceQueueV1,
} from '../../domain/workforce/index.js';

type StoredHumanTask = Readonly<{ workspaceId: string; task: HumanTaskV1 }>;

export class InMemoryWorkforceMemberStore implements WorkforceMemberStore {
  readonly #members = new Map<string, WorkforceMemberV1>();

  public constructor(seed: readonly WorkforceMemberV1[] = []) {
    for (const member of seed) {
      this.#members.set(
        memberKey(String(member.tenantId), String(member.workforceMemberId)),
        member,
      );
    }
  }

  public async getWorkforceMemberById(
    tenantId: string,
    workforceMemberId: string,
    workspaceId?: string,
  ): Promise<WorkforceMemberV1 | null> {
    const member =
      this.#members.get(memberKey(String(tenantId), String(workforceMemberId))) ?? null;
    if (member === null) return null;
    if (workspaceId && String(member.tenantId) !== String(workspaceId)) return null;
    return member;
  }

  public async listWorkforceMembersByIds(
    tenantId: string,
    workforceMemberIds: readonly string[],
    workspaceId?: string,
  ): Promise<readonly WorkforceMemberV1[]> {
    const loaded = await Promise.all(
      workforceMemberIds.map((id) => this.getWorkforceMemberById(tenantId, id, workspaceId)),
    );
    return loaded.filter((member): member is WorkforceMemberV1 => member !== null);
  }

  public async listWorkforceMembers(
    tenantId: string,
    filter: ListWorkforceMembersFilter,
  ): Promise<WorkforceMemberListPage> {
    const items = [...this.#members.values()]
      .filter((member) => String(member.tenantId) === String(filter.workspaceId))
      .filter((member) => String(member.tenantId) === String(tenantId))
      .filter((member) => matchesMember(member, filter))
      .sort((left, right) =>
        String(left.workforceMemberId).localeCompare(String(right.workforceMemberId)),
      );
    return pageById(
      items,
      (member) => String(member.workforceMemberId),
      filter.limit,
      filter.cursor,
    );
  }

  public async saveWorkforceMember(
    tenantId: string,
    member: WorkforceMemberV1,
    workspaceId?: string,
  ): Promise<void> {
    if (workspaceId && String(member.tenantId) !== String(workspaceId)) {
      throw new Error('WorkforceMember tenantId must match workspaceId.');
    }
    this.#members.set(memberKey(String(tenantId), String(member.workforceMemberId)), member);
  }
}

export class InMemoryWorkforceQueueStore implements WorkforceQueueStore {
  readonly #queues = new Map<string, WorkforceQueueV1>();

  public constructor(seed: readonly WorkforceQueueV1[] = []) {
    for (const queue of seed) {
      this.#queues.set(queueKey(String(queue.tenantId), String(queue.workforceQueueId)), queue);
    }
  }

  public async getWorkforceQueueById(
    tenantId: string,
    workforceQueueId: string,
    workspaceId?: string,
  ): Promise<WorkforceQueueV1 | null> {
    const queue = this.#queues.get(queueKey(String(tenantId), String(workforceQueueId))) ?? null;
    if (queue === null) return null;
    if (workspaceId && String(queue.tenantId) !== String(workspaceId)) return null;
    return queue;
  }

  public async listWorkforceQueues(
    tenantId: string,
    filter: ListWorkforceQueuesFilter,
  ): Promise<WorkforceQueueListPage> {
    const items = [...this.#queues.values()]
      .filter((queue) => String(queue.tenantId) === String(filter.workspaceId))
      .filter((queue) => String(queue.tenantId) === String(tenantId))
      .filter((queue) => matchesQueue(queue, filter))
      .sort((left, right) =>
        String(left.workforceQueueId).localeCompare(String(right.workforceQueueId)),
      );
    return pageById(items, (queue) => String(queue.workforceQueueId), filter.limit, filter.cursor);
  }

  public async saveWorkforceQueue(
    tenantId: string,
    queue: WorkforceQueueV1,
    workspaceId?: string,
  ): Promise<void> {
    if (workspaceId && String(queue.tenantId) !== String(workspaceId)) {
      throw new Error('WorkforceQueue tenantId must match workspaceId.');
    }
    this.#queues.set(queueKey(String(tenantId), String(queue.workforceQueueId)), queue);
  }
}

export class InMemoryHumanTaskStore implements HumanTaskStore {
  readonly #tasks = new Map<string, StoredHumanTask>();

  public constructor(seed: readonly StoredHumanTask[] = []) {
    for (const entry of seed) {
      this.#tasks.set(taskKey(entry.workspaceId, String(entry.task.humanTaskId)), entry);
    }
  }

  public async getHumanTaskById(
    tenantId: string,
    humanTaskId: string,
    workspaceId?: string,
  ): Promise<HumanTaskV1 | null> {
    const key = taskKey(String(workspaceId ?? tenantId), String(humanTaskId));
    const stored = this.#tasks.get(key) ?? null;
    if (stored === null) return null;
    if (String(stored.workspaceId) !== String(workspaceId ?? tenantId)) return null;
    return stored.task;
  }

  public async saveHumanTask(
    tenantId: string,
    task: HumanTaskV1,
    workspaceId?: string,
  ): Promise<void> {
    const resolvedWorkspaceId = String(workspaceId ?? tenantId);
    this.#tasks.set(taskKey(resolvedWorkspaceId, String(task.humanTaskId)), {
      workspaceId: resolvedWorkspaceId,
      task,
    });
  }

  public async listHumanTasks(
    tenantId: string,
    filter: ListHumanTasksFilter,
  ): Promise<HumanTaskListPage> {
    const items = [...this.#tasks.values()]
      .filter((entry) => String(entry.workspaceId) === String(filter.workspaceId))
      .filter((entry) => String(entry.workspaceId) === String(tenantId))
      .map((entry) => entry.task)
      .filter((task) => matchesTask(task, filter))
      .sort((left, right) => String(left.humanTaskId).localeCompare(String(right.humanTaskId)));
    return pageById(items, (task) => String(task.humanTaskId), filter.limit, filter.cursor);
  }
}

function memberKey(tenantId: string, workforceMemberId: string): string {
  return `${tenantId}:${workforceMemberId}`;
}

function queueKey(tenantId: string, workforceQueueId: string): string {
  return `${tenantId}:${workforceQueueId}`;
}

function taskKey(workspaceId: string, humanTaskId: string): string {
  return `${workspaceId}:${humanTaskId}`;
}

function matchesMember(member: WorkforceMemberV1, filter: ListWorkforceMembersFilter): boolean {
  if (
    filter.capability &&
    !member.capabilities.some((capability) => capability === filter.capability)
  ) {
    return false;
  }
  if (
    filter.queueId &&
    !member.queueMemberships.some((queueId) => String(queueId) === filter.queueId)
  ) {
    return false;
  }
  if (filter.availability && member.availabilityStatus !== filter.availability) return false;
  return true;
}

function matchesQueue(queue: WorkforceQueueV1, filter: ListWorkforceQueuesFilter): boolean {
  if (
    filter.capability &&
    !queue.requiredCapabilities.some((capability) => capability === filter.capability)
  ) {
    return false;
  }
  return true;
}

function matchesTask(task: HumanTaskV1, filter: ListHumanTasksFilter): boolean {
  if (filter.assigneeId && String(task.assigneeId ?? '') !== filter.assigneeId) return false;
  if (filter.status && task.status !== filter.status) return false;
  if (filter.runId && String(task.runId) !== filter.runId) return false;
  return true;
}

function pageById<T>(
  items: readonly T[],
  idOf: (item: T) => string,
  limit?: number,
  cursor?: string,
): { items: readonly T[]; nextCursor?: string } {
  const safeLimit = limit && Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;
  const startIndex = cursor ? Math.max(0, items.findIndex((item) => idOf(item) === cursor) + 1) : 0;
  const pageItems = items.slice(startIndex, startIndex + safeLimit);
  const nextCursor =
    startIndex + safeLimit < items.length ? idOf(pageItems[pageItems.length - 1]!) : undefined;
  return { items: pageItems, ...(nextCursor ? { nextCursor } : {}) };
}

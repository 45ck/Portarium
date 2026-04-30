import type {
  HumanTaskStore,
  ListHumanTasksFilter,
  ListWorkforceMembersFilter,
  ListWorkforceQueuesFilter,
  ListWorkItemsFilter,
  WorkItemStore,
  WorkforceMemberStore,
  WorkforceQueueStore,
  WorkItemListPage,
} from '../../application/ports/index.js';
import type { HumanTaskV1 } from '../../domain/workforce/human-task-v1.js';
import { parseHumanTaskV1 } from '../../domain/workforce/human-task-v1.js';
import type { WorkforceMemberV1 } from '../../domain/workforce/workforce-member-v1.js';
import { parseWorkforceMemberV1 } from '../../domain/workforce/workforce-member-v1.js';
import { parseWorkforceQueueV1 } from '../../domain/workforce/workforce-queue-v1.js';
import type { WorkItemV1 } from '../../domain/work-items/work-item-v1.js';
import { parseWorkItemV1 } from '../../domain/work-items/work-item-v1.js';
import { PostgresJsonDocumentStore } from './postgres-json-document-store.js';
import type { SqlClient } from './sql-client.js';

const COLLECTION_WORK_ITEMS = 'work-items';
const COLLECTION_WORKFORCE_MEMBERS = 'workforce-members';
const COLLECTION_HUMAN_TASKS = 'human-tasks';
const COLLECTION_WORKFORCE_QUEUES = 'workforce-queues';

export class PostgresWorkItemStore implements WorkItemStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getWorkItemById(
    tenantId: string,
    workspaceId: string,
    workItemId: string,
  ): Promise<WorkItemV1 | null> {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_WORK_ITEMS,
      String(workItemId),
    );
    if (payload === null) {
      return null;
    }
    const parsed = parseWorkItemV1(payload);
    return String(parsed.workspaceId) === String(workspaceId) ? parsed : null;
  }

  public async listWorkItems(
    tenantId: string,
    workspaceId: string,
    filter: ListWorkItemsFilter,
  ): Promise<WorkItemListPage> {
    const offset = cursorToOffset(filter.cursor);
    const limit = normalizeLimit(filter.limit);
    // Fetch only the rows needed: offset + limit + 1 (to detect next page),
    // capped at a safety maximum to prevent full-collection scans.
    const sqlLimit = Math.min(offset + limit + 1, normalizeLimit(undefined) * 4 + 1);
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId),
      collection: COLLECTION_WORK_ITEMS,
      limit: sqlLimit,
    });

    const sorted = payloads
      .map((payload) => parseWorkItemV1(payload))
      .filter((item) => matchesWorkItemFilter(item, filter))
      .sort((left, right) => String(left.workItemId).localeCompare(String(right.workItemId)));

    const pageItems = sorted.slice(offset, offset + limit);
    const nextCursor = offset + limit < sorted.length ? String(offset + limit) : undefined;

    return {
      items: pageItems,
      ...(nextCursor ? { nextCursor } : {}),
    };
  }

  public saveWorkItem(tenantId: string, workItem: WorkItemV1): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(tenantId),
      workspaceId: String(workItem.workspaceId),
      collection: COLLECTION_WORK_ITEMS,
      documentId: String(workItem.workItemId),
      payload: workItem,
    });
  }
}

export class PostgresWorkforceMemberStore implements WorkforceMemberStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getWorkforceMemberById(
    tenantId: string,
    workforceMemberId: string,
    workspaceId?: string,
  ): Promise<WorkforceMemberV1 | null> {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_WORKFORCE_MEMBERS,
      String(workforceMemberId),
      workspaceId ? String(workspaceId) : undefined,
    );
    return payload === null ? null : parseWorkforceMemberV1(payload);
  }

  public async listWorkforceMembersByIds(
    tenantId: string,
    workforceMemberIds: readonly string[],
    workspaceId?: string,
  ) {
    const payloads = await this.#documents.listByIds(
      String(tenantId),
      COLLECTION_WORKFORCE_MEMBERS,
      workforceMemberIds.map(String),
      workspaceId ? String(workspaceId) : undefined,
    );
    return payloads.map(parseWorkforceMemberV1);
  }

  public async listWorkforceMembers(
    tenantId: string,
    filter: ListWorkforceMembersFilter,
  ): Promise<WorkforceMemberListPage> {
    const pageLimit = normalizeLimit(filter.limit);
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(filter.workspaceId),
      collection: COLLECTION_WORKFORCE_MEMBERS,
      limit: pageLimit + 1,
      ...(filter.cursor ? { afterId: filter.cursor } : {}),
    });
    const members = payloads
      .map(parseWorkforceMemberV1)
      .filter((member) => matchesWorkforceMember(member, filter))
      .sort((left, right) =>
        String(left.workforceMemberId).localeCompare(String(right.workforceMemberId)),
      );
    const items = members.slice(0, pageLimit);
    const nextCursor =
      members.length > pageLimit ? String(items[items.length - 1]?.workforceMemberId) : undefined;
    return { items, ...(nextCursor ? { nextCursor } : {}) };
  }

  public saveWorkforceMember(
    tenantId: string,
    member: WorkforceMemberV1,
    workspaceId?: string,
  ): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId ?? member.tenantId),
      collection: COLLECTION_WORKFORCE_MEMBERS,
      documentId: String(member.workforceMemberId),
      payload: member,
    });
  }
}

export class PostgresHumanTaskStore implements HumanTaskStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getHumanTaskById(
    tenantId: string,
    humanTaskId: string,
    workspaceId?: string,
  ): Promise<HumanTaskV1 | null> {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_HUMAN_TASKS,
      String(humanTaskId),
      workspaceId ? String(workspaceId) : undefined,
    );
    return payload === null ? null : parseHumanTaskV1(payload);
  }

  public saveHumanTask(tenantId: string, task: HumanTaskV1, workspaceId?: string): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId ?? tenantId),
      collection: COLLECTION_HUMAN_TASKS,
      documentId: String(task.humanTaskId),
      payload: task,
    });
  }

  public async listHumanTasks(
    tenantId: string,
    filter: ListHumanTasksFilter,
  ): Promise<HumanTaskListPage> {
    const pageLimit = normalizeLimit(filter.limit);
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(filter.workspaceId),
      collection: COLLECTION_HUMAN_TASKS,
      limit: pageLimit + 1,
      ...(filter.cursor ? { afterId: filter.cursor } : {}),
    });
    const tasks = payloads
      .map(parseHumanTaskV1)
      .filter((task) => matchesHumanTask(task, filter))
      .sort((left, right) => String(left.humanTaskId).localeCompare(String(right.humanTaskId)));
    const items = tasks.slice(0, pageLimit);
    const nextCursor =
      tasks.length > pageLimit ? String(items[items.length - 1]?.humanTaskId) : undefined;
    return { items, ...(nextCursor ? { nextCursor } : {}) };
  }
}

export class PostgresWorkforceQueueStore implements WorkforceQueueStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getWorkforceQueueById(
    tenantId: string,
    workforceQueueId: string,
    workspaceId?: string,
  ) {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_WORKFORCE_QUEUES,
      String(workforceQueueId),
      workspaceId ? String(workspaceId) : undefined,
    );
    return payload === null ? null : parseWorkforceQueueV1(payload);
  }

  public async listWorkforceQueues(
    tenantId: string,
    filter: ListWorkforceQueuesFilter,
  ): Promise<WorkforceQueueListPage> {
    const pageLimit = normalizeLimit(filter.limit);
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(filter.workspaceId),
      collection: COLLECTION_WORKFORCE_QUEUES,
      limit: pageLimit + 1,
      ...(filter.cursor ? { afterId: filter.cursor } : {}),
    });
    const queues = payloads
      .map(parseWorkforceQueueV1)
      .filter((queue) => matchesWorkforceQueue(queue, filter))
      .sort((left, right) =>
        String(left.workforceQueueId).localeCompare(String(right.workforceQueueId)),
      );
    const items = queues.slice(0, pageLimit);
    const nextCursor =
      queues.length > pageLimit ? String(items[items.length - 1]?.workforceQueueId) : undefined;
    return { items, ...(nextCursor ? { nextCursor } : {}) };
  }

  public saveWorkforceQueue(
    tenantId: string,
    queue: ReturnType<typeof parseWorkforceQueueV1>,
    workspaceId?: string,
  ): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId ?? queue.tenantId),
      collection: COLLECTION_WORKFORCE_QUEUES,
      documentId: String(queue.workforceQueueId),
      payload: queue,
    });
  }
}

type WorkforceMemberListPage = Awaited<
  ReturnType<NonNullable<WorkforceMemberStore['listWorkforceMembers']>>
>;
type HumanTaskListPage = Awaited<ReturnType<NonNullable<HumanTaskStore['listHumanTasks']>>>;
type WorkforceQueueListPage = Awaited<
  ReturnType<NonNullable<WorkforceQueueStore['listWorkforceQueues']>>
>;

function matchesWorkforceMember(
  member: WorkforceMemberV1,
  filter: ListWorkforceMembersFilter,
): boolean {
  if (filter.capability && !member.capabilities.includes(filter.capability as never)) return false;
  if (filter.queueId && !member.queueMemberships.some((id) => String(id) === filter.queueId)) {
    return false;
  }
  if (filter.availability && member.availabilityStatus !== filter.availability) return false;
  return true;
}

function matchesHumanTask(task: HumanTaskV1, filter: ListHumanTasksFilter): boolean {
  if (filter.assigneeId && String(task.assigneeId ?? '') !== filter.assigneeId) return false;
  if (filter.status && task.status !== filter.status) return false;
  if (filter.runId && String(task.runId) !== filter.runId) return false;
  return true;
}

function matchesWorkforceQueue(
  queue: ReturnType<typeof parseWorkforceQueueV1>,
  filter: ListWorkforceQueuesFilter,
): boolean {
  if (filter.capability && !queue.requiredCapabilities.includes(filter.capability as never)) {
    return false;
  }
  return true;
}

function matchesWorkItemFilter(item: WorkItemV1, filter: ListWorkItemsFilter): boolean {
  if (filter.status && item.status !== filter.status) {
    return false;
  }
  if (filter.ownerUserId && String(item.ownerUserId ?? '') !== String(filter.ownerUserId)) {
    return false;
  }
  return (
    matchLink(item, 'runIds', filter.runId) &&
    matchLink(item, 'workflowIds', filter.workflowId) &&
    matchLink(item, 'approvalIds', filter.approvalId) &&
    matchLink(item, 'evidenceIds', filter.evidenceId)
  );
}

function matchLink(
  item: WorkItemV1,
  key: 'runIds' | 'workflowIds' | 'approvalIds' | 'evidenceIds',
  value: string | undefined,
): boolean {
  if (value === undefined) {
    return true;
  }
  const links = item.links?.[key];
  if (!Array.isArray(links)) {
    return false;
  }
  return links.some((entry) => String(entry) === String(value));
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 50;
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer when provided.');
  }
  return Math.min(limit, 200);
}

function cursorToOffset(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }
  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

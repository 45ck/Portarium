import type {
  HumanTaskStore,
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
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId),
      collection: COLLECTION_WORK_ITEMS,
    });

    const sorted = payloads
      .map((payload) => parseWorkItemV1(payload))
      .filter((item) => matchesWorkItemFilter(item, filter))
      .sort((left, right) => String(left.workItemId).localeCompare(String(right.workItemId)));

    const offset = cursorToOffset(filter.cursor);
    const limit = normalizeLimit(filter.limit);
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
  ): Promise<WorkforceMemberV1 | null> {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_WORKFORCE_MEMBERS,
      String(workforceMemberId),
    );
    return payload === null ? null : parseWorkforceMemberV1(payload);
  }

  public async listWorkforceMembersByIds(tenantId: string, workforceMemberIds: readonly string[]) {
    const payloads = await this.#documents.listByIds(
      String(tenantId),
      COLLECTION_WORKFORCE_MEMBERS,
      workforceMemberIds.map(String),
    );
    return payloads.map(parseWorkforceMemberV1);
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
  ): Promise<HumanTaskV1 | null> {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_HUMAN_TASKS,
      String(humanTaskId),
    );
    return payload === null ? null : parseHumanTaskV1(payload);
  }

  public saveHumanTask(tenantId: string, task: HumanTaskV1): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(tenantId),
      collection: COLLECTION_HUMAN_TASKS,
      documentId: String(task.humanTaskId),
      payload: task,
    });
  }
}

export class PostgresWorkforceQueueStore implements WorkforceQueueStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getWorkforceQueueById(tenantId: string, workforceQueueId: string) {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_WORKFORCE_QUEUES,
      String(workforceQueueId),
    );
    return payload === null ? null : parseWorkforceQueueV1(payload);
  }
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

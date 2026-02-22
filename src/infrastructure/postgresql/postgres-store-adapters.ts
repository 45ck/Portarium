import type {
  AdapterRegistrationStore,
  ApprovalListPage,
  ApprovalQueryStore,
  ApprovalStore,
  IdempotencyKey,
  IdempotencyStore,
  ListApprovalsFilter,
  ListRunsQuery,
  ListWorkspacesFilter,
  PolicyStore,
  RunQueryStore,
  RunStore,
  WorkspaceListPage,
  WorkspaceQueryStore,
  WorkflowStore,
  WorkspaceStore,
} from '../../application/ports/index.js';
import type { Page } from '../../application/common/query.js';
import { clampLimit, MAX_LIMIT } from '../../application/common/query.js';
import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import type { ApprovalV1 } from '../../domain/approvals/approval-v1.js';
import { parseApprovalV1 } from '../../domain/approvals/approval-v1.js';
import { parsePolicyV1 } from '../../domain/policy/policy-v1.js';
import type { RunV1 } from '../../domain/runs/run-v1.js';
import { parseRunV1 } from '../../domain/runs/run-v1.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import type { WorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { pageByCursor } from './postgres-cursor-page.js';
import { PostgresJsonDocumentStore } from './postgres-json-document-store.js';
import type { SqlClient } from './sql-client.js';

const COLLECTION_WORKSPACES = 'workspaces';
const COLLECTION_RUNS = 'runs';
const COLLECTION_WORKFLOWS = 'workflows';
const COLLECTION_ADAPTER_REGISTRATIONS = 'adapter-registrations';
const COLLECTION_APPROVALS = 'approvals';
const COLLECTION_POLICIES = 'policies';
const COLLECTION_IDEMPOTENCY = 'idempotency';

export class PostgresWorkspaceStore implements WorkspaceStore, WorkspaceQueryStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getWorkspaceById(
    tenantId: string,
    workspaceId: string,
  ): Promise<WorkspaceV1 | null> {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_WORKSPACES,
      String(workspaceId),
    );
    return payload === null ? null : parseWorkspaceV1(payload);
  }

  public async getWorkspaceByName(
    tenantId: string,
    workspaceName: string,
  ): Promise<WorkspaceV1 | null> {
    // Fetch up to MAX_LIMIT workspaces; workspace names are expected to be
    // unique per tenant so a match will be found within the first page.
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      collection: COLLECTION_WORKSPACES,
      limit: MAX_LIMIT,
    });

    const found = payloads
      .map((payload) => parseWorkspaceV1(payload))
      .find((workspace) => workspace.name === workspaceName);

    return found ?? null;
  }

  public saveWorkspace(workspace: WorkspaceV1): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(workspace.tenantId),
      workspaceId: String(workspace.workspaceId),
      collection: COLLECTION_WORKSPACES,
      documentId: String(workspace.workspaceId),
      payload: workspace,
    });
  }

  public async listWorkspaces(
    tenantId: string,
    filter: ListWorkspacesFilter,
  ): Promise<WorkspaceListPage> {
    const pageLimit = clampLimit(filter.limit);
    // Fetch limit+1 to detect next page; use SQL cursor when no text search.
    const afterId = !filter.nameQuery && filter.cursor ? filter.cursor : undefined;
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      collection: COLLECTION_WORKSPACES,
      ...(afterId !== undefined ? { afterId } : {}),
      limit: filter.nameQuery ? MAX_LIMIT : pageLimit + 1,
    });

    const byName = filter.nameQuery?.toLowerCase();
    const items = payloads
      .map((payload) => parseWorkspaceV1(payload))
      .filter((workspace) => (byName ? workspace.name.toLowerCase().includes(byName) : true))
      .sort((left, right) => String(left.workspaceId).localeCompare(String(right.workspaceId)));

    // When no nameQuery the SQL cursor already filtered by afterId, so pass
    // undefined cursor to pageByCursor to avoid double-filtering.
    const jsCursor = filter.nameQuery ? filter.cursor : undefined;
    return pageByCursor(items, String, pageLimit, jsCursor);
  }
}

export class PostgresRunStore implements RunStore, RunQueryStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getRunById(
    tenantId: string,
    workspaceId: string,
    runId: string,
  ): Promise<RunV1 | null> {
    const payload = await this.#documents.get(String(tenantId), COLLECTION_RUNS, String(runId));
    if (payload === null) {
      return null;
    }
    const parsed = parseRunV1(payload);
    return String(parsed.workspaceId) === String(workspaceId) ? parsed : null;
  }

  public saveRun(tenantId: string, run: RunV1): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(tenantId),
      workspaceId: String(run.workspaceId),
      collection: COLLECTION_RUNS,
      documentId: String(run.runId),
      payload: run,
    });
  }

  public async listRuns(
    tenantId: string,
    workspaceId: string,
    query: ListRunsQuery,
  ): Promise<Page<RunV1>> {
    const pageLimit = clampLimit(query.pagination.limit);
    // Fetch more than the page size to account for JS-side field filtering;
    // MAX_LIMIT+1 is a practical cap that prevents full-collection scans.
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId),
      collection: COLLECTION_RUNS,
      limit: MAX_LIMIT + 1,
    });

    const { filter } = query;
    let items = payloads
      .map((payload) => parseRunV1(payload))
      .filter((run) => matchRunFieldFilter(run, filter));

    // Full-text search across key fields
    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter(
        (run) =>
          String(run.runId).toLowerCase().includes(term) ||
          String(run.workflowId).toLowerCase().includes(term) ||
          String(run.correlationId).toLowerCase().includes(term),
      );
    }

    // Sort
    if (query.sort) {
      const { field, direction } = query.sort;
      const dir = direction === 'desc' ? -1 : 1;
      const toSortValue = (value: unknown): string =>
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
          ? String(value)
          : '';
      items.sort((a, b) => {
        const va = toSortValue((a as Record<string, unknown>)[field]);
        const vb = toSortValue((b as Record<string, unknown>)[field]);
        return va.localeCompare(vb) * dir;
      });
    } else {
      items.sort((a, b) => String(a.runId).localeCompare(String(b.runId)));
    }

    return pageByCursor(items, (run) => String(run.runId), pageLimit, query.pagination.cursor);
  }
}

export class PostgresWorkflowStore implements WorkflowStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getWorkflowById(tenantId: string, workspaceId: string, workflowId: string) {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_WORKFLOWS,
      String(workflowId),
    );
    if (payload === null) {
      return null;
    }
    const parsed = parseWorkflowV1(payload);
    return String(parsed.workspaceId) === String(workspaceId) ? parsed : null;
  }

  public async listWorkflowsByName(tenantId: string, workspaceId: string, workflowName: string) {
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId),
      collection: COLLECTION_WORKFLOWS,
      limit: MAX_LIMIT,
    });

    return payloads
      .map((payload) => parseWorkflowV1(payload))
      .filter((workflow) => workflow.name === workflowName);
  }
}

export class PostgresAdapterRegistrationStore implements AdapterRegistrationStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async listByWorkspace(tenantId: string, workspaceId: string) {
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId),
      collection: COLLECTION_ADAPTER_REGISTRATIONS,
      limit: MAX_LIMIT,
    });
    return payloads.map((payload) => parseAdapterRegistrationV1(payload));
  }
}

export class PostgresApprovalStore implements ApprovalStore, ApprovalQueryStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getApprovalById(tenantId: string, workspaceId: string, approvalId: string) {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_APPROVALS,
      String(approvalId),
    );
    if (payload === null) {
      return null;
    }
    const parsed = parseApprovalV1(payload);
    return String(parsed.workspaceId) === String(workspaceId) ? parsed : null;
  }

  public saveApproval(tenantId: string, approval: ApprovalV1): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(tenantId),
      workspaceId: String(approval.workspaceId),
      collection: COLLECTION_APPROVALS,
      documentId: String(approval.approvalId),
      payload: approval,
    });
  }

  public async listApprovals(
    tenantId: string,
    workspaceId: string,
    filter: ListApprovalsFilter,
  ): Promise<ApprovalListPage> {
    // Fetch MAX_LIMIT+1 to allow JS-side filtering while still capping the scan.
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      workspaceId: String(workspaceId),
      collection: COLLECTION_APPROVALS,
      limit: MAX_LIMIT + 1,
    });

    const items = payloads
      .map((payload) => parseApprovalV1(payload))
      .filter((approval) => matchApprovalFilter(approval, filter))
      .sort((left, right) => String(left.approvalId).localeCompare(String(right.approvalId)));

    return pageByCursor(
      items,
      (approval) => String(approval.approvalId),
      filter.limit,
      filter.cursor,
    );
  }
}

export class PostgresPolicyStore implements PolicyStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getPolicyById(tenantId: string, workspaceId: string, policyId: string) {
    const payload = await this.#documents.get(
      String(tenantId),
      COLLECTION_POLICIES,
      String(policyId),
    );
    if (payload === null) {
      return null;
    }
    const parsed = parsePolicyV1(payload);
    return String(parsed.workspaceId) === String(workspaceId) ? parsed : null;
  }
}

export class PostgresIdempotencyStore implements IdempotencyStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async get<T>(key: IdempotencyKey): Promise<T | null> {
    const payload = await this.#documents.get(
      String(key.tenantId),
      COLLECTION_IDEMPOTENCY,
      formatIdempotencyDocumentId(key),
    );
    return payload === null ? null : (payload as T);
  }

  public set<T>(key: IdempotencyKey, value: T): Promise<void> {
    return this.#documents.upsert({
      tenantId: String(key.tenantId),
      collection: COLLECTION_IDEMPOTENCY,
      documentId: formatIdempotencyDocumentId(key),
      payload: value,
    });
  }
}

function formatIdempotencyDocumentId(key: IdempotencyKey): string {
  return `${key.commandName}:${key.requestKey}`;
}

function matchRunFieldFilter(
  run: RunV1,
  filter: Readonly<{
    status?: string;
    workflowId?: string;
    initiatedByUserId?: string;
    correlationId?: string;
  }>,
): boolean {
  if (filter.status && run.status !== filter.status) return false;
  if (filter.workflowId && String(run.workflowId) !== String(filter.workflowId)) return false;
  if (
    filter.initiatedByUserId &&
    String(run.initiatedByUserId) !== String(filter.initiatedByUserId)
  ) {
    return false;
  }
  if (filter.correlationId && String(run.correlationId) !== String(filter.correlationId))
    return false;
  return true;
}

function matchApprovalFilter(approval: ApprovalV1, filter: ListApprovalsFilter): boolean {
  if (filter.status && approval.status !== filter.status) {
    return false;
  }
  const checks: readonly (readonly [string | undefined, string])[] = [
    [filter.runId ? String(filter.runId) : undefined, String(approval.runId)],
    [filter.planId ? String(filter.planId) : undefined, String(approval.planId)],
    [filter.workItemId ? String(filter.workItemId) : undefined, String(approval.workItemId)],
    [
      filter.assigneeUserId ? String(filter.assigneeUserId) : undefined,
      String(approval.assigneeUserId),
    ],
    [
      filter.requestedByUserId ? String(filter.requestedByUserId) : undefined,
      String(approval.requestedByUserId),
    ],
  ];
  return checks.every(([expected, actual]) => expected === undefined || actual === expected);
}

import type {
  AdapterRegistrationStore,
  ApprovalStore,
  IdempotencyKey,
  IdempotencyStore,
  PolicyStore,
  RunStore,
  WorkflowStore,
  WorkspaceStore,
} from '../../application/ports/index.js';
import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import type { ApprovalV1 } from '../../domain/approvals/approval-v1.js';
import { parseApprovalV1 } from '../../domain/approvals/approval-v1.js';
import { parsePolicyV1 } from '../../domain/policy/policy-v1.js';
import type { RunV1 } from '../../domain/runs/run-v1.js';
import { parseRunV1 } from '../../domain/runs/run-v1.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import type { WorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { PostgresJsonDocumentStore } from './postgres-json-document-store.js';
import type { SqlClient } from './sql-client.js';

const COLLECTION_WORKSPACES = 'workspaces';
const COLLECTION_RUNS = 'runs';
const COLLECTION_WORKFLOWS = 'workflows';
const COLLECTION_ADAPTER_REGISTRATIONS = 'adapter-registrations';
const COLLECTION_APPROVALS = 'approvals';
const COLLECTION_POLICIES = 'policies';
const COLLECTION_IDEMPOTENCY = 'idempotency';

export class PostgresWorkspaceStore implements WorkspaceStore {
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
    const payloads = await this.#documents.list({
      tenantId: String(tenantId),
      collection: COLLECTION_WORKSPACES,
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
}

export class PostgresRunStore implements RunStore {
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
    });
    return payloads.map((payload) => parseAdapterRegistrationV1(payload));
  }
}

export class PostgresApprovalStore implements ApprovalStore {
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

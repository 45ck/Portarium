import {
  SQL_JSON_DOC_SELECT_BY_IDS,
  SQL_JSON_DOC_SELECT_MANY,
  SQL_JSON_DOC_SELECT_ONE,
  SQL_JSON_DOC_UPSERT,
} from './postgres-json-document-store.js';
import type { SqlClient, SqlQueryResult, SqlRow } from './sql-client.js';

type Stored = Readonly<{
  tenantId: string;
  workspaceId?: string;
  collection: string;
  documentId: string;
  payload: unknown;
}>;

export class InMemorySqlClient implements SqlClient {
  readonly #rows = new Map<string, Stored>();

  public async withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  public query<Row extends SqlRow = SqlRow>(
    statement: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    if (statement.startsWith(SQL_JSON_DOC_UPSERT)) {
      this.#upsert(params);
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    if (statement.startsWith(SQL_JSON_DOC_SELECT_ONE)) {
      return Promise.resolve(this.#selectOne<Row>(params));
    }
    if (statement.startsWith(SQL_JSON_DOC_SELECT_MANY)) {
      return Promise.resolve(this.#selectMany<Row>(params));
    }
    if (statement.startsWith(SQL_JSON_DOC_SELECT_BY_IDS)) {
      return Promise.resolve(this.#selectByIds<Row>(params));
    }
    throw new Error(`Unsupported SQL statement tag: ${statement.split('\n')[0]}`);
  }

  #upsert(params: readonly unknown[]): void {
    const [tenantId, workspaceId, collection, documentId, payloadJson] = params;
    const parsedPayload = JSON.parse(String(payloadJson)) as unknown;
    const storedBase = {
      tenantId: String(tenantId),
      collection: String(collection),
      documentId: String(documentId),
      payload: parsedPayload,
    };
    if (workspaceId !== null && typeof workspaceId !== 'string') {
      throw new Error('workspaceId must be string or null.');
    }
    const stored: Stored =
      workspaceId === null
        ? storedBase
        : {
            ...storedBase,
            workspaceId,
          };
    this.#rows.set(keyFor(stored), stored);
  }

  #selectOne<Row extends SqlRow>(params: readonly unknown[]): SqlQueryResult<Row> {
    const [tenantId, collection, documentId] = params;
    const key = keyFor({
      tenantId: String(tenantId),
      collection: String(collection),
      documentId: String(documentId),
    });
    const row = this.#rows.get(key);
    if (!row) {
      return { rows: [], rowCount: 0 };
    }
    return {
      rows: [{ payload: row.payload } as unknown as Row],
      rowCount: 1,
    };
  }

  #selectMany<Row extends SqlRow>(params: readonly unknown[]): SqlQueryResult<Row> {
    const [tenantId, collection, workspaceId, afterId, limit] = params;
    const wantedTenant = String(tenantId);
    const wantedCollection = String(collection);
    if (workspaceId !== null && typeof workspaceId !== 'string') {
      throw new Error('workspaceId must be string or null.');
    }
    const wantedWorkspace = workspaceId ?? undefined;
    const afterIdStr = afterId != null ? String(afterId) : undefined;
    const limitNum = limit != null ? Number(limit) : undefined;

    let rows = [...this.#rows.values()]
      .filter(
        (row) =>
          row.tenantId === wantedTenant &&
          row.collection === wantedCollection &&
          (wantedWorkspace === undefined || row.workspaceId === wantedWorkspace) &&
          (afterIdStr === undefined || row.documentId > afterIdStr),
      )
      .sort((left, right) => left.documentId.localeCompare(right.documentId))
      .map((row) => ({ payload: row.payload }) as unknown as Row);

    if (limitNum !== undefined) {
      rows = rows.slice(0, limitNum);
    }

    return {
      rows,
      rowCount: rows.length,
    };
  }

  #selectByIds<Row extends SqlRow>(params: readonly unknown[]): SqlQueryResult<Row> {
    const [tenantId, collection, documentIds] = params;
    const wantedTenant = String(tenantId);
    const wantedCollection = String(collection);
    if (!Array.isArray(documentIds)) {
      throw new Error('selectByIds: third param must be an array of document IDs.');
    }
    const idSet = new Set((documentIds as unknown[]).map(String));

    const rows = [...this.#rows.values()]
      .filter(
        (row) =>
          row.tenantId === wantedTenant &&
          row.collection === wantedCollection &&
          idSet.has(row.documentId),
      )
      .sort((left, right) => left.documentId.localeCompare(right.documentId))
      .map((row) => ({ payload: row.payload }) as unknown as Row);

    return {
      rows,
      rowCount: rows.length,
    };
  }
}

function keyFor(
  doc: Readonly<{ tenantId: string; collection: string; documentId: string }>,
): string {
  return `${doc.tenantId}|${doc.collection}|${doc.documentId}`;
}

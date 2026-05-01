import type { SqlClient } from './sql-client.js';

export const SQL_JSON_DOC_UPSERT = '/* portarium:json-doc-upsert */';
export const SQL_JSON_DOC_SELECT_ONE = '/* portarium:json-doc-select-one */';
export const SQL_JSON_DOC_SELECT_MANY = '/* portarium:json-doc-select-many */';
export const SQL_JSON_DOC_SELECT_BY_IDS = '/* portarium:json-doc-select-by-ids */';
export const SQL_JSON_DOC_UPDATE_IF_STATUS = '/* portarium:json-doc-update-if-status */';
export const SQL_JSON_DOC_INSERT_IF_ABSENT = '/* portarium:json-doc-insert-if-absent */';

export type JsonDocument = Readonly<{
  tenantId: string;
  workspaceId?: string;
  collection: string;
  documentId: string;
  payload: unknown;
}>;

export class PostgresJsonDocumentStore {
  readonly #client: SqlClient;

  public constructor(client: SqlClient) {
    this.#client = client;
  }

  public async upsert(document: JsonDocument): Promise<void> {
    await this.#client.query(
      `${SQL_JSON_DOC_UPSERT}
INSERT INTO domain_documents (tenant_id, workspace_id, collection, document_id, payload)
VALUES ($1, $2, $3, $4, $5::jsonb)
ON CONFLICT (tenant_id, collection, document_id)
DO UPDATE SET workspace_id = EXCLUDED.workspace_id, payload = EXCLUDED.payload, updated_at = NOW();`,
      [
        document.tenantId,
        document.workspaceId ?? null,
        document.collection,
        document.documentId,
        JSON.stringify(document.payload),
      ],
    );
  }

  public async insertIfAbsent(document: JsonDocument): Promise<boolean> {
    const result = await this.#client.query(
      `${SQL_JSON_DOC_INSERT_IF_ABSENT}
INSERT INTO domain_documents (tenant_id, workspace_id, collection, document_id, payload)
VALUES ($1, $2, $3, $4, $5::jsonb)
ON CONFLICT (tenant_id, collection, document_id) DO NOTHING;`,
      [
        document.tenantId,
        document.workspaceId ?? null,
        document.collection,
        document.documentId,
        JSON.stringify(document.payload),
      ],
    );
    return result.rowCount === 1;
  }

  public async get(
    tenantId: string,
    collection: string,
    documentId: string,
    workspaceId?: string,
  ): Promise<unknown> {
    const result = await this.#client.query<{ payload: unknown }>(
      `${SQL_JSON_DOC_SELECT_ONE}
SELECT payload
FROM domain_documents
WHERE tenant_id = $1 AND collection = $2 AND document_id = $3
  AND ($4::text IS NULL OR workspace_id = $4)
LIMIT 1;`,
      [tenantId, collection, documentId, workspaceId ?? null],
    );

    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0]?.payload ?? null;
  }

  public async updatePayloadIfStatus(
    params: Readonly<{
      tenantId: string;
      workspaceId?: string;
      collection: string;
      documentId: string;
      expectedStatus: string;
      payload: unknown;
    }>,
  ): Promise<boolean> {
    const result = await this.#client.query(
      `${SQL_JSON_DOC_UPDATE_IF_STATUS}
UPDATE domain_documents
SET workspace_id = $2, payload = $6::jsonb, updated_at = NOW()
WHERE tenant_id = $1
  AND ($2::text IS NULL OR workspace_id = $2)
  AND collection = $3
  AND document_id = $4
  AND payload->>'status' = $5;`,
      [
        params.tenantId,
        params.workspaceId ?? null,
        params.collection,
        params.documentId,
        params.expectedStatus,
        JSON.stringify(params.payload),
      ],
    );
    return result.rowCount === 1;
  }

  public async list(
    params: Readonly<{
      tenantId: string;
      collection: string;
      workspaceId?: string;
      /**
       * Maximum rows to return. Callers must always pass this to prevent
       * unbounded full-table scans. Use `MAX_LIMIT + 1` for cursor-page
       * detection (fetch one extra to detect whether a next page exists).
       */
      limit: number;
      /**
       * Keyset cursor: only rows with document_id strictly greater than this
       * value are returned. Combines with limit for O(1) page fetches without
       * OFFSET scans.
       */
      afterId?: string;
    }>,
  ): Promise<readonly unknown[]> {
    const sqlParams: unknown[] = [
      params.tenantId,
      params.collection,
      params.workspaceId ?? null,
      params.afterId ?? null,
      params.limit,
    ];
    const result = await this.#client.query<{ payload: unknown }>(
      `${SQL_JSON_DOC_SELECT_MANY}
SELECT payload
FROM domain_documents
WHERE tenant_id = $1 AND collection = $2 AND ($3::text IS NULL OR workspace_id = $3)
  AND ($4::text IS NULL OR document_id > $4)
ORDER BY document_id ASC
LIMIT $5;`,
      sqlParams,
    );
    return result.rows.map((row) => row.payload);
  }

  /**
   * Fetches multiple documents by their IDs in a single query.
   *
   * Returns payloads in document_id ASC order (not the order of `documentIds`).
   * Returns an empty array immediately when `documentIds` is empty.
   */
  public async listByIds(
    tenantId: string,
    collection: string,
    documentIds: readonly string[],
    workspaceId?: string,
  ): Promise<readonly unknown[]> {
    if (documentIds.length === 0) {
      return [];
    }
    const result = await this.#client.query<{ payload: unknown }>(
      `${SQL_JSON_DOC_SELECT_BY_IDS}
SELECT payload
FROM domain_documents
WHERE tenant_id = $1 AND collection = $2 AND document_id = ANY($3::text[])
  AND ($4::text IS NULL OR workspace_id = $4)
ORDER BY document_id ASC;`,
      [tenantId, collection, documentIds, workspaceId ?? null],
    );
    return result.rows.map((row) => row.payload);
  }
}

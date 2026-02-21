/**
 * Generic SQL query builder for domain_documents JSONB payloads.
 *
 * Replaces in-memory matchXFilter() + pageByCursor() with a single
 * parameterized SQL query.  Supports equality filters, ILIKE search,
 * sorting, and cursor pagination.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EqualityFilter {
  readonly jsonField: string;
  readonly value: string;
}

export interface SearchConfig {
  readonly fields: readonly string[];
  readonly term: string;
}

export interface SortConfig {
  readonly jsonField: string;
  readonly direction: 'ASC' | 'DESC';
}

export interface ListQueryParams {
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly collection: string;
  readonly filters: readonly EqualityFilter[];
  readonly search?: SearchConfig;
  readonly sort?: SortConfig;
  readonly cursor?: string;
  readonly cursorField: string;
  readonly limit: number;
}

export interface BuiltQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildListQuery(params: ListQueryParams): BuiltQuery {
  const conditions: string[] = ['tenant_id = $1', 'collection = $2'];
  const sqlParams: unknown[] = [params.tenantId, params.collection];
  let idx = 3;

  if (params.workspaceId !== undefined) {
    conditions.push(`workspace_id = $${idx}`);
    sqlParams.push(params.workspaceId);
    idx++;
  }

  for (const filter of params.filters) {
    conditions.push(`payload->>'${sanitizeJsonField(filter.jsonField)}' = $${idx}`);
    sqlParams.push(filter.value);
    idx++;
  }

  if (params.search && params.search.term.trim() !== '') {
    const searchClauses = params.search.fields.map(
      (f) => `payload->>'${sanitizeJsonField(f)}' ILIKE $${idx}`,
    );
    conditions.push(`(${searchClauses.join(' OR ')})`);
    sqlParams.push(`%${escapeILikePattern(params.search.term)}%`);
    idx++;
  }

  if (params.cursor) {
    const op = params.sort?.direction === 'DESC' ? '<' : '>';
    conditions.push(`${params.cursorField} ${op} $${idx}`);
    sqlParams.push(params.cursor);
    idx++;
  }

  const orderBy = params.sort
    ? `ORDER BY payload->>'${sanitizeJsonField(params.sort.jsonField)}' ${params.sort.direction}, document_id ${params.sort.direction}`
    : `ORDER BY document_id ASC`;

  // Fetch limit + 1 to detect whether a next page exists.
  conditions.push('TRUE'); // ensures trailing AND is safe
  const where = conditions.filter(Boolean).join(' AND ');

  const sql = `SELECT payload FROM domain_documents WHERE ${where} ${orderBy} LIMIT $${idx}`;
  sqlParams.push(params.limit + 1);

  return { sql, params: sqlParams };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Prevent SQL injection in JSONB field names (only allow alphanumeric + underscore). */
function sanitizeJsonField(field: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new Error(`Invalid JSON field name: ${field}`);
  }
  return field;
}

/** Escape ILIKE special characters in a search term. */
function escapeILikePattern(input: string): string {
  return input.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

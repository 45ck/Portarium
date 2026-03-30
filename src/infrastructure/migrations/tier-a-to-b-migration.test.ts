import { describe, expect, it } from 'vitest';

import { migrateTenantTierAToB } from './tier-a-to-b-migration.js';
import type { SqlClient, SqlQueryResult, SqlRow } from '../postgresql/sql-client.js';

// ---------------------------------------------------------------------------
// Mock SqlClient that simulates shared tables with tenant data
// ---------------------------------------------------------------------------

class MigrationMockSqlClient implements SqlClient {
  readonly calls: { sql: string; params: unknown[] }[] = [];
  readonly #countsByTable = new Map<string, number>();

  setRowCount(tableName: string, count: number): void {
    this.#countsByTable.set(tableName, count);
  }

  query<Row extends SqlRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    this.calls.push({ sql, params: [...params] });

    // Handle COUNT queries
    if (sql.includes('COUNT(*)')) {
      for (const [table, count] of this.#countsByTable.entries()) {
        if (sql.includes(`"${table}"`)) {
          return Promise.resolve({
            rows: [{ cnt: String(count) } as unknown as Row],
            rowCount: 1,
          });
        }
      }
      return Promise.resolve({
        rows: [{ cnt: '0' } as unknown as Row],
        rowCount: 1,
      });
    }

    return Promise.resolve({ rows: [] as Row[], rowCount: 0 });
  }

  withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrateTenantTierAToB', () => {
  it('copies data from shared tables to tenant schema', async () => {
    const client = new MigrationMockSqlClient();
    client.setRowCount('domain_documents', 10);
    client.setRowCount('workspace_summary', 2);
    client.setRowCount('workflow_runs', 5);

    const result = await migrateTenantTierAToB({
      tenantId: 'acme',
      sharedClient: client,
    });

    expect(result.tenantId).toBe('acme');
    expect(result.schemaName).toBe('tenant_acme');
    expect(result.copiedDomainDocuments).toBe(10);
    expect(result.copiedWorkspaceSummary).toBe(2);
    expect(result.copiedWorkflowRuns).toBe(5);
    expect(result.deletedSourceRows).toBe(false);

    const sqls = client.calls.map((c) => c.sql);
    // Should have INSERT INTO tenant schema for each table with data
    expect(sqls.filter((s) => s.includes('INSERT INTO "tenant_acme"'))).toHaveLength(3);
    // Should not have DELETE statements
    expect(sqls.filter((s) => s.includes('DELETE FROM'))).toHaveLength(0);
  });

  it('skips tables with no matching rows', async () => {
    const client = new MigrationMockSqlClient();
    client.setRowCount('domain_documents', 3);
    // workspace_summary and workflow_runs default to 0

    const result = await migrateTenantTierAToB({
      tenantId: 'sparse',
      sharedClient: client,
    });

    expect(result.copiedDomainDocuments).toBe(3);
    expect(result.copiedWorkspaceSummary).toBe(0);
    expect(result.copiedWorkflowRuns).toBe(0);

    const sqls = client.calls.map((c) => c.sql);
    expect(sqls.filter((s) => s.includes('INSERT INTO'))).toHaveLength(1);
  });

  it('deletes source rows when deleteSourceRows is true', async () => {
    const client = new MigrationMockSqlClient();
    client.setRowCount('domain_documents', 5);
    client.setRowCount('workspace_summary', 1);
    client.setRowCount('workflow_runs', 3);

    const result = await migrateTenantTierAToB({
      tenantId: 'migrating',
      sharedClient: client,
      deleteSourceRows: true,
    });

    expect(result.deletedSourceRows).toBe(true);

    const sqls = client.calls.map((c) => c.sql);
    expect(sqls.filter((s) => s.includes('DELETE FROM'))).toHaveLength(3);
  });

  it('uses custom schema name when provided', async () => {
    const client = new MigrationMockSqlClient();
    client.setRowCount('domain_documents', 1);

    const result = await migrateTenantTierAToB({
      tenantId: 'custom',
      sharedClient: client,
      schemaName: 'custom_schema',
    });

    expect(result.schemaName).toBe('custom_schema');
    const sqls = client.calls.map((c) => c.sql);
    expect(sqls.some((s) => s.includes('"custom_schema"'))).toBe(true);
  });

  it('handles tenant with zero rows across all tables', async () => {
    const client = new MigrationMockSqlClient();

    const result = await migrateTenantTierAToB({
      tenantId: 'empty',
      sharedClient: client,
    });

    expect(result.copiedDomainDocuments).toBe(0);
    expect(result.copiedWorkspaceSummary).toBe(0);
    expect(result.copiedWorkflowRuns).toBe(0);

    const sqls = client.calls.map((c) => c.sql);
    expect(sqls.filter((s) => s.includes('INSERT INTO'))).toHaveLength(0);
  });
});

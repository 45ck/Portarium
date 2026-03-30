import { describe, expect, it } from 'vitest';

import {
  TenantSchemaManager,
  TenantSchemaError,
  SchemaScopedSqlClient,
} from './tenant-schema-manager.js';
import { InMemoryTenantStorageProvisioner } from './tenant-storage-provisioner.js';
import type { SqlClient, SqlQueryResult, SqlRow } from '../postgresql/sql-client.js';
import type { SchemaMigration } from './schema-migrator.js';

// ---------------------------------------------------------------------------
// Mock SqlClient that tracks queries
// ---------------------------------------------------------------------------

class MockSqlClient implements SqlClient {
  readonly calls: { sql: string; params: unknown[] }[] = [];
  readonly #responses = new Map<string, { rows: unknown[] }>();

  setResponse(sqlSubstring: string, rows: unknown[]): void {
    this.#responses.set(sqlSubstring, { rows });
  }

  query<Row extends SqlRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    this.calls.push({ sql, params: [...params] });
    for (const [pattern, response] of this.#responses.entries()) {
      if (sql.includes(pattern)) {
        return Promise.resolve({
          rows: response.rows as Row[],
          rowCount: response.rows.length,
        });
      }
    }
    return Promise.resolve({ rows: [] as Row[], rowCount: 0 });
  }

  withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_MIGRATIONS: readonly SchemaMigration[] = [
  {
    version: 1,
    id: 'test_expand_baseline',
    description: 'Test baseline table.',
    phase: 'Expand',
    scope: 'Global',
    compatibility: 'BackwardCompatible',
    upSql: ['CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY);'],
    downSql: ['DROP TABLE IF EXISTS test_table;'],
  },
  {
    version: 2,
    id: 'test_expand_tenant_scoped',
    description: 'Test tenant-scoped table.',
    phase: 'Expand',
    scope: 'Tenant',
    compatibility: 'BackwardCompatible',
    upSql: ['CREATE TABLE IF NOT EXISTS tenant_data (id TEXT PRIMARY KEY);'],
    downSql: ['DROP TABLE IF EXISTS tenant_data;'],
  },
];

// ---------------------------------------------------------------------------
// TenantSchemaManager tests
// ---------------------------------------------------------------------------

describe('TenantSchemaManager', () => {
  function createManager(env: 'test' | 'production' = 'test') {
    const sharedClient = new MockSqlClient();
    const provisioner = new InMemoryTenantStorageProvisioner();
    const manager = new TenantSchemaManager({
      sharedClient,
      provisioner,
      migrations: TEST_MIGRATIONS,
      environment: env,
    });
    return { manager, sharedClient, provisioner };
  }

  describe('provisionTenantSchema', () => {
    it('provisions a Tier B tenant and returns config with schemaName', async () => {
      const { manager } = createManager();
      const config = await manager.provisionTenantSchema('acme');

      expect(config.tier).toBe('TierB');
      expect(config.tenantId).toBe('acme');
      expect(config.schemaName).toBe('tenant_acme');
    });

    it('is idempotent — second call returns same config', async () => {
      const { manager } = createManager();
      const first = await manager.provisionTenantSchema('acme');
      const second = await manager.provisionTenantSchema('acme');

      expect(second).toEqual(first);
    });
  });

  describe('migrateTenantSchema', () => {
    it('throws when tenant is not provisioned', async () => {
      const { manager } = createManager();

      await expect(manager.migrateTenantSchema('unknown')).rejects.toThrow(TenantSchemaError);
      await expect(manager.migrateTenantSchema('unknown')).rejects.toThrow('not provisioned');
    });

    it('throws when tenant is on Tier A', async () => {
      const { manager, provisioner } = createManager();
      await provisioner.provision('tier-a-tenant', 'TierA');

      await expect(manager.migrateTenantSchema('tier-a-tenant')).rejects.toThrow('not TierB');
    });

    it('succeeds for a provisioned Tier B tenant', async () => {
      const { manager } = createManager();
      await manager.provisionTenantSchema('acme');
      const applied = await manager.migrateTenantSchema('acme');

      expect(applied).toBeGreaterThanOrEqual(0);
    });
  });

  describe('listTenantSchemas', () => {
    it('returns empty array when no tenant schemas exist', async () => {
      const { manager, sharedClient } = createManager();
      sharedClient.setResponse('pg_catalog', []);

      const schemas = await manager.listTenantSchemas();
      expect(schemas).toEqual([]);
    });

    it('returns schema info from pg_catalog', async () => {
      const { manager, sharedClient } = createManager();
      sharedClient.setResponse('pg_catalog', [
        { schema_name: 'tenant_acme', tenant_id: 'acme', tier: 'TierB' },
        { schema_name: 'tenant_orphan', tenant_id: null, tier: null },
      ]);

      const schemas = await manager.listTenantSchemas();
      expect(schemas).toHaveLength(2);
      expect(schemas[0]).toEqual({
        schemaName: 'tenant_acme',
        tenantId: 'acme',
        tier: 'TierB',
      });
      expect(schemas[1]).toEqual({
        schemaName: 'tenant_orphan',
        tenantId: null,
        tier: null,
      });
    });
  });

  describe('getTenantConnection', () => {
    it('throws when tenant is not provisioned', async () => {
      const { manager } = createManager();

      await expect(manager.getTenantConnection('unknown')).rejects.toThrow(TenantSchemaError);
    });

    it('throws when tenant is not Tier B', async () => {
      const { manager, provisioner } = createManager();
      await provisioner.provision('tier-a-tenant', 'TierA');

      await expect(manager.getTenantConnection('tier-a-tenant')).rejects.toThrow('only for TierB');
    });

    it('returns a SchemaScopedSqlClient for Tier B tenant', async () => {
      const { manager } = createManager();
      await manager.provisionTenantSchema('acme');

      const client = await manager.getTenantConnection('acme');
      expect(client).toBeInstanceOf(SchemaScopedSqlClient);
      expect(client.schemaName).toBe('tenant_acme');
    });
  });

  describe('dropTenantSchema', () => {
    it('throws in production environment', async () => {
      const { manager } = createManager('production');

      await expect(manager.dropTenantSchema('acme')).rejects.toThrow(TenantSchemaError);
      await expect(manager.dropTenantSchema('acme')).rejects.toThrow('not allowed in production');
    });

    it('deprovisions in test environment', async () => {
      const { manager, provisioner } = createManager();
      await manager.provisionTenantSchema('acme');
      expect(await provisioner.getConfig('acme')).toBeDefined();

      await manager.dropTenantSchema('acme');
      expect(await provisioner.getConfig('acme')).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// SchemaScopedSqlClient tests
// ---------------------------------------------------------------------------

describe('SchemaScopedSqlClient', () => {
  it('sets search_path before each query', async () => {
    const inner = new MockSqlClient();
    const client = new SchemaScopedSqlClient(inner, 'tenant_acme');

    await client.query('SELECT 1;');

    expect(inner.calls).toHaveLength(2);
    expect(inner.calls[0]!.sql).toContain('SET search_path TO "tenant_acme"');
    expect(inner.calls[1]!.sql).toBe('SELECT 1;');
  });

  it('sets search_path inside transactions', async () => {
    const inner = new MockSqlClient();
    const client = new SchemaScopedSqlClient(inner, 'tenant_acme');

    await client.withTransaction(async (tx) => {
      await tx.query('INSERT INTO foo VALUES (1);');
    });

    const sqls = inner.calls.map((c) => c.sql);
    expect(sqls.some((s) => s.includes('SET search_path'))).toBe(true);
  });

  it('exposes schemaName', () => {
    const inner = new MockSqlClient();
    const client = new SchemaScopedSqlClient(inner, 'tenant_xyz');
    expect(client.schemaName).toBe('tenant_xyz');
  });
});

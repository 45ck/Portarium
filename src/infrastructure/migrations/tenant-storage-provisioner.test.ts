import { describe, expect, it } from 'vitest';

import { buildBackupSpec } from './tenant-backup-spec.js';
import {
  InMemoryTenantStorageProvisioner,
  PostgresTenantStorageProvisioner,
} from './tenant-storage-provisioner.js';
import type { SqlClient } from '../postgresql/sql-client.js';
import {
  buildSchemaName,
  buildTenantDatabaseName,
  type TenantStorageConfig,
} from './tenant-storage-tier.js';

// ---------------------------------------------------------------------------
// Mock SqlClient for PostgresTenantStorageProvisioner unit tests
// ---------------------------------------------------------------------------

class MockSqlClient implements SqlClient {
  readonly calls: { sql: string; params: unknown[] }[] = [];
  readonly #responses = new Map<string, { rows: unknown[] }>();

  setResponse(sqlSubstring: string, rows: unknown[]): void {
    this.#responses.set(sqlSubstring, { rows });
  }

  query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: readonly T[]; rowCount: number }> {
    this.calls.push({ sql, params: [...params] });
    for (const [pattern, response] of this.#responses.entries()) {
      if (sql.includes(pattern)) {
        return Promise.resolve({
          rows: response.rows as T[],
          rowCount: response.rows.length,
        });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  }

  withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

describe('buildSchemaName', () => {
  it('prefixes with tenant_ and lowercases', () => {
    expect(buildSchemaName('workspace-ABC')).toBe('tenant_workspace_abc');
  });

  it('replaces non-alphanumeric characters with underscores', () => {
    expect(buildSchemaName('my.tenant@2')).toBe('tenant_my_tenant_2');
  });

  it('handles already safe identifiers', () => {
    expect(buildSchemaName('acme_corp')).toBe('tenant_acme_corp');
  });
});

describe('buildTenantDatabaseName', () => {
  it('combines namespace and sanitised tenant id', () => {
    expect(buildTenantDatabaseName('workspace-abc', 'portarium')).toBe(
      'portarium_tenant_workspace_abc',
    );
  });

  it('sanitises namespace too', () => {
    expect(buildTenantDatabaseName('tenant1', 'my-app')).toBe('my_app_tenant_tenant1');
  });
});

describe('InMemoryTenantStorageProvisioner', () => {
  it('provisions TierA with no schema or connection string', async () => {
    const provisioner = new InMemoryTenantStorageProvisioner();
    const config = await provisioner.provision('tenant-a', 'TierA');

    expect(config.tier).toBe('TierA');
    expect(config.tenantId).toBe('tenant-a');
    expect(config.schemaName).toBeUndefined();
    expect(config.connectionString).toBeUndefined();
  });

  it('provisions TierB with a schema name', async () => {
    const provisioner = new InMemoryTenantStorageProvisioner();
    const config = await provisioner.provision('tenant-b', 'TierB');

    expect(config.tier).toBe('TierB');
    expect(config.schemaName).toBe('tenant_tenant_b');
    expect(config.connectionString).toBeUndefined();
  });

  it('provisions TierC with a connection string', async () => {
    const provisioner = new InMemoryTenantStorageProvisioner();
    const config = await provisioner.provision('tenant-c', 'TierC');

    expect(config.tier).toBe('TierC');
    expect(config.connectionString).toBeDefined();
    expect(config.schemaName).toBeUndefined();
  });

  it('is idempotent — second provision returns same config', async () => {
    const provisioner = new InMemoryTenantStorageProvisioner();
    const first = await provisioner.provision('tenant-x', 'TierB');
    const second = await provisioner.provision('tenant-x', 'TierB');

    expect(second).toEqual(first);
    expect(provisioner.__test__all().size).toBe(1);
  });

  it('getConfig returns undefined for unprovisioned tenant', async () => {
    const provisioner = new InMemoryTenantStorageProvisioner();
    const config = await provisioner.getConfig('unknown');
    expect(config).toBeUndefined();
  });

  it('getConfig returns stored config after provision', async () => {
    const provisioner = new InMemoryTenantStorageProvisioner();
    await provisioner.provision('tenant-z', 'TierB');
    const config = await provisioner.getConfig('tenant-z');
    expect(config?.tier).toBe('TierB');
  });

  it('deprovision removes the tenant config', async () => {
    const provisioner = new InMemoryTenantStorageProvisioner();
    await provisioner.provision('tenant-d', 'TierA');
    await provisioner.deprovision('tenant-d');
    expect(await provisioner.getConfig('tenant-d')).toBeUndefined();
  });

  it('deprovision is a no-op for unprovisioned tenant', async () => {
    const provisioner = new InMemoryTenantStorageProvisioner();
    await expect(provisioner.deprovision('nonexistent')).resolves.toBeUndefined();
  });
});

describe('buildBackupSpec', () => {
  it('TierA produces shared_filtered strategy with tenant WHERE clause', () => {
    const config: TenantStorageConfig = { tier: 'TierA', tenantId: 'acme' };
    const spec = buildBackupSpec(config, 30);

    expect(spec.strategy).toBe('shared_filtered');
    expect(spec.retentionDays).toBe(30);
    expect(spec.pgDumpArgs).toContain('--table=domain_documents');
    expect(spec.pgDumpArgs.some((a) => a.includes("tenant_id='acme'"))).toBe(true);
    expect(spec.schemaName).toBeUndefined();
    expect(spec.connectionString).toBeUndefined();
  });

  it('TierB produces schema_dump strategy with schema arg', () => {
    const config: TenantStorageConfig = {
      tier: 'TierB',
      tenantId: 'contoso',
      schemaName: 'tenant_contoso',
    };
    const spec = buildBackupSpec(config, 14);

    expect(spec.strategy).toBe('schema_dump');
    expect(spec.schemaName).toBe('tenant_contoso');
    expect(spec.pgDumpArgs).toContain('--schema=tenant_contoso');
    expect(spec.pgDumpArgs).toContain('--format=custom');
  });

  it('TierC produces database_dump strategy with connection string', () => {
    const config: TenantStorageConfig = {
      tier: 'TierC',
      tenantId: 'bigcorp',
      connectionString: 'postgres://localhost/portarium_tenant_bigcorp',
    };
    const spec = buildBackupSpec(config, 90);

    expect(spec.strategy).toBe('database_dump');
    expect(spec.connectionString).toBe('postgres://localhost/portarium_tenant_bigcorp');
    expect(spec.pgDumpArgs).toContain('--format=custom');
    expect(spec.retentionDays).toBe(90);
  });

  it('escapes SQL single quotes in tenant id for TierA WHERE clause', () => {
    const config: TenantStorageConfig = { tier: 'TierA', tenantId: "o'malley-corp" };
    const spec = buildBackupSpec(config, 7);

    expect(spec.pgDumpArgs.some((a) => a.includes("tenant_id='o''malley-corp'"))).toBe(true);
  });

  it('TierB falls back to tenant_<id> schema name when schemaName is undefined', () => {
    const config: TenantStorageConfig = { tier: 'TierB', tenantId: 'fallback-tenant' };
    const spec = buildBackupSpec(config, 14);

    expect(spec.strategy).toBe('schema_dump');
    expect(spec.schemaName).toBe('tenant_fallback-tenant');
  });

  it('TierC falls back to empty connection string when connectionString is undefined', () => {
    const config: TenantStorageConfig = { tier: 'TierC', tenantId: 'no-conn-tenant' };
    const spec = buildBackupSpec(config, 7);

    expect(spec.strategy).toBe('database_dump');
    expect(spec.connectionString).toBe('');
  });
});

// ---------------------------------------------------------------------------
// PostgresTenantStorageProvisioner (mock-based unit tests)
// ---------------------------------------------------------------------------

describe('PostgresTenantStorageProvisioner', () => {
  function makeProvisioner(overrides?: { adminRows?: unknown[]; sharedRows?: unknown[] }) {
    const adminClient = new MockSqlClient();
    const sharedClient = new MockSqlClient();
    if (overrides?.adminRows) {
      adminClient.setResponse('pg_database', overrides.adminRows);
    }
    if (overrides?.sharedRows) {
      sharedClient.setResponse('tenant_storage_tiers', overrides.sharedRows);
    }
    const provisioner = new PostgresTenantStorageProvisioner({
      adminClient,
      sharedClient,
      namespace: 'portarium',
    });
    return { provisioner, adminClient, sharedClient };
  }

  it('provision TierA returns config without any DB calls', async () => {
    const { provisioner, adminClient, sharedClient } = makeProvisioner();
    const config = await provisioner.provision('tenant-a', 'TierA');

    expect(config.tier).toBe('TierA');
    expect(config.tenantId).toBe('tenant-a');
    expect(config.schemaName).toBeUndefined();
    expect(config.connectionString).toBeUndefined();
    expect(adminClient.calls).toHaveLength(0);
    expect(sharedClient.calls).toHaveLength(0);
  });

  it('provision TierB creates schema and upserts record', async () => {
    const { provisioner, sharedClient } = makeProvisioner();
    const config = await provisioner.provision('tenant-b', 'TierB');

    expect(config.tier).toBe('TierB');
    expect(config.schemaName).toBe('tenant_tenant_b');
    const sqls = sharedClient.calls.map((c) => c.sql);
    expect(sqls.some((s) => s.includes('CREATE SCHEMA IF NOT EXISTS'))).toBe(true);
    expect(sqls.some((s) => s.includes('INSERT INTO tenant_storage_tiers'))).toBe(true);
  });

  it('provision TierC creates database when not found and upserts record', async () => {
    const { provisioner, adminClient, sharedClient } = makeProvisioner();
    const config = await provisioner.provision('tenant-c', 'TierC');

    expect(config.tier).toBe('TierC');
    expect(config.connectionString).toContain('tenant');
    const adminSqls = adminClient.calls.map((c) => c.sql);
    expect(adminSqls.some((s) => s.includes('pg_catalog.pg_database'))).toBe(true);
    expect(adminSqls.some((s) => s.includes('CREATE DATABASE'))).toBe(true);
    const sharedSqls = sharedClient.calls.map((c) => c.sql);
    expect(sharedSqls.some((s) => s.includes('INSERT INTO tenant_storage_tiers'))).toBe(true);
  });

  it('provision TierC skips CREATE DATABASE when database already exists', async () => {
    const { provisioner, adminClient } = makeProvisioner({
      adminRows: [{ datname: 'portarium_tenant_tenant_exists' }],
    });
    await provisioner.provision('tenant-exists', 'TierC');

    const adminSqls = adminClient.calls.map((c) => c.sql);
    expect(adminSqls.some((s) => s.includes('CREATE DATABASE'))).toBe(false);
  });

  it('getConfig returns undefined when tenant not found', async () => {
    const { provisioner } = makeProvisioner();
    const config = await provisioner.getConfig('missing-tenant');
    expect(config).toBeUndefined();
  });

  it('getConfig returns TierB config with schemaName', async () => {
    const { provisioner, sharedClient } = makeProvisioner({
      sharedRows: [{ tier: 'TierB', schema_name: 'tenant_acme', connection_string: null }],
    });
    sharedClient.setResponse('SELECT tier', [
      { tier: 'TierB', schema_name: 'tenant_acme', connection_string: null },
    ]);
    const config = await provisioner.getConfig('acme');
    expect(config?.tier).toBe('TierB');
    expect(config?.schemaName).toBe('tenant_acme');
    expect(config?.connectionString).toBeUndefined();
  });

  it('getConfig returns TierC config with connectionString', async () => {
    const { provisioner, sharedClient } = makeProvisioner();
    sharedClient.setResponse('SELECT tier', [
      {
        tier: 'TierC',
        schema_name: null,
        connection_string: 'postgres://localhost/portarium_tenant_bigco',
      },
    ]);
    const config = await provisioner.getConfig('bigco');
    expect(config?.tier).toBe('TierC');
    expect(config?.connectionString).toBe('postgres://localhost/portarium_tenant_bigco');
    expect(config?.schemaName).toBeUndefined();
  });

  it('deprovision is a no-op for unprovisioned tenant', async () => {
    const { provisioner } = makeProvisioner();
    await expect(provisioner.deprovision('unknown')).resolves.toBeUndefined();
  });

  it('deprovision TierB drops schema and removes record', async () => {
    const { provisioner, sharedClient } = makeProvisioner();
    sharedClient.setResponse('SELECT tier', [
      { tier: 'TierB', schema_name: 'tenant_foo', connection_string: null },
    ]);
    await provisioner.deprovision('foo');

    const sqls = sharedClient.calls.map((c) => c.sql);
    expect(sqls.some((s) => s.includes('DROP SCHEMA IF EXISTS'))).toBe(true);
    expect(sqls.some((s) => s.includes('DELETE FROM tenant_storage_tiers'))).toBe(true);
  });

  it('deprovision TierC drops database and removes record', async () => {
    const { provisioner, adminClient, sharedClient } = makeProvisioner();
    sharedClient.setResponse('SELECT tier', [
      {
        tier: 'TierC',
        schema_name: null,
        connection_string: 'postgres://localhost/portarium_tenant_tierc',
      },
    ]);
    await provisioner.deprovision('tierc');

    const adminSqls = adminClient.calls.map((c) => c.sql);
    expect(adminSqls.some((s) => s.includes('pg_terminate_backend'))).toBe(true);
    expect(adminSqls.some((s) => s.includes('DROP DATABASE IF EXISTS'))).toBe(true);
  });
});

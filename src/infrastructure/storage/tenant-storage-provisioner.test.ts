/**
 * Unit tests for TenantStorageProvisioner (schema-per-tenant lifecycle).
 * Uses an in-memory SqlClient stub.
 * Bead: bead-0392
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TenantStorageProvisioner,
  tenantToSchemaName,
  tenantToRoleName,
} from './tenant-storage-provisioner.js';
import type { SqlClient, SqlQueryResult } from '../postgresql/sql-client.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSqlClient(): SqlClient & { calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = [];
  const responses = new Map<string, SqlQueryResult>();

  const client = {
    calls,
    _setResponse(keySubstring: string, result: SqlQueryResult) {
      responses.set(keySubstring, result);
    },
    async query<Row extends Record<string, unknown>>(
      statement: string,
      params?: readonly unknown[],
    ): Promise<SqlQueryResult<Row>> {
      calls.push({ sql: statement, params: params ? [...params] : [] });
      for (const [key, result] of responses) {
        if (statement.includes(key)) {
          return result as SqlQueryResult<Row>;
        }
      }
      return { rows: [], rowCount: 0 };
    },
  };
  return client as unknown as SqlClient & { calls: { sql: string; params: unknown[] }[] };
}

// ── Name helpers ────────────────────────────────────────────────────────────

describe('tenantToSchemaName', () => {
  it('converts kebab to underscore with prefix', () => {
    expect(tenantToSchemaName('acme-corp')).toBe('tenant_acme_corp');
  });

  it('handles single-word tenant id', () => {
    expect(tenantToSchemaName('acme')).toBe('tenant_acme');
  });
});

describe('tenantToRoleName', () => {
  it('converts kebab to underscore with role prefix', () => {
    expect(tenantToRoleName('acme-corp')).toBe('role_acme_corp');
  });
});

// ── provisionSchema ─────────────────────────────────────────────────────────

describe('TenantStorageProvisioner.provisionSchema', () => {
  let sql: ReturnType<typeof makeSqlClient>;
  let provisioner: TenantStorageProvisioner;

  beforeEach(() => {
    sql = makeSqlClient();
    provisioner = new TenantStorageProvisioner(sql);
  });

  it('creates schema when it does not exist', async () => {
    // information_schema check returns no rows → schema absent
    const result = await provisioner.provisionSchema({
      tenantId: 'acme-corp',
      tier: 'shared',
    });

    expect(result.alreadyExisted).toBe(false);
    expect(result.schemaName).toBe('tenant_acme_corp');
    expect(result.roleName).toBe('role_acme_corp');

    const createSchema = sql.calls.find((c) => c.sql.includes('CREATE SCHEMA'));
    expect(createSchema).toBeDefined();
    expect(createSchema!.sql).toContain('tenant_acme_corp');
  });

  it('returns alreadyExisted=true when schema already present', async () => {
    (sql as unknown as { _setResponse: (k: string, r: SqlQueryResult) => void })._setResponse(
      'information_schema.schemata',
      { rows: [{ schema_name: 'tenant_acme_corp' }], rowCount: 1 },
    );

    const result = await provisioner.provisionSchema({
      tenantId: 'acme-corp',
      tier: 'shared',
    });

    expect(result.alreadyExisted).toBe(true);
    const createSchema = sql.calls.find((c) => c.sql.includes('CREATE SCHEMA'));
    expect(createSchema).toBeUndefined();
  });

  it('grants usage and default privileges to portarium_shared', async () => {
    await provisioner.provisionSchema({ tenantId: 'beta-tenant', tier: 'shared' });

    const grantUsage = sql.calls.find(
      (c) => c.sql.includes('GRANT USAGE') && c.sql.includes('portarium_shared'),
    );
    expect(grantUsage).toBeDefined();

    const alterDefault = sql.calls.find(
      (c) => c.sql.includes('ALTER DEFAULT PRIVILEGES') && c.sql.includes('portarium_shared'),
    );
    expect(alterDefault).toBeDefined();
  });

  it('rejects invalid tenant IDs', async () => {
    await expect(
      provisioner.provisionSchema({ tenantId: 'INVALID', tier: 'shared' }),
    ).rejects.toThrow('Invalid tenantId');

    await expect(provisioner.provisionSchema({ tenantId: 'ab', tier: 'shared' })).rejects.toThrow(
      'Invalid tenantId',
    );

    await expect(
      provisioner.provisionSchema({ tenantId: 'with spaces', tier: 'shared' }),
    ).rejects.toThrow('Invalid tenantId');
  });

  it('issues CREATE ROLE before CREATE SCHEMA', async () => {
    await provisioner.provisionSchema({ tenantId: 'order-test', tier: 'shared' });

    const roleIdx = sql.calls.findIndex((c) => c.sql.includes('CREATE ROLE'));
    const schemaIdx = sql.calls.findIndex((c) => c.sql.includes('CREATE SCHEMA'));
    expect(roleIdx).toBeGreaterThanOrEqual(0);
    expect(schemaIdx).toBeGreaterThan(roleIdx);
  });
});

// ── deprovisionSchema ───────────────────────────────────────────────────────

describe('TenantStorageProvisioner.deprovisionSchema', () => {
  let sql: ReturnType<typeof makeSqlClient>;
  let provisioner: TenantStorageProvisioner;

  beforeEach(() => {
    sql = makeSqlClient();
    provisioner = new TenantStorageProvisioner(sql);
  });

  it('drops schema when it exists', async () => {
    (sql as unknown as { _setResponse: (k: string, r: SqlQueryResult) => void })._setResponse(
      'information_schema.schemata',
      { rows: [{ schema_name: 'tenant_acme_corp' }], rowCount: 1 },
    );

    const result = await provisioner.deprovisionSchema('acme-corp');

    expect(result.dropped).toBe(true);
    expect(result.schemaName).toBe('tenant_acme_corp');

    const drop = sql.calls.find((c) => c.sql.includes('DROP SCHEMA'));
    expect(drop).toBeDefined();
    expect(drop!.sql).toContain('CASCADE');
  });

  it('returns dropped=false when schema does not exist', async () => {
    const result = await provisioner.deprovisionSchema('ghost-tenant');

    expect(result.dropped).toBe(false);
    const drop = sql.calls.find((c) => c.sql.includes('DROP SCHEMA'));
    expect(drop).toBeUndefined();
  });

  it('revokes grants before dropping schema', async () => {
    (sql as unknown as { _setResponse: (k: string, r: SqlQueryResult) => void })._setResponse(
      'information_schema.schemata',
      { rows: [{ schema_name: 'tenant_gamma' }], rowCount: 1 },
    );

    await provisioner.deprovisionSchema('gamma');

    const revokeIdx = sql.calls.findIndex((c) => c.sql.includes('REVOKE'));
    const dropIdx = sql.calls.findIndex((c) => c.sql.includes('DROP SCHEMA'));
    expect(revokeIdx).toBeGreaterThanOrEqual(0);
    expect(dropIdx).toBeGreaterThan(revokeIdx);
  });

  it('drops the role after dropping the schema', async () => {
    (sql as unknown as { _setResponse: (k: string, r: SqlQueryResult) => void })._setResponse(
      'information_schema.schemata',
      { rows: [{ schema_name: 'tenant_delta' }], rowCount: 1 },
    );

    await provisioner.deprovisionSchema('delta');

    const dropSchemaIdx = sql.calls.findIndex((c) => c.sql.includes('DROP SCHEMA'));
    const dropRoleIdx = sql.calls.findIndex((c) => c.sql.includes('DROP ROLE'));
    expect(dropRoleIdx).toBeGreaterThan(dropSchemaIdx);
  });

  it('rejects invalid tenant IDs on deprovision', async () => {
    await expect(provisioner.deprovisionSchema('BAD!')).rejects.toThrow('Invalid tenantId');
  });
});

// ── listProvisionedTenants ──────────────────────────────────────────────────

describe('TenantStorageProvisioner.listProvisionedTenants', () => {
  it('returns mapped tenant IDs from schema names', async () => {
    const sql = makeSqlClient();
    (sql as unknown as { _setResponse: (k: string, r: SqlQueryResult) => void })._setResponse(
      'information_schema.schemata',
      {
        rows: [
          { schema_name: 'tenant_acme_corp' },
          { schema_name: 'tenant_beta' },
          { schema_name: 'tenant_gamma_inc' },
        ],
        rowCount: 3,
      },
    );

    const provisioner = new TenantStorageProvisioner(sql);
    const tenants = await provisioner.listProvisionedTenants();

    expect(tenants).toEqual(['acme-corp', 'beta', 'gamma-inc']);
  });

  it('returns empty array when no tenant schemas exist', async () => {
    const sql = makeSqlClient();
    const provisioner = new TenantStorageProvisioner(sql);
    const tenants = await provisioner.listProvisionedTenants();
    expect(tenants).toEqual([]);
  });
});

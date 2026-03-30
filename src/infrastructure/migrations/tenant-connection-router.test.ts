import { describe, expect, it } from 'vitest';

import {
  TenantConnectionRouter,
  TenantConnectionRouterError,
} from './tenant-connection-router.js';
import { InMemoryTenantStorageProvisioner } from './tenant-storage-provisioner.js';
import type { SqlClient, SqlQueryResult, SqlRow } from '../postgresql/sql-client.js';

// ---------------------------------------------------------------------------
// Mock SqlClient
// ---------------------------------------------------------------------------

class MockSqlClient implements SqlClient {
  readonly calls: { sql: string; params: unknown[] }[] = [];

  query<Row extends SqlRow>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    this.calls.push({ sql, params: [...params] });
    return Promise.resolve({ rows: [] as Row[], rowCount: 0 });
  }

  withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TenantConnectionRouter', () => {
  function createRouter(options?: { tierOverride?: 'A' | 'B' }) {
    const sharedClient = new MockSqlClient();
    const provisioner = new InMemoryTenantStorageProvisioner();
    const tierCClients = new Map<string, MockSqlClient>();

    const router = new TenantConnectionRouter({
      sharedClient,
      provisioner,
      tenancyTierOverride: options?.tierOverride,
      tenantClientFactory: (connStr) => {
        const client = new MockSqlClient();
        tierCClients.set(connStr, client);
        return client;
      },
    });

    return { router, sharedClient, provisioner, tierCClients };
  }

  it('returns shared client for unprovisioned tenant (defaults to Tier A)', async () => {
    const { router, sharedClient } = createRouter();
    const client = await router.getClientForTenant('unknown-tenant');
    expect(client).toBe(sharedClient);
  });

  it('returns shared client for Tier A tenant', async () => {
    const { router, sharedClient, provisioner } = createRouter();
    await provisioner.provision('tier-a', 'TierA');

    const client = await router.getClientForTenant('tier-a');
    expect(client).toBe(sharedClient);
  });

  it('returns schema-scoped client for Tier B tenant', async () => {
    const { router, sharedClient, provisioner } = createRouter();
    await provisioner.provision('tier-b', 'TierB');

    const client = await router.getClientForTenant('tier-b');
    expect(client).not.toBe(sharedClient);

    // Verify the client sets search_path when querying
    await client.query('SELECT 1;');
    const sqls = sharedClient.calls.map((c) => c.sql);
    expect(sqls.some((s) => s.includes('SET search_path TO "tenant_tier_b"'))).toBe(true);
  });

  it('returns dedicated client for Tier C tenant', async () => {
    const { router, sharedClient, provisioner, tierCClients } = createRouter();
    await provisioner.provision('tier-c', 'TierC');

    const client = await router.getClientForTenant('tier-c');
    expect(client).not.toBe(sharedClient);
    expect(tierCClients.size).toBe(1);
  });

  it('reuses Tier C client on second call', async () => {
    const { router, provisioner, tierCClients } = createRouter();
    await provisioner.provision('tier-c', 'TierC');

    const first = await router.getClientForTenant('tier-c');
    const second = await router.getClientForTenant('tier-c');
    expect(first).toBe(second);
    expect(tierCClients.size).toBe(1);
  });

  describe('tierOverride = A', () => {
    it('forces all tenants to use shared client regardless of tier', async () => {
      const { router, sharedClient, provisioner } = createRouter({ tierOverride: 'A' });
      await provisioner.provision('tier-b', 'TierB');
      await provisioner.provision('tier-c', 'TierC');

      const clientB = await router.getClientForTenant('tier-b');
      const clientC = await router.getClientForTenant('tier-c');

      expect(clientB).toBe(sharedClient);
      expect(clientC).toBe(sharedClient);
    });
  });

  it('throws for Tier C without tenantClientFactory', async () => {
    const sharedClient = new MockSqlClient();
    const provisioner = new InMemoryTenantStorageProvisioner();
    await provisioner.provision('tier-c', 'TierC');

    const router = new TenantConnectionRouter({
      sharedClient,
      provisioner,
    });

    await expect(router.getClientForTenant('tier-c')).rejects.toThrow(
      TenantConnectionRouterError,
    );
  });
});

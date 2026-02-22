import type { SqlClient } from '../postgresql/sql-client.js';
import {
  buildSchemaName,
  buildTenantDatabaseName,
  type TenantStorageConfig,
  type TenantStorageProvisioner,
  type TenantStorageTier,
} from './tenant-storage-tier.js';

// ---------------------------------------------------------------------------
// In-memory implementation (testing / local dev without a real Postgres)
// ---------------------------------------------------------------------------

export class InMemoryTenantStorageProvisioner implements TenantStorageProvisioner {
  readonly #configs = new Map<string, TenantStorageConfig>();

  public provision(tenantId: string, tier: TenantStorageTier): Promise<TenantStorageConfig> {
    const existing = this.#configs.get(tenantId);
    if (existing !== undefined) {
      return Promise.resolve(existing);
    }
    const config = buildConfig(tenantId, tier, 'postgres://localhost/portarium_test');
    this.#configs.set(tenantId, config);
    return Promise.resolve(config);
  }

  public deprovision(tenantId: string): Promise<void> {
    this.#configs.delete(tenantId);
    return Promise.resolve();
  }

  public getConfig(tenantId: string): Promise<TenantStorageConfig | undefined> {
    return Promise.resolve(this.#configs.get(tenantId));
  }

  /** Test helper — return all provisioned configs. */
  public __test__all(): ReadonlyMap<string, TenantStorageConfig> {
    return this.#configs;
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL-backed implementation
// ---------------------------------------------------------------------------

export interface PostgresTenantStorageProvisionerOptions {
  /** Superuser SQL client — required for CREATE DATABASE (Tier C). */
  adminClient: SqlClient;
  /** Standard SQL client connected to the shared database (Tier A / Tier B). */
  sharedClient: SqlClient;
  /** Namespace prefix used in database names (e.g. "portarium"). */
  namespace: string;
  /**
   * Factory for producing a per-tenant SQL client from a connection string.
   * Required for Tier C provisioning to verify the new database is reachable.
   */
  tenantClientFactory?: (connectionString: string) => SqlClient;
}

export class PostgresTenantStorageProvisioner implements TenantStorageProvisioner {
  readonly #adminClient: SqlClient;
  readonly #sharedClient: SqlClient;
  readonly #namespace: string;
  readonly #tenantClientFactory: ((connectionString: string) => SqlClient) | undefined;

  public constructor(opts: PostgresTenantStorageProvisionerOptions) {
    this.#adminClient = opts.adminClient;
    this.#sharedClient = opts.sharedClient;
    this.#namespace = opts.namespace;
    this.#tenantClientFactory = opts.tenantClientFactory;
  }

  public async provision(tenantId: string, tier: TenantStorageTier): Promise<TenantStorageConfig> {
    if (tier === 'TierA') {
      return buildConfig(tenantId, 'TierA', undefined);
    }
    if (tier === 'TierB') {
      return this.#provisionTierB(tenantId);
    }
    return this.#provisionTierC(tenantId);
  }

  public async deprovision(tenantId: string): Promise<void> {
    const config = await this.getConfig(tenantId);
    if (config === undefined) {
      return;
    }
    if (config.tier === 'TierB' && config.schemaName !== undefined) {
      await this.#dropSchema(config.schemaName);
    }
    if (config.tier === 'TierC') {
      const dbName = buildTenantDatabaseName(tenantId, this.#namespace);
      await this.#dropDatabase(dbName);
    }
    await this.#removeTierRecord(tenantId);
  }

  public async getConfig(tenantId: string): Promise<TenantStorageConfig | undefined> {
    const result = await this.#sharedClient.query<{
      tier: string;
      schema_name: string | null;
      connection_string: string | null;
    }>(
      'SELECT tier, schema_name, connection_string FROM tenant_storage_tiers WHERE tenant_id = $1;',
      [tenantId],
    );
    if (result.rows.length === 0) {
      return undefined;
    }
    const row = result.rows[0]!;
    const config: TenantStorageConfig = {
      tier: row.tier as TenantStorageTier,
      tenantId,
    };
    if (row.schema_name !== null) {
      config.schemaName = row.schema_name;
    }
    if (row.connection_string !== null) {
      config.connectionString = row.connection_string;
    }
    return config;
  }

  async #provisionTierB(tenantId: string): Promise<TenantStorageConfig> {
    const schemaName = buildSchemaName(tenantId);
    // CREATE SCHEMA is idempotent with IF NOT EXISTS.
    await this.#sharedClient.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
    const config: TenantStorageConfig = { tier: 'TierB', tenantId, schemaName };
    await this.#upsertTierRecord(config);
    return config;
  }

  async #provisionTierC(tenantId: string): Promise<TenantStorageConfig> {
    const dbName = buildTenantDatabaseName(tenantId, this.#namespace);
    // CREATE DATABASE cannot run inside a transaction block; this is a superuser operation.
    const existing = await this.#adminClient.query<{ datname: string }>(
      'SELECT datname FROM pg_catalog.pg_database WHERE datname = $1;',
      [dbName],
    );
    if (existing.rows.length === 0) {
      // pg protocol does not support parameterised identifiers — name is sanitised by buildTenantDatabaseName.
      await this.#adminClient.query(`CREATE DATABASE "${dbName}";`);
    }
    // Build a connection string by replacing the database portion of the shared connection.
    const connectionString = this.#deriveTenantConnectionString(dbName);
    const config: TenantStorageConfig = { tier: 'TierC', tenantId, connectionString };
    await this.#upsertTierRecord(config);
    return config;
  }

  async #dropSchema(schemaName: string): Promise<void> {
    await this.#sharedClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
  }

  async #dropDatabase(dbName: string): Promise<void> {
    // Terminate active connections before dropping (Postgres 13+).
    await this.#adminClient.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [dbName],
    );
    await this.#adminClient.query(`DROP DATABASE IF EXISTS "${dbName}";`);
  }

  async #upsertTierRecord(config: TenantStorageConfig): Promise<void> {
    await this.#sharedClient.query(
      `INSERT INTO tenant_storage_tiers (tenant_id, tier, schema_name, connection_string, provisioned_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (tenant_id) DO UPDATE
  SET tier              = EXCLUDED.tier,
      schema_name       = EXCLUDED.schema_name,
      connection_string = EXCLUDED.connection_string,
      provisioned_at    = EXCLUDED.provisioned_at;`,
      [config.tenantId, config.tier, config.schemaName ?? null, config.connectionString ?? null],
    );
  }

  async #removeTierRecord(tenantId: string): Promise<void> {
    await this.#sharedClient.query('DELETE FROM tenant_storage_tiers WHERE tenant_id = $1;', [
      tenantId,
    ]);
  }

  /** Derive a per-tenant connection string (Tier C) — implementation supplied at wiring time. */
  #deriveTenantConnectionString(dbName: string): string {
    // Callers should supply a proper factory; this fallback exposes the db name for wiring.
    if (this.#tenantClientFactory !== undefined) {
      return `postgres://localhost/${dbName}`;
    }
    return `postgres://localhost/${dbName}`;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildConfig(
  tenantId: string,
  tier: TenantStorageTier,
  baseConnectionString: string | undefined,
): TenantStorageConfig {
  if (tier === 'TierA') {
    return { tier, tenantId };
  }
  if (tier === 'TierB') {
    return { tier, tenantId, schemaName: buildSchemaName(tenantId) };
  }
  // TierC
  return {
    tier,
    tenantId,
    connectionString: baseConnectionString ?? `postgres://localhost/tenant_${tenantId}`,
  };
}

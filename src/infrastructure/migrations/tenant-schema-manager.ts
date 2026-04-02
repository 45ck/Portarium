import type { SqlClient } from '../postgresql/sql-client.js';
import type { SchemaMigration } from './schema-migrator.js';
import { SchemaMigrator } from './schema-migrator.js';
import {
  SchemaScopedMigrationSqlDriver,
  PostgresMigrationJournalStore,
} from './postgres-migration-drivers.js';
import type { TenantStorageProvisioner, TenantStorageConfig } from './tenant-storage-tier.js';
import { buildSchemaName } from './tenant-storage-tier.js';

/**
 * High-level orchestrator for Tier B schema-per-tenant lifecycle.
 *
 * Combines tenant storage provisioning with schema migration execution:
 * 1. provisionTenantSchema — creates the Postgres schema + runs migrations inside it.
 * 2. migrateTenantSchema — runs pending migrations in an existing tenant schema.
 * 3. listTenantSchemas — queries pg_catalog for all tenant schemas.
 * 4. getTenantConnection — returns a SqlClient scoped to the tenant's schema.
 * 5. dropTenantSchema — deprovisions and drops the schema (non-prod only).
 */
export interface TenantSchemaManagerOptions {
  sharedClient: SqlClient;
  provisioner: TenantStorageProvisioner;
  migrations: readonly SchemaMigration[];
  environment: 'production' | 'staging' | 'development' | 'test';
}

export interface TenantSchemaInfo {
  schemaName: string;
  tenantId: string | null;
  tier: string | null;
}

export class TenantSchemaManager {
  readonly #sharedClient: SqlClient;
  readonly #provisioner: TenantStorageProvisioner;
  readonly #migrations: readonly SchemaMigration[];
  readonly #environment: string;

  public constructor(options: TenantSchemaManagerOptions) {
    this.#sharedClient = options.sharedClient;
    this.#provisioner = options.provisioner;
    this.#migrations = options.migrations;
    this.#environment = options.environment;
  }

  public async provisionTenantSchema(tenantId: string): Promise<TenantStorageConfig> {
    const config = await this.#provisioner.provision(tenantId, 'TierB');
    await this.#runMigrationsInSchema(tenantId, config.schemaName!);
    return config;
  }

  public async migrateTenantSchema(tenantId: string): Promise<number> {
    const config = await this.#provisioner.getConfig(tenantId);
    if (config === undefined) {
      throw new TenantSchemaError(`Tenant ${tenantId} is not provisioned.`);
    }
    if (config.tier !== 'TierB') {
      throw new TenantSchemaError(
        `Tenant ${tenantId} is on ${config.tier}, not TierB. Cannot migrate schema.`,
      );
    }
    const schemaName = config.schemaName ?? buildSchemaName(tenantId);
    return this.#runMigrationsInSchema(tenantId, schemaName);
  }

  public async listTenantSchemas(): Promise<readonly TenantSchemaInfo[]> {
    const result = await this.#sharedClient.query<{
      schema_name: string;
      tenant_id: string | null;
      tier: string | null;
    }>(
      `SELECT
         n.nspname AS schema_name,
         t.tenant_id,
         t.tier
       FROM pg_catalog.pg_namespace n
       LEFT JOIN tenant_storage_tiers t ON t.schema_name = n.nspname
       WHERE n.nspname LIKE 'tenant\\_%'
       ORDER BY n.nspname ASC;`,
    );
    return result.rows.map((row) => ({
      schemaName: row.schema_name,
      tenantId: row.tenant_id,
      tier: row.tier,
    }));
  }

  public async getTenantConnection(tenantId: string): Promise<SchemaScopedSqlClient> {
    const config = await this.#provisioner.getConfig(tenantId);
    if (config === undefined) {
      throw new TenantSchemaError(`Tenant ${tenantId} is not provisioned.`);
    }
    if (config.tier !== 'TierB') {
      throw new TenantSchemaError(
        `Tenant ${tenantId} is on ${config.tier}. Schema-scoped connection is only for TierB.`,
      );
    }
    const schemaName = config.schemaName ?? buildSchemaName(tenantId);
    return new SchemaScopedSqlClient(this.#sharedClient, schemaName);
  }

  public async dropTenantSchema(tenantId: string): Promise<void> {
    if (this.#environment === 'production') {
      throw new TenantSchemaError(
        'dropTenantSchema is not allowed in production. Use deprovision tooling with explicit confirmation.',
      );
    }
    await this.#provisioner.deprovision(tenantId);
  }

  async #runMigrationsInSchema(tenantId: string, schemaName: string): Promise<number> {
    const tenantMigrations = this.#migrations.filter(
      (m) => m.scope === 'Tenant' || m.scope === 'Global',
    );
    if (tenantMigrations.length === 0) {
      return 0;
    }

    const journal = new PostgresMigrationJournalStore(this.#sharedClient);
    const driver = new SchemaScopedMigrationSqlDriver(this.#sharedClient, schemaName);
    const migrator = new SchemaMigrator({ journal });

    const result = await migrator.run(tenantMigrations, driver, {
      phase: 'Expand',
      tenants: [tenantId],
    });

    return result.applied.length;
  }
}

export class TenantSchemaError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TenantSchemaError';
  }
}

/**
 * SqlClient wrapper that sets search_path to a tenant schema before each query.
 * This ensures all unqualified table references resolve to the tenant's schema.
 */
export class SchemaScopedSqlClient implements SqlClient {
  readonly #inner: SqlClient;
  readonly #schemaName: string;

  public constructor(inner: SqlClient, schemaName: string) {
    this.#inner = inner;
    this.#schemaName = schemaName;
  }

  public get schemaName(): string {
    return this.#schemaName;
  }

  public async query<Row extends Record<string, unknown>>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<{ rows: readonly Row[]; rowCount: number }> {
    await this.#inner.query(`SET search_path TO "${this.#schemaName}", public;`);
    return this.#inner.query<Row>(statement, params);
  }

  public async withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return this.#inner.withTransaction(async (tx) => {
      await tx.query(`SET search_path TO "${this.#schemaName}", public;`);
      return fn(tx);
    });
  }
}

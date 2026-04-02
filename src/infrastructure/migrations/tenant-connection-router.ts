import type { SqlClient, SqlQueryResult, SqlRow } from '../postgresql/sql-client.js';
import type { TenantStorageProvisioner } from './tenant-storage-tier.js';
import { buildSchemaName } from './tenant-storage-tier.js';

/**
 * Routes SQL queries to the correct schema/database based on the tenant's storage tier.
 *
 * - Tier A: passes queries through to the shared client unchanged.
 * - Tier B: sets search_path to the tenant's dedicated schema before each query.
 * - Tier C: uses a dedicated SqlClient from the factory (per-database connection).
 *
 * TENANCY_TIER env var override: when set to 'A', all tenants are treated as Tier A
 * regardless of their provisioned tier. This is a safety valve for rollback scenarios.
 */
export interface TenantConnectionRouterOptions {
  sharedClient: SqlClient;
  provisioner: TenantStorageProvisioner;
  tenantClientFactory?: (connectionString: string) => SqlClient;
  tenancyTierOverride?: 'A' | 'B' | undefined;
}

export class TenantConnectionRouter {
  readonly #sharedClient: SqlClient;
  readonly #provisioner: TenantStorageProvisioner;
  readonly #tenantClientFactory: ((connectionString: string) => SqlClient) | undefined;
  readonly #tierOverride: 'A' | 'B' | undefined;
  readonly #tierCClients = new Map<string, SqlClient>();

  public constructor(options: TenantConnectionRouterOptions) {
    this.#sharedClient = options.sharedClient;
    this.#provisioner = options.provisioner;
    this.#tenantClientFactory = options.tenantClientFactory;
    this.#tierOverride = options.tenancyTierOverride;
  }

  public async getClientForTenant(tenantId: string): Promise<SqlClient> {
    if (this.#tierOverride === 'A') {
      return this.#sharedClient;
    }

    const config = await this.#provisioner.getConfig(tenantId);
    if (config === undefined || config.tier === 'TierA') {
      return this.#sharedClient;
    }

    if (config.tier === 'TierB') {
      const schemaName = config.schemaName ?? buildSchemaName(tenantId);
      return new SchemaScopedRoutedClient(this.#sharedClient, schemaName);
    }

    // Tier C: dedicated database connection.
    if (config.connectionString === undefined) {
      throw new TenantConnectionRouterError(
        `Tier C tenant ${tenantId} has no connection string configured.`,
      );
    }
    return this.#getOrCreateTierCClient(tenantId, config.connectionString);
  }

  #getOrCreateTierCClient(tenantId: string, connectionString: string): SqlClient {
    const existing = this.#tierCClients.get(tenantId);
    if (existing !== undefined) {
      return existing;
    }
    if (this.#tenantClientFactory === undefined) {
      throw new TenantConnectionRouterError(
        `No tenantClientFactory configured — cannot connect to Tier C database for ${tenantId}.`,
      );
    }
    const client = this.#tenantClientFactory(connectionString);
    this.#tierCClients.set(tenantId, client);
    return client;
  }
}

export class TenantConnectionRouterError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TenantConnectionRouterError';
  }
}

class SchemaScopedRoutedClient implements SqlClient {
  readonly #inner: SqlClient;
  readonly #schemaName: string;

  public constructor(inner: SqlClient, schemaName: string) {
    this.#inner = inner;
    this.#schemaName = schemaName;
  }

  public async query<Row extends SqlRow>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>> {
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

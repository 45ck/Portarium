/**
 * Multi-tenant storage tier types for ADR-0049.
 *
 * Tier A: shared database, tenant scoping enforced at the data-access layer (default).
 * Tier B: schema-per-tenant within the shared database.
 * Tier C: dedicated database per tenant for regulated/high-value tenants.
 */

export type TenantStorageTier = 'TierA' | 'TierB' | 'TierC';

export interface TenantStorageConfig {
  tier: TenantStorageTier;
  tenantId: string;
  /** Tier B only: the PostgreSQL schema name dedicated to this tenant. */
  schemaName?: string;
  /** Tier C only: connection string targeting the tenant's dedicated database. */
  connectionString?: string;
}

export interface TenantStorageProvisioner {
  /** Provision storage resources for a tenant at the requested tier. Idempotent. */
  provision(tenantId: string, tier: TenantStorageTier): Promise<TenantStorageConfig>;
  /** Deprovision storage resources for a tenant. Destructive — removes data. */
  deprovision(tenantId: string): Promise<void>;
  /** Return current config for a tenant, or undefined if not provisioned. */
  getConfig(tenantId: string): Promise<TenantStorageConfig | undefined>;
}

/**
 * Derive a safe PostgreSQL schema name for a Tier B tenant.
 * Only lowercase alphanumeric and underscore characters are allowed in a bare identifier.
 */
export function buildSchemaName(tenantId: string): string {
  const sanitized = tenantId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `tenant_${sanitized}`;
}

/**
 * Derive a safe PostgreSQL database name for a Tier C tenant.
 */
export function buildTenantDatabaseName(tenantId: string, namespace: string): string {
  const sanitized = tenantId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const ns = namespace.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `${ns}_tenant_${sanitized}`;
}

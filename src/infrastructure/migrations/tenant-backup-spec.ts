import type { TenantStorageConfig, TenantStorageTier } from './tenant-storage-tier.js';

/**
 * Per-tier backup specification for a tenant's storage.
 *
 * This is a value object describing what a backup job needs to do —
 * actual execution is delegated to the platform backup operator
 * (e.g. a CronJob or cloud-native snapshot).
 */
export interface TenantBackupSpec {
  /** Tenant the backup targets. */
  tenantId: string;
  tier: TenantStorageTier;
  /**
   * Backup strategy derived from the storage tier:
   * - TierA: row-filtered export from the shared database.
   * - TierB: pg_dump with --schema targeting the tenant schema.
   * - TierC: pg_dump of the dedicated database.
   */
  strategy: 'shared_filtered' | 'schema_dump' | 'database_dump';
  /** PostgreSQL schema name to target (Tier B). */
  schemaName?: string;
  /** Connection string of the per-tenant database (Tier C). */
  connectionString?: string;
  /**
   * pg_dump / restore arguments that implement the strategy.
   * These are informational — callers build actual commands from them.
   */
  pgDumpArgs: readonly string[];
  retentionDays: number;
}

/**
 * Build a per-tier backup specification from a provisioned TenantStorageConfig.
 */
export function buildBackupSpec(
  config: TenantStorageConfig,
  retentionDays: number,
): TenantBackupSpec {
  if (config.tier === 'TierA') {
    return {
      tenantId: config.tenantId,
      tier: 'TierA',
      strategy: 'shared_filtered',
      pgDumpArgs: [
        '--table=domain_documents',
        `--where=tenant_id='${escapeSqlLiteral(config.tenantId)}'`,
      ],
      retentionDays,
    };
  }

  if (config.tier === 'TierB') {
    const schemaName = config.schemaName ?? `tenant_${config.tenantId}`;
    return {
      tenantId: config.tenantId,
      tier: 'TierB',
      strategy: 'schema_dump',
      schemaName,
      pgDumpArgs: [`--schema=${schemaName}`, '--format=custom'],
      retentionDays,
    };
  }

  // TierC
  const connectionString = config.connectionString ?? '';
  return {
    tenantId: config.tenantId,
    tier: 'TierC',
    strategy: 'database_dump',
    connectionString,
    pgDumpArgs: ['--format=custom', '--compress=6'],
    retentionDays,
  };
}

/** Escape a value for use in a SQL literal (single-quote doubling only). */
function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

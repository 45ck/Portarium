/**
 * TenantStorageProvisioner
 *
 * Schema-per-tenant lifecycle manager for the shared storage tier.
 * Runs inside the control-plane on demand (workspace create / upgrade / delete).
 *
 * Responsibilities:
 *  - provisionSchema  — idempotent: creates schema + role if they do not exist
 *  - deprovisionSchema — drops schema (with all objects) and revokes role
 *  - backupSchema      — triggers a pg_dump of the tenant schema to S3
 *  - restoreSchema     — restores from a previous backup
 *
 * For dedicated-tier tenants, lifecycle is handled by Terraform (the
 * tenant-storage module). This provisioner only touches the shared DB.
 *
 * Bead: bead-0392
 */

import type { SqlClient } from '../postgresql/sql-client.js';

// ── Types ─────────────────────────────────────────────────────────────────

export type StorageTier = 'shared' | 'dedicated';

export interface TenantStorageConfig {
  /** Tenant identifier (lowercase alphanumeric + hyphens). */
  tenantId: string;
  tier: StorageTier;
  /** Name of the shared PostgreSQL database (shared tier only). */
  sharedDatabase?: string;
}

export interface ProvisionResult {
  tenantId: string;
  schemaName: string;
  roleName: string;
  alreadyExisted: boolean;
}

export interface DeprovisionResult {
  tenantId: string;
  schemaName: string;
  dropped: boolean;
}

export interface BackupResult {
  tenantId: string;
  schemaName: string;
  /** S3 object key of the backup artefact. */
  s3Key: string;
  sizeBytes: number;
  completedAt: Date;
}

export interface RestoreResult {
  tenantId: string;
  schemaName: string;
  restoredFromKey: string;
  completedAt: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert kebab-case tenant ID to a safe PostgreSQL identifier. */
export function tenantToSchemaName(tenantId: string): string {
  return `tenant_${tenantId.replace(/-/g, '_')}`;
}

/** Role name that owns the tenant schema. */
export function tenantToRoleName(tenantId: string): string {
  return `role_${tenantId.replace(/-/g, '_')}`;
}

function assertValidTenantId(tenantId: string): void {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(tenantId)) {
    throw new Error(
      `Invalid tenantId "${tenantId}": must be lowercase alphanumeric with hyphens, 3–63 chars.`,
    );
  }
}

// ── Provisioner class ──────────────────────────────────────────────────────

export class TenantStorageProvisioner {
  constructor(private readonly sql: SqlClient) {}

  /**
   * Idempotently create the tenant schema and its owning role.
   * Safe to call multiple times — returns alreadyExisted=true if the schema
   * was already present.
   */
  async provisionSchema(config: TenantStorageConfig): Promise<ProvisionResult> {
    assertValidTenantId(config.tenantId);

    const schemaName = tenantToSchemaName(config.tenantId);
    const roleName = tenantToRoleName(config.tenantId);

    // Check if schema already exists.
    const existing = await this.sql.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName],
    );

    if (existing.rowCount > 0) {
      return { tenantId: config.tenantId, schemaName, roleName, alreadyExisted: true };
    }

    // Create role if it doesn't exist (idempotent pattern).
    await this.sql.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) THEN
           EXECUTE format('CREATE ROLE %I NOLOGIN', $1::text);
         END IF;
       END $$`,
      [roleName],
    );

    // Create schema owned by the tenant role.
    await this.sql.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName} AUTHORIZATION ${roleName}`);

    // Grant usage to shared service account so the application can connect.
    await this.sql.query(`GRANT USAGE ON SCHEMA ${schemaName} TO portarium_shared`);
    await this.sql.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName}
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portarium_shared`,
    );

    return { tenantId: config.tenantId, schemaName, roleName, alreadyExisted: false };
  }

  /**
   * Drop the tenant schema and revoke its role.
   * Returns dropped=false if the schema did not exist.
   */
  async deprovisionSchema(tenantId: string): Promise<DeprovisionResult> {
    assertValidTenantId(tenantId);

    const schemaName = tenantToSchemaName(tenantId);
    const roleName = tenantToRoleName(tenantId);

    const existing = await this.sql.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName],
    );

    if (existing.rowCount === 0) {
      return { tenantId, schemaName, dropped: false };
    }

    // Revoke default privileges first to avoid stale grants.
    await this.sql.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName}
       REVOKE ALL ON TABLES FROM portarium_shared`,
    );
    await this.sql.query(`REVOKE ALL ON SCHEMA ${schemaName} FROM portarium_shared`);

    // Drop schema and all contained objects.
    await this.sql.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);

    // Drop role (will fail if role still owns objects — intentional safety guard).
    await this.sql.query(
      `DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) THEN
           EXECUTE format('DROP ROLE %I', $1::text);
         END IF;
       END $$`,
      [roleName],
    );

    return { tenantId, schemaName, dropped: true };
  }

  /**
   * List all tenant schemas currently provisioned in the shared DB.
   * Returns tenant IDs (derived from schema names).
   */
  async listProvisionedTenants(): Promise<string[]> {
    const result = await this.sql.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name LIKE 'tenant_%'
       ORDER BY schema_name`,
    );

    return result.rows.map((r) => r.schema_name.replace(/^tenant_/, '').replace(/_/g, '-'));
  }
}

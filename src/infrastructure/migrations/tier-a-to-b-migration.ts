import type { SqlClient } from '../postgresql/sql-client.js';
import { buildSchemaName } from './tenant-storage-tier.js';

/**
 * Migrates a single tenant's data from Tier A (shared tables) to Tier B (dedicated schema).
 *
 * Prerequisite: the target schema must already exist and contain the required tables
 * (created by TenantSchemaManager.provisionTenantSchema).
 *
 * Steps:
 * 1. Copy domain_documents rows for the tenant into the tenant schema.
 * 2. Copy workspace_summary rows for the tenant.
 * 3. Copy workflow_runs rows for the tenant.
 * 4. Optionally delete the source rows from the shared tables (destructive).
 *
 * All copy operations run within a transaction for consistency.
 */
export interface TierAToTierBMigrationOptions {
  tenantId: string;
  sharedClient: SqlClient;
  schemaName?: string;
  deleteSourceRows?: boolean;
}

export interface TierAToTierBMigrationResult {
  tenantId: string;
  schemaName: string;
  copiedDomainDocuments: number;
  copiedWorkspaceSummary: number;
  copiedWorkflowRuns: number;
  deletedSourceRows: boolean;
}

export async function migrateTenantTierAToB(
  options: TierAToTierBMigrationOptions,
): Promise<TierAToTierBMigrationResult> {
  const { tenantId, sharedClient, deleteSourceRows = false } = options;
  const schemaName = options.schemaName ?? buildSchemaName(tenantId);

  return sharedClient.withTransaction(async (tx) => {
    const copiedDomainDocuments = await copyTable(tx, 'domain_documents', schemaName, tenantId);
    const copiedWorkspaceSummary = await copyTable(tx, 'workspace_summary', schemaName, tenantId);
    const copiedWorkflowRuns = await copyTable(tx, 'workflow_runs', schemaName, tenantId);

    if (deleteSourceRows) {
      await deleteSharedRows(tx, 'domain_documents', tenantId);
      await deleteSharedRows(tx, 'workspace_summary', tenantId);
      await deleteSharedRows(tx, 'workflow_runs', tenantId);
    }

    return {
      tenantId,
      schemaName,
      copiedDomainDocuments,
      copiedWorkspaceSummary,
      copiedWorkflowRuns,
      deletedSourceRows: deleteSourceRows,
    };
  });
}

async function copyTable(
  tx: SqlClient,
  tableName: string,
  schemaName: string,
  tenantId: string,
): Promise<number> {
  // Check if the source table exists and has rows for this tenant before copying.
  const check = await tx.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM public."${tableName}" WHERE tenant_id = $1;`,
    [tenantId],
  );
  const count = parseInt(check.rows[0]?.cnt ?? '0', 10);
  if (count === 0) {
    return 0;
  }

  await tx.query(
    `INSERT INTO "${schemaName}"."${tableName}"
     SELECT * FROM public."${tableName}"
     WHERE tenant_id = $1
     ON CONFLICT DO NOTHING;`,
    [tenantId],
  );

  return count;
}

async function deleteSharedRows(tx: SqlClient, tableName: string, tenantId: string): Promise<void> {
  await tx.query(`DELETE FROM public."${tableName}" WHERE tenant_id = $1;`, [tenantId]);
}

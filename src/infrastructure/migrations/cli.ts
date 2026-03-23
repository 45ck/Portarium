import { NodePostgresSqlClient } from '../postgresql/node-postgres-sql-client.js';
import { DEFAULT_SCHEMA_MIGRATIONS } from './default-migrations.js';
import {
  PostgresAdvisoryLock,
  PostgresMigrationJournalStore,
  PostgresMigrationSqlDriver,
} from './postgres-migration-drivers.js';
import {
  InMemoryMigrationJournalStore,
  InMemoryMigrationSqlDriver,
  SchemaMigrator,
  type MigrationPhase,
  type MigrationRunResult,
} from './schema-migrator.js';
import { PostgresTenantStorageProvisioner } from './tenant-storage-provisioner.js';
import type { TenantStorageTier } from './tenant-storage-tier.js';

// Tables to drop in reverse dependency order for a deterministic reset.
const RESET_DROP_STATEMENTS: readonly string[] = [
  'DROP TABLE IF EXISTS tenant_storage_tiers;',
  'DROP INDEX IF EXISTS idx_workflow_runs_status;',
  'DROP TABLE IF EXISTS workflow_runs;',
  'DROP INDEX IF EXISTS idx_domain_documents_workspace;',
  'DROP TABLE IF EXISTS domain_documents;',
  'DROP TABLE IF EXISTS workspace_registry;',
  'DROP TABLE IF EXISTS schema_migrations;',
];

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'check';

  if (command === 'check') {
    runCheck();
    return;
  }
  if (command === 'plan') {
    await runPlan();
    return;
  }
  if (command === 'dry-run') {
    await runDryRun();
    return;
  }
  if (command === 'status') {
    await runStatus();
    return;
  }
  if (command === 'apply') {
    await runApply();
    return;
  }
  if (command === 'bootstrap') {
    await runBootstrap();
    return;
  }
  if (command === 'reset') {
    await runReset();
    return;
  }
  if (command === 'provision-tenant') {
    await runProvisionTenant();
    return;
  }
  if (command === 'deprovision-tenant') {
    await runDeprovisionTenant();
    return;
  }

  throw new Error(
    `Unsupported command: ${command}. Available: check, plan, dry-run, status, apply, bootstrap, reset, provision-tenant, deprovision-tenant`,
  );
}

function runCheck(): void {
  const migrator = new SchemaMigrator({ journal: new InMemoryMigrationJournalStore() });
  migrator.validateRegistry(DEFAULT_SCHEMA_MIGRATIONS);
  process.stdout.write(
    `Schema migration registry OK (${DEFAULT_SCHEMA_MIGRATIONS.length} migrations).\n`,
  );
}

async function runPlan(): Promise<void> {
  const phase = parsePhase(readArg('--phase') ?? 'expand');
  const tenants = parseTenants(readArg('--tenants'));
  const allowContractBreaking = readFlag('--allow-contract-breaking');
  const migrator = new SchemaMigrator({ journal: new InMemoryMigrationJournalStore() });

  const plan = await migrator.plan(DEFAULT_SCHEMA_MIGRATIONS, {
    phase,
    tenants,
    allowContractBreaking,
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        phase,
        tenants,
        steps: plan.map((step) => ({
          version: step.migration.version,
          migrationId: step.migration.id,
          target: step.target,
          statementCount: step.migration.upSql.length,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

async function runDryRun(): Promise<void> {
  const phase = parsePhase(readArg('--phase') ?? 'expand');
  const tenants = parseTenants(readArg('--tenants'));
  const allowContractBreaking = readFlag('--allow-contract-breaking');
  const migrator = new SchemaMigrator({ journal: new InMemoryMigrationJournalStore() });
  const driver = new InMemoryMigrationSqlDriver();

  const result = await migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, {
    phase,
    tenants,
    allowContractBreaking,
    rollbackOnError: true,
  });

  const executedStatements = driver.__test__executed();

  // Print human-readable SQL summary followed by JSON details
  process.stdout.write(`-- Dry-run: ${phase} phase, ${result.applied.length} migration(s)\n`);
  process.stdout.write(`-- Tenants: ${tenants.join(', ')}\n`);
  process.stdout.write(`-- Total SQL statements: ${executedStatements.length}\n`);
  process.stdout.write('--\n');

  for (const step of result.applied) {
    process.stdout.write(
      `-- Migration v${step.migration.version}: ${step.migration.id} → ${step.target}\n`,
    );
    for (const statement of step.migration.upSql) {
      process.stdout.write(`${statement}\n`);
    }
    process.stdout.write('\n');
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        phase,
        applied: result.applied.map((step) => ({
          version: step.migration.version,
          migrationId: step.migration.id,
          target: step.target,
        })),
        executedStatements,
      },
      null,
      2,
    )}\n`,
  );
}

/**
 * Shows applied vs pending migrations by querying the real schema_migrations table.
 *
 * Requires DATABASE_URL. Uses the Postgres journal to determine which migrations
 * have been applied and which are still pending.
 */
async function runStatus(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  const tenants = parseTenants(readArg('--tenants'));
  const sqlClient = new NodePostgresSqlClient({ connectionString });

  try {
    // Ensure schema_migrations table exists before querying
    const journalStore = await createSafeJournalStore(sqlClient);
    const migrator = new SchemaMigrator({ journal: journalStore });
    const entries = await migrator.status(DEFAULT_SCHEMA_MIGRATIONS, tenants);

    // Print table header
    process.stdout.write(
      padRight('version', 10) +
        padRight('phase', 12) +
        padRight('scope', 10) +
        padRight('target', 24) +
        padRight('status', 12) +
        padRight('applied_at', 28) +
        'migration_id\n',
    );
    process.stdout.write('─'.repeat(120) + '\n');

    let appliedCount = 0;
    let pendingCount = 0;

    for (const entry of entries) {
      const statusLabel = entry.status === 'applied' ? 'applied' : 'PENDING';
      if (entry.status === 'applied') appliedCount++;
      else pendingCount++;

      process.stdout.write(
        padRight(String(entry.version), 10) +
          padRight(entry.phase, 12) +
          padRight(entry.scope, 10) +
          padRight(entry.target, 24) +
          padRight(statusLabel, 12) +
          padRight(entry.appliedAt ?? '-', 28) +
          entry.migrationId +
          '\n',
      );
    }

    process.stdout.write('─'.repeat(120) + '\n');
    process.stdout.write(
      `Total: ${entries.length} | Applied: ${appliedCount} | Pending: ${pendingCount}\n`,
    );
  } finally {
    await sqlClient.close();
  }
}

/**
 * Applies migrations to the real database with advisory locking and Postgres journal.
 *
 * Supports both Expand and Contract phases. Uses pg_advisory_lock to prevent
 * concurrent migration runs against the same database.
 */
async function runApply(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  const phase = parsePhase(readArg('--phase') ?? 'expand');
  const tenants = parseTenants(readArg('--tenants'));
  const allowContractBreaking = readFlag('--allow-contract-breaking');
  const sqlClient = new NodePostgresSqlClient({ connectionString });

  try {
    await withAdvisoryLock(sqlClient, async () => {
      // Bootstrap creates schema_migrations if needed (migration v1 includes it).
      // For apply with Postgres journal we need the table to exist first.
      // If it doesn't exist, we bootstrap with the first migration that creates it.
      const journalStore = await createSafeJournalStore(sqlClient);
      const migrator = new SchemaMigrator({ journal: journalStore });
      const driver = new PostgresMigrationSqlDriver(sqlClient);

      const result = await migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, {
        phase,
        tenants,
        allowContractBreaking,
      });

      printApplyResult(phase, result);
    });
  } finally {
    await sqlClient.close();
  }
}

async function runBootstrap(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  const tenants = parseTenants(readArg('--tenants'));
  const sqlClient = new NodePostgresSqlClient({ connectionString });
  try {
    await withAdvisoryLock(sqlClient, async () => {
      const result = await applyExpandMigrations(sqlClient, tenants);
      printBootstrapResult(result);
    });
  } finally {
    await sqlClient.close();
  }
}

async function runReset(): Promise<void> {
  if (!readFlag('--confirm')) {
    process.stderr.write('reset is destructive — pass --confirm to proceed (destroys all data).\n');
    process.exitCode = 1;
    return;
  }
  const connectionString = requireEnv('DATABASE_URL');
  const tenants = parseTenants(readArg('--tenants'));
  const sqlClient = new NodePostgresSqlClient({ connectionString });
  try {
    await withAdvisoryLock(sqlClient, async () => {
      for (const statement of RESET_DROP_STATEMENTS) {
        await sqlClient.query(statement);
      }
      process.stdout.write('Reset: dropped all known tables.\n');
      const result = await applyExpandMigrations(sqlClient, tenants);
      printBootstrapResult(result);
    });
  } finally {
    await sqlClient.close();
  }
}

/**
 * Creates a PostgresMigrationJournalStore, gracefully handling the case where
 * schema_migrations does not yet exist (first-ever run).
 *
 * On first-ever run, falls back to an InMemoryMigrationJournalStore so that
 * migration v1 (which creates the table) can be applied. After that,
 * subsequent calls will use the Postgres journal.
 */
async function createSafeJournalStore(
  sqlClient: NodePostgresSqlClient,
): Promise<PostgresMigrationJournalStore | InMemoryMigrationJournalStore> {
  try {
    const result = await sqlClient.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') AS exists;",
    );
    if (result.rows[0]?.exists === true) {
      return new PostgresMigrationJournalStore(sqlClient);
    }
  } catch {
    // Table doesn't exist or can't query — fall back to in-memory
  }
  return new InMemoryMigrationJournalStore();
}

async function applyExpandMigrations(
  sqlClient: NodePostgresSqlClient,
  tenants: readonly string[],
): Promise<MigrationRunResult> {
  const journalStore = await createSafeJournalStore(sqlClient);
  const migrator = new SchemaMigrator({ journal: journalStore });
  const driver = new PostgresMigrationSqlDriver(sqlClient);
  return migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, { phase: 'Expand', tenants });
}

/**
 * Acquires a PostgreSQL advisory lock for the duration of the migration operation.
 * Prevents concurrent migration runs against the same database.
 */
async function withAdvisoryLock(
  sqlClient: NodePostgresSqlClient,
  fn: () => Promise<void>,
): Promise<void> {
  const lock = new PostgresAdvisoryLock(sqlClient);
  const acquired = await lock.tryAcquire();
  if (!acquired) {
    throw new Error(
      'Could not acquire migration advisory lock — another migration may be running. ' +
        'If this is unexpected, check for stale advisory locks in pg_locks.',
    );
  }
  try {
    await fn();
  } finally {
    await lock.release();
  }
}

function printApplyResult(phase: MigrationPhase, result: MigrationRunResult): void {
  if (result.applied.length === 0) {
    process.stdout.write(`Apply (${phase}): no pending migrations.\n`);
    return;
  }
  process.stdout.write(
    `Apply (${phase}) complete. Applied ${result.applied.length} migration step(s).\n`,
  );
  for (const step of result.applied) {
    process.stdout.write(`  + v${step.migration.version} ${step.migration.id} → ${step.target}\n`);
  }
}

function printBootstrapResult(result: MigrationRunResult): void {
  process.stdout.write(`Bootstrap complete. Applied ${result.applied.length} migration step(s).\n`);
  for (const step of result.applied) {
    process.stdout.write(`  + ${step.migration.id} → ${step.target}\n`);
  }
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text + ' ' : text + ' '.repeat(width - text.length);
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function readFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePhase(raw: string): MigrationPhase {
  if (raw === 'expand') {
    return 'Expand';
  }
  if (raw === 'contract') {
    return 'Contract';
  }
  throw new Error(`Invalid phase: ${raw}. Use expand|contract.`);
}

function parseTenants(raw: string | undefined): readonly string[] {
  if (raw === undefined || raw.trim().length === 0) {
    return ['workspace-default'];
  }
  return raw
    .split(',')
    .map((tenant) => tenant.trim())
    .filter((tenant) => tenant.length > 0);
}

function parseTier(raw: string | undefined): TenantStorageTier {
  if (raw === 'TierA' || raw === 'TierB' || raw === 'TierC') {
    return raw;
  }
  throw new Error(`Invalid tier: ${raw ?? '(none)'}. Use TierA|TierB|TierC.`);
}

async function runProvisionTenant(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  const tenantId = readArg('--tenant-id');
  if (tenantId === undefined || tenantId.trim() === '') {
    throw new Error('provision-tenant requires --tenant-id');
  }
  const tier = parseTier(readArg('--tier'));
  const namespace = readArg('--namespace') ?? 'portarium';

  const sqlClient = new NodePostgresSqlClient({ connectionString });
  try {
    const provisioner = new PostgresTenantStorageProvisioner({
      adminClient: sqlClient,
      sharedClient: sqlClient,
      namespace,
    });
    const config = await provisioner.provision(tenantId.trim(), tier);
    process.stdout.write(
      `${JSON.stringify({ action: 'provisioned', tenantId: config.tenantId, tier: config.tier, schemaName: config.schemaName ?? null, connectionString: config.connectionString ?? null }, null, 2)}\n`,
    );
  } finally {
    await sqlClient.close();
  }
}

async function runDeprovisionTenant(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  const tenantId = readArg('--tenant-id');
  if (tenantId === undefined || tenantId.trim() === '') {
    throw new Error('deprovision-tenant requires --tenant-id');
  }
  if (!readFlag('--confirm')) {
    process.stderr.write(
      'deprovision-tenant is destructive — pass --confirm to proceed (destroys tenant data).\n',
    );
    process.exitCode = 1;
    return;
  }

  const sqlClient = new NodePostgresSqlClient({ connectionString });
  try {
    const provisioner = new PostgresTenantStorageProvisioner({
      adminClient: sqlClient,
      sharedClient: sqlClient,
      namespace: readArg('--namespace') ?? 'portarium',
    });
    await provisioner.deprovision(tenantId.trim());
    process.stdout.write(
      `${JSON.stringify({ action: 'deprovisioned', tenantId: tenantId.trim() }, null, 2)}\n`,
    );
  } finally {
    await sqlClient.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

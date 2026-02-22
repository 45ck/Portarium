import { NodePostgresSqlClient } from '../postgresql/node-postgres-sql-client.js';
import { DEFAULT_SCHEMA_MIGRATIONS } from './default-migrations.js';
import { PostgresMigrationSqlDriver } from './postgres-migration-drivers.js';
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

  throw new Error(`Unsupported command: ${command}`);
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

  process.stdout.write(
    `${JSON.stringify(
      {
        phase,
        applied: result.applied.map((step) => ({
          version: step.migration.version,
          migrationId: step.migration.id,
          target: step.target,
        })),
        executedStatements: driver.__test__executed(),
      },
      null,
      2,
    )}\n`,
  );
}

async function runBootstrap(): Promise<void> {
  const connectionString = requireEnv('DATABASE_URL');
  const tenants = parseTenants(readArg('--tenants'));
  const sqlClient = new NodePostgresSqlClient({ connectionString });
  try {
    const result = await applyExpandMigrations(sqlClient, tenants);
    printBootstrapResult(result);
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
    for (const statement of RESET_DROP_STATEMENTS) {
      await sqlClient.query(statement);
    }
    process.stdout.write('Reset: dropped all known tables.\n');
    const result = await applyExpandMigrations(sqlClient, tenants);
    printBootstrapResult(result);
  } finally {
    await sqlClient.close();
  }
}

async function applyExpandMigrations(
  sqlClient: NodePostgresSqlClient,
  tenants: readonly string[],
): Promise<MigrationRunResult> {
  const migrator = new SchemaMigrator({ journal: new InMemoryMigrationJournalStore() });
  const driver = new PostgresMigrationSqlDriver(sqlClient);
  return migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, { phase: 'Expand', tenants });
}

function printBootstrapResult(result: MigrationRunResult): void {
  process.stdout.write(`Bootstrap complete. Applied ${result.applied.length} migration step(s).\n`);
  for (const step of result.applied) {
    process.stdout.write(`  + ${step.migration.id} → ${step.target}\n`);
  }
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

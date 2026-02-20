import { DEFAULT_SCHEMA_MIGRATIONS } from './default-migrations.js';
import {
  InMemoryMigrationJournalStore,
  InMemoryMigrationSqlDriver,
  SchemaMigrator,
  type MigrationPhase,
} from './schema-migrator.js';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'check';

  const migrator = new SchemaMigrator({ journal: new InMemoryMigrationJournalStore() });

  if (command === 'check') {
    migrator.validateRegistry(DEFAULT_SCHEMA_MIGRATIONS);
    process.stdout.write(
      `Schema migration registry OK (${DEFAULT_SCHEMA_MIGRATIONS.length} migrations).\n`,
    );
    return;
  }

  if (command === 'plan') {
    const phase = parsePhase(readArg('--phase') ?? 'expand');
    const tenants = parseTenants(readArg('--tenants'));
    const allowContractBreaking = readFlag('--allow-contract-breaking');

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
    return;
  }

  if (command === 'dry-run') {
    const phase = parsePhase(readArg('--phase') ?? 'expand');
    const tenants = parseTenants(readArg('--tenants'));
    const allowContractBreaking = readFlag('--allow-contract-breaking');

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
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
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

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

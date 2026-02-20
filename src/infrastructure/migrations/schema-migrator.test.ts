import { describe, expect, it } from 'vitest';

import { DEFAULT_SCHEMA_MIGRATIONS } from './default-migrations.js';
import {
  InMemoryMigrationJournalStore,
  InMemoryMigrationSqlDriver,
  MigrationExecutionError,
  MigrationRegistryError,
  SchemaMigrator,
  type MigrationSqlDriver,
} from './schema-migrator.js';

class FailOnStatementDriver implements MigrationSqlDriver {
  readonly #needle: string;
  readonly #inner = new InMemoryMigrationSqlDriver();

  public constructor(needle: string) {
    this.#needle = needle;
  }

  public execute(params: Readonly<{ target: string; statement: string }>): Promise<void> {
    if (params.statement.includes(this.#needle)) {
      return Promise.reject(new Error('synthetic failure'));
    }
    return this.#inner.execute(params);
  }

  public executed(): readonly Readonly<{ target: string; statement: string }>[] {
    return this.#inner.__test__executed();
  }
}

describe('SchemaMigrator', () => {
  it('validates default registry', () => {
    const migrator = new SchemaMigrator({ journal: new InMemoryMigrationJournalStore() });
    expect(() => migrator.validateRegistry(DEFAULT_SCHEMA_MIGRATIONS)).not.toThrow();
  });

  it('plans expand migrations for global and tenant targets', async () => {
    const journal = new InMemoryMigrationJournalStore();
    const migrator = new SchemaMigrator({ journal });

    const plan = await migrator.plan(DEFAULT_SCHEMA_MIGRATIONS, {
      phase: 'Expand',
      tenants: ['workspace-b', 'workspace-a'],
    });

    expect(plan.map((step) => `${step.migration.id}:${step.target}`)).toEqual([
      '0001_expand_runtime_schema_baseline:global',
      '0002_expand_run_projection_columns:workspace-a',
      '0002_expand_run_projection_columns:workspace-b',
    ]);
  });

  it('rejects contract-breaking migrations unless explicitly allowed', async () => {
    const migrator = new SchemaMigrator({ journal: new InMemoryMigrationJournalStore() });

    await expect(
      migrator.plan(DEFAULT_SCHEMA_MIGRATIONS, {
        phase: 'Contract',
        tenants: ['workspace-a'],
      }),
    ).rejects.toBeInstanceOf(MigrationRegistryError);
  });

  it('enforces prior expand migration before contract on each tenant', async () => {
    const journal = new InMemoryMigrationJournalStore();
    const migrator = new SchemaMigrator({ journal });

    await expect(
      migrator.plan(DEFAULT_SCHEMA_MIGRATIONS, {
        phase: 'Contract',
        tenants: ['workspace-a'],
        allowContractBreaking: true,
      }),
    ).rejects.toBeInstanceOf(MigrationRegistryError);

    const driver = new InMemoryMigrationSqlDriver();
    await migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, {
      phase: 'Expand',
      tenants: ['workspace-a'],
    });

    const contractPlan = await migrator.plan(DEFAULT_SCHEMA_MIGRATIONS, {
      phase: 'Contract',
      tenants: ['workspace-a'],
      allowContractBreaking: true,
    });

    expect(contractPlan).toHaveLength(1);
    expect(contractPlan[0]?.migration.id).toBe('0003_contract_drop_legacy_run_status');
    expect(contractPlan[0]?.target).toBe('workspace-a');
  });

  it('supports rollback safety when a migration statement fails', async () => {
    const journal = new InMemoryMigrationJournalStore();
    const migrator = new SchemaMigrator({ journal });
    const driver = new FailOnStatementDriver('status_transitioned_at');

    await expect(
      migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, {
        phase: 'Expand',
        tenants: ['workspace-a'],
        rollbackOnError: true,
      }),
    ).rejects.toBeInstanceOf(MigrationExecutionError);

    const records = journal.__test__records();
    expect(records).toHaveLength(0);
    expect(
      driver
        .executed()
        .some((row) => row.statement.includes('DROP TABLE IF EXISTS workspace_registry;')),
    ).toBe(true);
  });
});

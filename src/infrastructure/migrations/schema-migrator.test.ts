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
      '0004_expand_domain_documents_table:global',
      '0005_expand_workflow_runs_table:workspace-a',
      '0005_expand_workflow_runs_table:workspace-b',
      '0006_expand_workflow_runs_projection_columns:workspace-a',
      '0006_expand_workflow_runs_projection_columns:workspace-b',
      '0007_expand_workspace_summary_table:global',
      '0008_expand_tenant_storage_tiers_table:global',
      '0009_expand_data_layer_indexes:global',
      '0010_expand_data_layer_fk_constraints:global',
      '0011_expand_derived_artifacts_table:global',
      '0012_expand_projection_checkpoints_table:global',
      '0013_expand_machine_registrations_table:global',
      '0014_expand_agent_configs_table:global',
      '0015_expand_agent_action_proposals_table:global',
      '0016_expand_agent_action_proposals_idempotency_unique:global',
      '0017_expand_tenant_schema_migration_journal:workspace-a',
      '0017_expand_tenant_schema_migration_journal:workspace-b',
      '0018_expand_tenant_storage_tiers_upgraded_at:global',
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

  it('includes migration version and phase in error message on failure', async () => {
    const journal = new InMemoryMigrationJournalStore();
    const migrator = new SchemaMigrator({ journal });
    const driver = new FailOnStatementDriver('status_transitioned_at');

    try {
      await migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, {
        phase: 'Expand',
        tenants: ['workspace-a'],
        rollbackOnError: true,
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationExecutionError);
      const migrationError = error as MigrationExecutionError;
      expect(migrationError.message).toContain('v2');
      expect(migrationError.message).toContain('0002_expand_run_projection_columns');
      expect(migrationError.message).toContain('rolled back');
      expect(migrationError.migrationVersion).toBe(2);
      expect(migrationError.migrationId).toBe('0002_expand_run_projection_columns');
      expect(migrationError.migrationPhase).toBe('Expand');
      expect(migrationError.migrationTarget).toBe('workspace-a');
    }
  });

  it('includes migration context in error for non-rollback failures', async () => {
    const journal = new InMemoryMigrationJournalStore();
    const migrator = new SchemaMigrator({ journal });
    const driver = new FailOnStatementDriver('schema_migrations');

    try {
      await migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, {
        phase: 'Expand',
        tenants: ['workspace-a'],
      });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationExecutionError);
      const migrationError = error as MigrationExecutionError;
      expect(migrationError.message).toContain('v1');
      expect(migrationError.message).toContain('0001_expand_runtime_schema_baseline');
      expect(migrationError.migrationVersion).toBe(1);
    }
  });

  it('returns status entries for all migrations with applied/pending state', async () => {
    const journal = new InMemoryMigrationJournalStore();
    const migrator = new SchemaMigrator({ journal });
    const driver = new InMemoryMigrationSqlDriver();

    // Apply only expand migrations first
    await migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, {
      phase: 'Expand',
      tenants: ['workspace-a'],
    });

    const entries = await migrator.status(DEFAULT_SCHEMA_MIGRATIONS, ['workspace-a']);

    // All expand migrations should be applied
    const expandEntries = entries.filter((e) => e.phase === 'Expand');
    expect(expandEntries.every((e) => e.status === 'applied')).toBe(true);

    // Contract migration should be pending
    const contractEntries = entries.filter((e) => e.phase === 'Contract');
    expect(contractEntries.every((e) => e.status === 'pending')).toBe(true);
    expect(contractEntries[0]?.appliedAt).toBeNull();

    // Each entry should have proper metadata
    const firstEntry = entries[0];
    expect(firstEntry).toBeDefined();
    expect(firstEntry?.version).toBe(1);
    expect(firstEntry?.migrationId).toBe('0001_expand_runtime_schema_baseline');
    expect(firstEntry?.phase).toBe('Expand');
    expect(firstEntry?.scope).toBe('Global');
    expect(firstEntry?.target).toBe('global');
    expect(firstEntry?.status).toBe('applied');
    expect(firstEntry?.appliedAt).toBeTruthy();
  });

  it('returns all pending when no migrations have been applied', async () => {
    const journal = new InMemoryMigrationJournalStore();
    const migrator = new SchemaMigrator({ journal });

    const entries = await migrator.status(DEFAULT_SCHEMA_MIGRATIONS, ['workspace-a']);
    expect(entries.every((e) => e.status === 'pending')).toBe(true);
    expect(entries.every((e) => e.appliedAt === null)).toBe(true);
  });

  it('shows per-tenant status for tenant-scoped migrations', async () => {
    const journal = new InMemoryMigrationJournalStore();
    const migrator = new SchemaMigrator({ journal });
    const driver = new InMemoryMigrationSqlDriver();

    // Apply for workspace-a only
    await migrator.run(DEFAULT_SCHEMA_MIGRATIONS, driver, {
      phase: 'Expand',
      tenants: ['workspace-a'],
    });

    // Check status across both tenants
    const entries = await migrator.status(DEFAULT_SCHEMA_MIGRATIONS, [
      'workspace-a',
      'workspace-b',
    ]);

    // Tenant-scoped migration v2 on workspace-a should be applied
    const v2a = entries.find((e) => e.version === 2 && e.target === 'workspace-a');
    expect(v2a?.status).toBe('applied');

    // Tenant-scoped migration v2 on workspace-b should be pending
    const v2b = entries.find((e) => e.version === 2 && e.target === 'workspace-b');
    expect(v2b?.status).toBe('pending');
  });
});

export type MigrationPhase = 'Expand' | 'Contract';
export type MigrationCompatibility = 'BackwardCompatible' | 'ContractBreaking';
export type MigrationScope = 'Global' | 'Tenant';

export interface SchemaMigration {
  version: number;
  id: string;
  description: string;
  phase: MigrationPhase;
  scope: MigrationScope;
  compatibility: MigrationCompatibility;
  upSql: readonly string[];
  downSql: readonly string[];
}

export const GLOBAL_MIGRATION_TARGET = 'global';
export type MigrationTarget = string;

export interface AppliedMigrationRecord {
  version: number;
  migrationId: string;
  phase: MigrationPhase;
  target: MigrationTarget;
  appliedAtIso: string;
}

export interface MigrationJournalStore {
  listApplied(target: MigrationTarget): Promise<readonly AppliedMigrationRecord[]>;
  append(record: AppliedMigrationRecord): Promise<void>;
  remove(target: MigrationTarget, version: number): Promise<void>;
}

export interface MigrationSqlDriver {
  execute(params: Readonly<{ target: MigrationTarget; statement: string }>): Promise<void>;
}

export interface MigrationRunOptions {
  phase: MigrationPhase;
  tenants?: readonly string[];
  allowContractBreaking?: boolean;
  rollbackOnError?: boolean;
}

export interface PlannedMigrationStep {
  migration: SchemaMigration;
  target: MigrationTarget;
}

export interface MigrationRunResult {
  applied: readonly PlannedMigrationStep[];
  rolledBack: readonly PlannedMigrationStep[];
}

export class MigrationRegistryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MigrationRegistryError';
  }
}

export class MigrationExecutionError extends Error {
  readonly causeError: unknown;

  public constructor(message: string, causeError: unknown) {
    super(message);
    this.name = 'MigrationExecutionError';
    this.causeError = causeError;
  }
}

export class InMemoryMigrationJournalStore implements MigrationJournalStore {
  readonly #records: AppliedMigrationRecord[] = [];

  public listApplied(target: MigrationTarget): Promise<readonly AppliedMigrationRecord[]> {
    return Promise.resolve(this.#records.filter((record) => record.target === target));
  }

  public append(record: AppliedMigrationRecord): Promise<void> {
    const existing = this.#records.find(
      (candidate) => candidate.target === record.target && candidate.version === record.version,
    );
    if (existing !== undefined) {
      return Promise.resolve();
    }
    this.#records.push(record);
    return Promise.resolve();
  }

  public remove(target: MigrationTarget, version: number): Promise<void> {
    const index = this.#records.findIndex(
      (candidate) => candidate.target === target && candidate.version === version,
    );
    if (index >= 0) {
      this.#records.splice(index, 1);
    }
    return Promise.resolve();
  }

  public __test__records(): readonly AppliedMigrationRecord[] {
    return [...this.#records];
  }
}

export class InMemoryMigrationSqlDriver implements MigrationSqlDriver {
  readonly #executed: { target: MigrationTarget; statement: string }[] = [];

  public execute(params: Readonly<{ target: MigrationTarget; statement: string }>): Promise<void> {
    this.#executed.push({ target: params.target, statement: params.statement });
    return Promise.resolve();
  }

  public __test__executed(): readonly Readonly<{ target: MigrationTarget; statement: string }>[] {
    return [...this.#executed];
  }
}

export class SchemaMigrator {
  readonly #journal: MigrationJournalStore;
  readonly #clock: () => Date;

  public constructor(params: Readonly<{ journal: MigrationJournalStore; clock?: () => Date }>) {
    this.#journal = params.journal;
    this.#clock = params.clock ?? (() => new Date());
  }

  public validateRegistry(migrations: readonly SchemaMigration[]): void {
    if (migrations.length === 0) {
      throw new MigrationRegistryError('At least one schema migration is required.');
    }

    const sorted = [...migrations].sort(compareMigration);
    const ids = new Set<string>();
    assertUniqueIds(sorted, ids);
    assertIncreasingVersions(sorted);
    for (const migration of sorted) {
      assertMigrationDefinition(migration);
    }
  }

  public async plan(
    migrations: readonly SchemaMigration[],
    options: MigrationRunOptions,
  ): Promise<readonly PlannedMigrationStep[]> {
    this.validateRegistry(migrations);

    const tenants = normalizeTenants(options.tenants);
    const sorted = [...migrations].sort(compareMigration);
    const steps: PlannedMigrationStep[] = [];

    for (const migration of sorted) {
      if (migration.phase !== options.phase) {
        continue;
      }
      assertCompatibilityAllowed(migration, options.allowContractBreaking);
      const targets = resolveTargets(migration, tenants);
      const migrationSteps = await this.#planMigrationTargets(migration, targets);
      steps.push(...migrationSteps);
    }

    return steps;
  }

  public async run(
    migrations: readonly SchemaMigration[],
    driver: MigrationSqlDriver,
    options: MigrationRunOptions,
  ): Promise<MigrationRunResult> {
    const plan = await this.plan(migrations, options);
    const applied: PlannedMigrationStep[] = [];

    try {
      for (const step of plan) {
        for (const statement of step.migration.upSql) {
          await driver.execute({ target: step.target, statement });
        }

        await this.#journal.append({
          version: step.migration.version,
          migrationId: step.migration.id,
          phase: step.migration.phase,
          target: step.target,
          appliedAtIso: this.#clock().toISOString(),
        });
        applied.push(step);
      }

      return {
        applied,
        rolledBack: [],
      };
    } catch (error) {
      if (options.rollbackOnError !== true || applied.length === 0) {
        throw new MigrationExecutionError('Migration run failed.', error);
      }

      const rolledBack: PlannedMigrationStep[] = [];
      for (const step of [...applied].reverse()) {
        for (const statement of step.migration.downSql) {
          await driver.execute({ target: step.target, statement });
        }
        await this.#journal.remove(step.target, step.migration.version);
        rolledBack.push(step);
      }

      throw new MigrationExecutionError(
        `Migration run failed and rolled back ${rolledBack.length} migration(s).`,
        error,
      );
    }
  }

  async #planMigrationTargets(
    migration: SchemaMigration,
    targets: readonly MigrationTarget[],
  ): Promise<readonly PlannedMigrationStep[]> {
    const steps: PlannedMigrationStep[] = [];
    for (const target of targets) {
      const applied = await this.#journal.listApplied(target);
      if (applied.some((record) => record.version === migration.version)) {
        continue;
      }
      assertContractPrerequisites(migration, target, applied);
      steps.push({ migration, target });
    }
    return steps;
  }
}

function compareMigration(left: SchemaMigration, right: SchemaMigration): number {
  return left.version - right.version;
}

function resolveTargets(
  migration: SchemaMigration,
  tenants: readonly string[],
): readonly MigrationTarget[] {
  return migration.scope === 'Global' ? [GLOBAL_MIGRATION_TARGET] : tenants;
}

function assertCompatibilityAllowed(
  migration: SchemaMigration,
  allowContractBreaking: boolean | undefined,
): void {
  if (migration.compatibility === 'ContractBreaking' && allowContractBreaking !== true) {
    throw new MigrationRegistryError(
      `Contract-breaking migration blocked by default: ${migration.id}. Use allowContractBreaking=true.`,
    );
  }
}

function assertContractPrerequisites(
  migration: SchemaMigration,
  target: MigrationTarget,
  applied: readonly AppliedMigrationRecord[],
): void {
  if (migration.phase !== 'Contract') {
    return;
  }

  const hasLowerExpand = applied.some(
    (record) => record.phase === 'Expand' && record.version < migration.version,
  );
  if (!hasLowerExpand) {
    throw new MigrationRegistryError(
      `Contract migration ${migration.id} requires at least one prior Expand migration on target ${target}.`,
    );
  }
}

function assertUniqueIds(migrations: readonly SchemaMigration[], ids: Set<string>): void {
  for (const migration of migrations) {
    if (ids.has(migration.id)) {
      throw new MigrationRegistryError(`Duplicate migration id: ${migration.id}.`);
    }
    ids.add(migration.id);
  }
}

function assertIncreasingVersions(migrations: readonly SchemaMigration[]): void {
  let previousVersion = 0;
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new MigrationRegistryError(
        `Migration version must be a positive integer: ${migration.id}.`,
      );
    }
    if (migration.version <= previousVersion) {
      throw new MigrationRegistryError('Migration versions must be strictly increasing.');
    }
    previousVersion = migration.version;
  }
}

function assertMigrationDefinition(migration: SchemaMigration): void {
  if (migration.upSql.length === 0) {
    throw new MigrationRegistryError(
      `Migration ${migration.id} must define at least one upSql statement.`,
    );
  }
  if (migration.phase === 'Contract' && migration.downSql.length === 0) {
    throw new MigrationRegistryError(
      `Contract migration ${migration.id} must define rollback SQL.`,
    );
  }
  if (migration.phase === 'Contract' && migration.compatibility !== 'ContractBreaking') {
    throw new MigrationRegistryError(
      `Contract migration ${migration.id} must declare compatibility ContractBreaking.`,
    );
  }
}

function normalizeTenants(tenants: readonly string[] | undefined): readonly string[] {
  if (tenants === undefined || tenants.length === 0) {
    throw new MigrationRegistryError('Tenant-aware migration requires at least one tenant id.');
  }

  const cleaned = tenants.map((tenant) => tenant.trim()).filter((tenant) => tenant.length > 0);
  if (cleaned.length === 0) {
    throw new MigrationRegistryError('Tenant ids cannot be empty.');
  }

  return [...new Set(cleaned)].sort();
}

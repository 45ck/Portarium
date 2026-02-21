import type { SqlClient } from '../postgresql/sql-client.js';
import type {
  AppliedMigrationRecord,
  MigrationJournalStore,
  MigrationSqlDriver,
  MigrationTarget,
} from './schema-migrator.js';

/**
 * Postgres-backed migration journal that reads/writes to the schema_migrations table.
 * Requires migration v1 (0001_expand_runtime_schema_baseline) to have been applied first.
 */
export class PostgresMigrationJournalStore implements MigrationJournalStore {
  readonly #client: SqlClient;

  public constructor(client: SqlClient) {
    this.#client = client;
  }

  public async listApplied(target: MigrationTarget): Promise<readonly AppliedMigrationRecord[]> {
    const result = await this.#client.query<{
      version: number;
      migration_id: string;
      phase: string;
      applied_at: string;
    }>(
      'SELECT version, migration_id, phase, applied_at FROM schema_migrations WHERE target = $1 ORDER BY version ASC;',
      [target],
    );
    return result.rows.map((row) => ({
      version: row.version,
      migrationId: row.migration_id,
      phase: row.phase as AppliedMigrationRecord['phase'],
      target,
      appliedAtIso: row.applied_at,
    }));
  }

  public async append(record: AppliedMigrationRecord): Promise<void> {
    await this.#client.query(
      `INSERT INTO schema_migrations (target, version, migration_id, phase, applied_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (target, version) DO NOTHING;`,
      [record.target, record.version, record.migrationId, record.phase, record.appliedAtIso],
    );
  }

  public async remove(target: MigrationTarget, version: number): Promise<void> {
    await this.#client.query('DELETE FROM schema_migrations WHERE target = $1 AND version = $2;', [
      target,
      version,
    ]);
  }
}

/**
 * Postgres-backed SQL driver that executes migration statements against the real database.
 */
export class PostgresMigrationSqlDriver implements MigrationSqlDriver {
  readonly #client: SqlClient;

  public constructor(client: SqlClient) {
    this.#client = client;
  }

  public async execute(
    params: Readonly<{ target: MigrationTarget; statement: string }>,
  ): Promise<void> {
    await this.#client.query(params.statement);
  }
}

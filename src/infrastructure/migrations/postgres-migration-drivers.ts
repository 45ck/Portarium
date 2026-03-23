import type { SqlClient } from '../postgresql/sql-client.js';
import type {
  AppliedMigrationRecord,
  MigrationJournalStore,
  MigrationSqlDriver,
  MigrationTarget,
} from './schema-migrator.js';

/**
 * PostgreSQL advisory lock key for the migration runner.
 *
 * Advisory locks are scoped to the database. The key is a fixed int8 value
 * chosen to be unlikely to collide with application-level advisory locks.
 *
 * Chosen by hashing "portarium_schema_migrations" to a stable 32-bit int.
 */
const MIGRATION_ADVISORY_LOCK_KEY = 839_274_651;

/**
 * Acquires and releases a PostgreSQL session-level advisory lock to prevent
 * concurrent migration runs against the same database.
 *
 * Usage:
 * ```ts
 * const lock = new PostgresAdvisoryLock(sqlClient);
 * await lock.acquire();
 * try {
 *   // run migrations
 * } finally {
 *   await lock.release();
 * }
 * ```
 */
export class PostgresAdvisoryLock {
  readonly #client: SqlClient;
  readonly #lockKey: number;

  public constructor(client: SqlClient, lockKey: number = MIGRATION_ADVISORY_LOCK_KEY) {
    this.#client = client;
    this.#lockKey = lockKey;
  }

  /**
   * Acquires the advisory lock. Blocks until the lock is available.
   */
  public async acquire(): Promise<void> {
    await this.#client.query('SELECT pg_advisory_lock($1);', [this.#lockKey]);
  }

  /**
   * Attempts to acquire the advisory lock without blocking.
   * Returns true if the lock was acquired, false if it was already held.
   */
  public async tryAcquire(): Promise<boolean> {
    const result = await this.#client.query<{ pg_try_advisory_lock: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock;',
      [this.#lockKey],
    );
    return result.rows[0]?.pg_try_advisory_lock === true;
  }

  /**
   * Releases the advisory lock.
   */
  public async release(): Promise<void> {
    await this.#client.query('SELECT pg_advisory_unlock($1);', [this.#lockKey]);
  }
}

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

/**
 * Migration SQL driver for Tier B (schema-per-tenant).
 *
 * Before each migration statement it sets the PostgreSQL `search_path` to the
 * tenant's dedicated schema so that unqualified table references resolve there.
 * The schema must already exist (created by TenantStorageProvisioner.provision).
 */
export class SchemaScopedMigrationSqlDriver implements MigrationSqlDriver {
  readonly #client: SqlClient;
  readonly #schemaName: string;

  public constructor(client: SqlClient, schemaName: string) {
    this.#client = client;
    this.#schemaName = schemaName;
  }

  public get schemaName(): string {
    return this.#schemaName;
  }

  public async execute(
    params: Readonly<{ target: MigrationTarget; statement: string }>,
  ): Promise<void> {
    await this.#client.query(`SET search_path TO "${this.#schemaName}";`);
    await this.#client.query(params.statement);
  }
}

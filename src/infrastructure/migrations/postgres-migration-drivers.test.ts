import { describe, expect, it } from 'vitest';

import {
  PostgresAdvisoryLock,
  PostgresMigrationJournalStore,
  PostgresMigrationSqlDriver,
  SchemaScopedMigrationSqlDriver,
} from './postgres-migration-drivers.js';
import type { SqlClient, SqlQueryResult, SqlRow } from '../postgresql/sql-client.js';

/**
 * Minimal in-memory SqlClient that simulates schema_migrations table behaviour.
 */
class FakeSqlClient implements SqlClient {
  readonly #rows: Record<string, unknown>[] = [];
  readonly #executed: string[] = [];

  public async query<Row extends SqlRow = SqlRow>(
    statement: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    this.#executed.push(statement.trim());

    if (statement.includes('SELECT version, migration_id, phase, applied_at')) {
      const target = params[0] as string;
      const rows = this.#rows.filter((r) => r['target'] === target) as Row[];
      return { rows, rowCount: rows.length };
    }

    if (statement.includes('INSERT INTO schema_migrations')) {
      const [target, version, migrationId, phase, appliedAt] = params as [
        string,
        number,
        string,
        string,
        string,
      ];
      const exists = this.#rows.some((r) => r['target'] === target && r['version'] === version);
      if (!exists) {
        this.#rows.push({
          target,
          version,
          migration_id: migrationId,
          phase,
          applied_at: appliedAt,
        });
      }
      return { rows: [] as Row[], rowCount: 0 };
    }

    if (statement.includes('DELETE FROM schema_migrations')) {
      const [target, version] = params as [string, number];
      const idx = this.#rows.findIndex((r) => r['target'] === target && r['version'] === version);
      if (idx >= 0) this.#rows.splice(idx, 1);
      return { rows: [] as Row[], rowCount: 0 };
    }

    if (statement.includes('pg_advisory_lock(')) {
      return { rows: [] as Row[], rowCount: 0 };
    }

    if (statement.includes('pg_try_advisory_lock(')) {
      const lockKey = params[0] as number;
      const locked = this.#advisoryLocks.has(lockKey);
      return {
        rows: [{ pg_try_advisory_lock: !locked }] as unknown as Row[],
        rowCount: 1,
      };
    }

    if (statement.includes('pg_advisory_unlock(')) {
      const lockKey = params[0] as number;
      this.#advisoryLocks.delete(lockKey);
      return { rows: [] as Row[], rowCount: 0 };
    }

    return { rows: [] as Row[], rowCount: 0 };
  }

  public withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  public executed(): readonly string[] {
    return [...this.#executed];
  }

  /** Simulate an advisory lock being held. */
  public holdAdvisoryLock(key: number): void {
    this.#advisoryLocks.add(key);
  }

  readonly #advisoryLocks = new Set<number>();
}

describe('PostgresMigrationJournalStore', () => {
  it('starts empty and returns no records', async () => {
    const client = new FakeSqlClient();
    const journal = new PostgresMigrationJournalStore(client);
    const records = await journal.listApplied('global');
    expect(records).toHaveLength(0);
  });

  it('appends and retrieves records for a target', async () => {
    const client = new FakeSqlClient();
    const journal = new PostgresMigrationJournalStore(client);

    await journal.append({
      version: 1,
      migrationId: 'mig-001',
      phase: 'Expand',
      target: 'global',
      appliedAtIso: '2026-01-01T00:00:00Z',
    });

    const records = await journal.listApplied('global');
    expect(records).toHaveLength(1);
    expect(records[0]?.version).toBe(1);
    expect(records[0]?.migrationId).toBe('mig-001');
  });

  it('ignores duplicate appends (ON CONFLICT DO NOTHING)', async () => {
    const client = new FakeSqlClient();
    const journal = new PostgresMigrationJournalStore(client);

    await journal.append({
      version: 1,
      migrationId: 'mig-001',
      phase: 'Expand',
      target: 'global',
      appliedAtIso: '2026-01-01T00:00:00Z',
    });
    await journal.append({
      version: 1,
      migrationId: 'mig-001',
      phase: 'Expand',
      target: 'global',
      appliedAtIso: '2026-01-02T00:00:00Z',
    });

    const records = await journal.listApplied('global');
    expect(records).toHaveLength(1);
  });

  it('removes a record by target and version', async () => {
    const client = new FakeSqlClient();
    const journal = new PostgresMigrationJournalStore(client);

    await journal.append({
      version: 1,
      migrationId: 'mig-001',
      phase: 'Expand',
      target: 'global',
      appliedAtIso: '2026-01-01T00:00:00Z',
    });
    await journal.remove('global', 1);

    const records = await journal.listApplied('global');
    expect(records).toHaveLength(0);
  });

  it('isolates records by target', async () => {
    const client = new FakeSqlClient();
    const journal = new PostgresMigrationJournalStore(client);

    await journal.append({
      version: 1,
      migrationId: 'mig-001',
      phase: 'Expand',
      target: 'tenant-a',
      appliedAtIso: '2026-01-01T00:00:00Z',
    });
    await journal.append({
      version: 1,
      migrationId: 'mig-001',
      phase: 'Expand',
      target: 'tenant-b',
      appliedAtIso: '2026-01-01T00:00:00Z',
    });

    expect(await journal.listApplied('tenant-a')).toHaveLength(1);
    expect(await journal.listApplied('tenant-b')).toHaveLength(1);
    expect(await journal.listApplied('tenant-c')).toHaveLength(0);
  });
});

describe('PostgresMigrationSqlDriver', () => {
  it('executes statements against the sql client', async () => {
    const client = new FakeSqlClient();
    const driver = new PostgresMigrationSqlDriver(client);

    await driver.execute({
      target: 'global',
      statement: 'CREATE TABLE IF NOT EXISTS foo (id TEXT PRIMARY KEY);',
    });

    expect(client.executed()).toContain('CREATE TABLE IF NOT EXISTS foo (id TEXT PRIMARY KEY);');
  });

  it('passes through the statement without modification', async () => {
    const client = new FakeSqlClient();
    const driver = new PostgresMigrationSqlDriver(client);
    const stmt = 'ALTER TABLE workflow_runs ADD COLUMN status_v2 TEXT NULL;';

    await driver.execute({ target: 'workspace-default', statement: stmt });

    expect(client.executed()).toContain(stmt);
  });
});

describe('SchemaScopedMigrationSqlDriver', () => {
  it('sets search_path before each statement', async () => {
    const client = new FakeSqlClient();
    const driver = new SchemaScopedMigrationSqlDriver(client, 'tenant_acme');

    await driver.execute({
      target: 'tenant-acme',
      statement: 'CREATE TABLE IF NOT EXISTS widgets (id TEXT PRIMARY KEY);',
    });

    const executed = client.executed();
    expect(executed[0]).toBe('SET search_path TO "tenant_acme";');
    expect(executed[1]).toBe('CREATE TABLE IF NOT EXISTS widgets (id TEXT PRIMARY KEY);');
  });

  it('exposes the schema name via schemaName getter', () => {
    const client = new FakeSqlClient();
    const driver = new SchemaScopedMigrationSqlDriver(client, 'tenant_beta');
    expect(driver.schemaName).toBe('tenant_beta');
  });

  it('sets search_path on every execute call', async () => {
    const client = new FakeSqlClient();
    const driver = new SchemaScopedMigrationSqlDriver(client, 'tenant_gamma');
    const stmt1 = 'ALTER TABLE t ADD COLUMN c1 TEXT;';
    const stmt2 = 'ALTER TABLE t ADD COLUMN c2 TEXT;';

    await driver.execute({ target: 'tenant-gamma', statement: stmt1 });
    await driver.execute({ target: 'tenant-gamma', statement: stmt2 });

    const executed = client.executed();
    expect(executed).toEqual([
      'SET search_path TO "tenant_gamma";',
      stmt1,
      'SET search_path TO "tenant_gamma";',
      stmt2,
    ]);
  });
});

describe('PostgresAdvisoryLock', () => {
  it('acquires lock via pg_advisory_lock', async () => {
    const client = new FakeSqlClient();
    const lock = new PostgresAdvisoryLock(client);

    await lock.acquire();

    expect(client.executed().some((s) => s.includes('pg_advisory_lock'))).toBe(true);
  });

  it('tryAcquire returns true when lock is available', async () => {
    const client = new FakeSqlClient();
    const lock = new PostgresAdvisoryLock(client);

    const acquired = await lock.tryAcquire();
    expect(acquired).toBe(true);
  });

  it('tryAcquire returns false when lock is already held', async () => {
    const client = new FakeSqlClient();
    const lockKey = 839_274_651; // default key
    client.holdAdvisoryLock(lockKey);

    const lock = new PostgresAdvisoryLock(client, lockKey);
    const acquired = await lock.tryAcquire();
    expect(acquired).toBe(false);
  });

  it('releases lock via pg_advisory_unlock', async () => {
    const client = new FakeSqlClient();
    const lock = new PostgresAdvisoryLock(client);

    await lock.release();

    expect(client.executed().some((s) => s.includes('pg_advisory_unlock'))).toBe(true);
  });

  it('uses custom lock key when provided', async () => {
    const client = new FakeSqlClient();
    const customKey = 12345;
    const lock = new PostgresAdvisoryLock(client, customKey);

    const acquired = await lock.tryAcquire();
    expect(acquired).toBe(true);

    // Verify that holding the custom key blocks acquisition
    client.holdAdvisoryLock(customKey);
    const lock2 = new PostgresAdvisoryLock(client, customKey);
    const acquired2 = await lock2.tryAcquire();
    expect(acquired2).toBe(false);
  });
});

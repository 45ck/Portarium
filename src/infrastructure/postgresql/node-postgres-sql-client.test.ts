import { describe, expect, it, vi } from 'vitest';

import {
  NodePostgresSqlClient,
  nodePostgresSqlClientConfigFromEnv,
  type NodePostgresPool,
} from './node-postgres-sql-client.js';
import type { SqlClient } from './sql-client.js';

// ---------------------------------------------------------------------------
// Fake pool builder
// ---------------------------------------------------------------------------

interface FakeClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function makeFakePool(clientOverride?: Partial<FakeClient>): {
  pool: NodePostgresPool;
  client: FakeClient;
} {
  const client: FakeClient = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
    ...clientOverride,
  };
  const pool: NodePostgresPool = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: vi.fn().mockResolvedValue(client),
    end: vi.fn().mockResolvedValue(undefined),
  };
  return { pool, client };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('nodePostgresSqlClientConfigFromEnv', () => {
  it('returns defaults when no env vars are set', () => {
    const cfg = nodePostgresSqlClientConfigFromEnv({ PORTARIUM_DATABASE_URL: 'postgres://x' });
    expect(cfg.connectionString).toBe('postgres://x');
    expect(cfg.maxConnections).toBe(10);
    expect(cfg.idleTimeoutMs).toBe(10_000);
    expect(cfg.connectionTimeoutMs).toBe(5_000);
    expect(cfg.statementTimeoutMs).toBe(30_000);
  });

  it('reads all values from env vars', () => {
    const cfg = nodePostgresSqlClientConfigFromEnv({
      PORTARIUM_DATABASE_URL: 'postgres://y',
      PORTARIUM_DB_POOL_MAX: '20',
      PORTARIUM_DB_POOL_IDLE_TIMEOUT_MS: '15000',
      PORTARIUM_DB_CONNECTION_TIMEOUT_MS: '3000',
      PORTARIUM_DB_STATEMENT_TIMEOUT_MS: '60000',
    });
    expect(cfg.maxConnections).toBe(20);
    expect(cfg.idleTimeoutMs).toBe(15_000);
    expect(cfg.connectionTimeoutMs).toBe(3_000);
    expect(cfg.statementTimeoutMs).toBe(60_000);
  });

  it('falls back to defaults for non-numeric env values', () => {
    const cfg = nodePostgresSqlClientConfigFromEnv({
      PORTARIUM_DATABASE_URL: 'postgres://z',
      PORTARIUM_DB_POOL_MAX: 'notanumber',
    });
    expect(cfg.maxConnections).toBe(10);
  });
});

describe('NodePostgresSqlClient.withTransaction', () => {
  it('issues BEGIN before fn and COMMIT after fn on success', async () => {
    const { pool, client } = makeFakePool();
    const sqlClient = new NodePostgresSqlClient({ connectionString: '', pool });

    const txCalls: string[] = [];
    await sqlClient.withTransaction(async (tx: SqlClient) => {
      await tx.query('SELECT 1');
      txCalls.push('body');
    });

    const sqlCalls = (client.query.mock.calls as [string][]).map((c) => c[0]);
    expect(sqlCalls[0]).toBe('BEGIN');
    expect(txCalls).toEqual(['body']);
    expect(sqlCalls[sqlCalls.length - 1]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('issues ROLLBACK on error and re-throws', async () => {
    const { pool, client } = makeFakePool();
    const sqlClient = new NodePostgresSqlClient({ connectionString: '', pool });

    await expect(
      sqlClient.withTransaction(async () => {
        throw new Error('db error');
      }),
    ).rejects.toThrow('db error');

    const sqlCalls = (client.query.mock.calls as [string][]).map((c) => c[0]);
    expect(sqlCalls).toContain('ROLLBACK');
    expect(sqlCalls).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('releases the pool client even when ROLLBACK itself throws', async () => {
    const clientQuery = vi.fn().mockImplementation((sql: string) => {
      if (sql === 'ROLLBACK') return Promise.reject(new Error('rollback failed'));
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    const clientRelease = vi.fn();
    const { pool } = makeFakePool({ query: clientQuery, release: clientRelease });
    const sqlClient = new NodePostgresSqlClient({ connectionString: '', pool });

    await expect(
      sqlClient.withTransaction(async () => {
        throw new Error('original');
      }),
    ).rejects.toThrow();

    expect(clientRelease).toHaveBeenCalledOnce();
  });

  it('returns the value produced by fn on success', async () => {
    const { pool } = makeFakePool();
    const sqlClient = new NodePostgresSqlClient({ connectionString: '', pool });

    const result = await sqlClient.withTransaction(async () => 42);
    expect(result).toBe(42);
  });

  it('nested withTransaction reuses the same connection (no new BEGIN/COMMIT)', async () => {
    const { pool, client } = makeFakePool();
    const sqlClient = new NodePostgresSqlClient({ connectionString: '', pool });

    await sqlClient.withTransaction(async (tx) => {
      await tx.withTransaction(async (inner) => {
        await inner.query('SELECT 2');
      });
    });

    const sqlCalls = (client.query.mock.calls as [string][]).map((c) => c[0]);
    expect(sqlCalls.filter((s) => s === 'BEGIN')).toHaveLength(1);
    expect(sqlCalls.filter((s) => s === 'COMMIT')).toHaveLength(1);
    expect(pool.connect).toHaveBeenCalledOnce();
  });

  it('query inside tx uses the pool client, not the pool directly', async () => {
    const { pool, client } = makeFakePool();
    const sqlClient = new NodePostgresSqlClient({ connectionString: '', pool });

    await sqlClient.withTransaction(async (tx) => {
      await tx.query('SELECT 3', [1]);
    });

    // pool.query should NOT have been called for SELECT 3 (only BEGIN/COMMIT use client)
    expect(pool.query).not.toHaveBeenCalled();
    const clientCalls = (client.query.mock.calls as [string][]).map((c) => c[0]);
    expect(clientCalls).toContain('SELECT 3');
  });
});

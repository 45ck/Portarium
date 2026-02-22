import type { PoolClient } from 'pg';
import { Pool } from 'pg';

import type { SqlClient, SqlQueryResult, SqlRow } from './sql-client.js';
import { withSpan } from '../observability/otel-setup.js';

export type NodePostgresPool = Pick<Pool, 'query' | 'connect' | 'end'>;

/**
 * Configuration for the Postgres connection pool.
 *
 * Pool sizing and timeout values can be tuned per-environment.
 * All values are optional; defaults are chosen to be safe for production
 * (non-zero connection timeout, explicit statement timeout).
 *
 * Corresponding env vars:
 *   PORTARIUM_DB_POOL_MAX                 (default: 10)
 *   PORTARIUM_DB_POOL_IDLE_TIMEOUT_MS     (default: 10000)
 *   PORTARIUM_DB_CONNECTION_TIMEOUT_MS    (default: 5000)
 *   PORTARIUM_DB_STATEMENT_TIMEOUT_MS     (default: 30000)
 */
export type NodePostgresSqlClientConfig = Readonly<{
  connectionString: string;
  /** Maximum number of pool connections. Default: 10. */
  maxConnections?: number;
  /** Milliseconds a connection can sit idle before being closed. Default: 10000. */
  idleTimeoutMs?: number;
  /** Milliseconds to wait when acquiring a connection before throwing. Default: 5000. */
  connectionTimeoutMs?: number;
  /** Milliseconds before a statement is cancelled by the server. Default: 30000. */
  statementTimeoutMs?: number;
  /** Injectable pool (for testing). When provided, other config fields are ignored. */
  pool?: NodePostgresPool;
}>;

/**
 * Builds a `NodePostgresSqlClientConfig` from environment variables.
 *
 * All numeric values parse via `parseInt`; invalid values fall back to the
 * documented defaults so the application never starts with a zero or NaN
 * connection timeout.
 */
export function nodePostgresSqlClientConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): NodePostgresSqlClientConfig {
  const parseIntOrDefault = (key: string, fallback: number): number => {
    const raw = env[key]?.trim();
    if (!raw) return fallback;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    connectionString: env['PORTARIUM_DATABASE_URL'] ?? '',
    maxConnections: parseIntOrDefault('PORTARIUM_DB_POOL_MAX', 10),
    idleTimeoutMs: parseIntOrDefault('PORTARIUM_DB_POOL_IDLE_TIMEOUT_MS', 10_000),
    connectionTimeoutMs: parseIntOrDefault('PORTARIUM_DB_CONNECTION_TIMEOUT_MS', 5_000),
    statementTimeoutMs: parseIntOrDefault('PORTARIUM_DB_STATEMENT_TIMEOUT_MS', 30_000),
  };
}

export class NodePostgresSqlClient implements SqlClient {
  readonly #pool: NodePostgresPool;

  public constructor(params: NodePostgresSqlClientConfig) {
    if (params.pool) {
      this.#pool = params.pool;
    } else {
      this.#pool = new Pool({
        connectionString: params.connectionString,
        max: params.maxConnections ?? 10,
        idleTimeoutMillis: params.idleTimeoutMs ?? 10_000,
        connectionTimeoutMillis: params.connectionTimeoutMs ?? 5_000,
        statement_timeout: params.statementTimeoutMs ?? 30_000,
      });
    }
  }

  public async query<Row extends SqlRow = SqlRow>(
    statement: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    return withSpan('db.query', async () => {
      const result = await this.#pool.query(statement, [...params]);
      return {
        rows: result.rows as readonly Row[],
        rowCount: result.rowCount ?? result.rows.length,
      };
    });
  }

  public async withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    return withSpan('db.transaction', async () => {
      const client = await this.#pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(new PoolClientSqlClient(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
  }

  public async close(): Promise<void> {
    await this.#pool.end();
  }
}

class PoolClientSqlClient implements SqlClient {
  readonly #client: PoolClient;

  public constructor(client: PoolClient) {
    this.#client = client;
  }

  public async query<Row extends SqlRow = SqlRow>(
    statement: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    const result = await this.#client.query(statement, [...params]);
    return {
      rows: result.rows as readonly Row[],
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  public async withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    // Already inside a transaction — run the function directly on the same client.
    return fn(this);
  }
}

import type { PoolClient } from 'pg';
import { Pool } from 'pg';

import type { SqlClient, SqlQueryResult, SqlRow } from './sql-client.js';

export type NodePostgresPool = Pick<Pool, 'query' | 'connect' | 'end'>;

export class NodePostgresSqlClient implements SqlClient {
  readonly #pool: NodePostgresPool;

  public constructor(params: Readonly<{ connectionString: string; pool?: NodePostgresPool }>) {
    this.#pool = params.pool ?? new Pool({ connectionString: params.connectionString });
  }

  public async query<Row extends SqlRow = SqlRow>(
    statement: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<Row>> {
    const result = await this.#pool.query(statement, [...params]);
    return {
      rows: result.rows as readonly Row[],
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  public async withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
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

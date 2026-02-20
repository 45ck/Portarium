import { Pool } from 'pg';

import type { SqlClient, SqlQueryResult, SqlRow } from './sql-client.js';

export class NodePostgresSqlClient implements SqlClient {
  readonly #pool: Pool;

  public constructor(params: Readonly<{ connectionString: string }>) {
    this.#pool = new Pool({ connectionString: params.connectionString });
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

  public async close(): Promise<void> {
    await this.#pool.end();
  }
}

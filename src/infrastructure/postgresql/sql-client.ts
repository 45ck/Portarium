export type SqlRow = Record<string, unknown>;

export interface SqlQueryResult<Row extends SqlRow = SqlRow> {
  rows: readonly Row[];
  rowCount: number;
}

export interface SqlClient {
  query<Row extends SqlRow = SqlRow>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<Row>>;

  /**
   * Executes `fn` within a database transaction.
   *
   * Commits on success; rolls back and re-throws on any error.
   * The `tx` client passed to `fn` must be used for all queries that should
   * participate in the transaction.
   */
  withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}

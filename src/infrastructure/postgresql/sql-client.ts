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
}

import type { CursorPaginationRequest } from './types.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface CursorPaginationQuery {
  query: URLSearchParams;
}

export function buildCursorQuery(params: CursorPaginationRequest = {}): CursorPaginationQuery {
  const query = new URLSearchParams();

  const limit = clampLimit(params.limit);
  query.set('limit', `${limit}`);

  if (params.cursor) {
    query.set('cursor', params.cursor);
  }

  return { query };
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit)) return DEFAULT_LIMIT;
  if (limit <= 0) return 1;
  if (limit > MAX_LIMIT) return MAX_LIMIT;
  return limit;
}

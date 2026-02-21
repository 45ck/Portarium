/**
 * Shared query vocabulary for list operations.
 *
 * All list queries share these types for pagination, sorting, and search.
 * Entity-specific filters are defined per-port and composed with these.
 */

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';

export type SortClause = Readonly<{
  field: string;
  direction: SortDirection;
}>;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export type PaginationParams = Readonly<{
  limit?: number;
  cursor?: string;
}>;

// ---------------------------------------------------------------------------
// Composite query params (convenience for ports)
// ---------------------------------------------------------------------------

export type QueryParams = Readonly<{
  pagination: PaginationParams;
  sort?: SortClause;
  search?: string;
}>;

// ---------------------------------------------------------------------------
// Page response
// ---------------------------------------------------------------------------

export type Page<T> = Readonly<{
  items: readonly T[];
  nextCursor?: string;
}>;

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0) return DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) return MAX_LIMIT;
  return limit;
}

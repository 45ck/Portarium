export function pageByCursor<T>(
  items: readonly T[],
  idOf: (item: T) => string,
  limit?: number,
  cursor?: string,
): Readonly<{ items: readonly T[]; nextCursor?: string }> {
  const cursorId = cursor?.trim();
  const filtered = cursorId ? items.filter((item) => idOf(item) > cursorId) : [...items];

  if (limit === undefined || filtered.length <= limit) {
    return { items: filtered };
  }

  const paged = filtered.slice(0, limit);
  const nextCursor = idOf(paged[paged.length - 1]!);
  return { items: paged, nextCursor };
}

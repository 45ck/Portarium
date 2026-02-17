import { describe, expect, it } from 'vitest';

import { buildCursorQuery } from './pagination.js';

describe('cursor pagination query builder', () => {
  it('uses a safe default limit when unspecified', () => {
    const { query } = buildCursorQuery({});
    expect(query.get('limit')).toBe('50');
    expect(query.get('cursor')).toBeNull();
  });

  it('clamps oversized limits', () => {
    const { query } = buildCursorQuery({ limit: 999 });
    expect(query.get('limit')).toBe('200');
  });

  it('normalizes invalid limits to default', () => {
    const { query } = buildCursorQuery({ limit: 0.5 as number });
    expect(query.get('limit')).toBe('50');
  });

  it('includes cursor when provided', () => {
    const { query } = buildCursorQuery({ cursor: 'next:abc123' });
    expect(query.get('cursor')).toBe('next:abc123');
  });
});

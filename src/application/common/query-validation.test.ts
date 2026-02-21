import { describe, expect, it } from 'vitest';
import { paginationRules, sortRule } from './query-validation.js';
import { validate } from './validation.js';

describe('paginationRules', () => {
  it('passes when limit and cursor are absent', () => {
    const result = validate({}, paginationRules());
    expect(result.ok).toBe(true);
  });

  it('passes for valid limit and cursor', () => {
    const result = validate({ limit: 10, cursor: 'abc' }, paginationRules());
    expect(result.ok).toBe(true);
  });

  it('rejects non-integer limit', () => {
    const result = validate({ limit: 3.5 }, paginationRules());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errors?.[0]?.field).toBe('limit');
  });

  it('rejects zero limit', () => {
    const result = validate({ limit: 0 }, paginationRules());
    expect(result.ok).toBe(false);
  });

  it('rejects negative limit', () => {
    const result = validate({ limit: -5 }, paginationRules());
    expect(result.ok).toBe(false);
  });

  it('rejects limit exceeding MAX_LIMIT', () => {
    const result = validate({ limit: 999 }, paginationRules());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errors?.[0]?.message).toContain('200');
  });

  it('rejects empty cursor string', () => {
    const result = validate({ cursor: '' }, paginationRules());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errors?.[0]?.field).toBe('cursor');
  });

  it('rejects whitespace-only cursor', () => {
    const result = validate({ cursor: '   ' }, paginationRules());
    expect(result.ok).toBe(false);
  });

  it('collects both limit and cursor violations', () => {
    const result = validate({ limit: -1, cursor: '' }, paginationRules());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errors).toHaveLength(2);
  });
});

describe('sortRule', () => {
  const allowed = ['name', 'createdAt', 'status'] as const;

  it('passes when no sort fields are present', () => {
    const result = validate({}, [sortRule(allowed)]);
    expect(result.ok).toBe(true);
  });

  it('passes for valid sortField and sortDirection', () => {
    const result = validate({ sortField: 'name', sortDirection: 'asc' }, [sortRule(allowed)]);
    expect(result.ok).toBe(true);
  });

  it('passes for sortDirection desc', () => {
    const result = validate({ sortField: 'createdAt', sortDirection: 'desc' }, [sortRule(allowed)]);
    expect(result.ok).toBe(true);
  });

  it('rejects unknown sortField', () => {
    const result = validate({ sortField: 'unknown' }, [sortRule(allowed)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errors?.[0]?.field).toBe('sortField');
    expect(result.error.errors?.[0]?.message).toContain('name');
  });

  it('rejects invalid sortDirection', () => {
    const result = validate({ sortDirection: 'up' }, [sortRule(allowed)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errors?.[0]?.field).toBe('sortDirection');
  });

  it('collects both violations', () => {
    const result = validate({ sortField: 'bad', sortDirection: 'up' }, [sortRule(allowed)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errors).toHaveLength(2);
  });
});

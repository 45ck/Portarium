/**
 * Unit tests for buildListQuery (bead-ijlt).
 *
 * buildListQuery constructs parameterized SQL for domain_documents JSONB
 * queries with equality filters, ILIKE search, sorting, and cursor pagination.
 * All tests verify the generated SQL string and params array.
 */
import { describe, expect, it } from 'vitest';

import { buildListQuery } from './query-builder.js';

const BASE = {
  tenantId: 'tenant-1',
  collection: 'work-items',
  filters: [],
  cursorField: 'document_id',
  limit: 10,
} as const;

describe('buildListQuery', () => {
  describe('minimal query (tenant + collection only)', () => {
    it('generates correct SQL with two fixed conditions', () => {
      const { sql, params } = buildListQuery(BASE);
      expect(sql).toContain('tenant_id = $1');
      expect(sql).toContain('collection = $2');
      expect(params[0]).toBe('tenant-1');
      expect(params[1]).toBe('work-items');
    });

    it('adds LIMIT of limit + 1 to detect next page', () => {
      const { sql, params } = buildListQuery({ ...BASE, limit: 10 });
      expect(sql).toContain('LIMIT $');
      expect(params[params.length - 1]).toBe(11);
    });

    it('uses default ORDER BY document_id ASC when no sort given', () => {
      const { sql } = buildListQuery(BASE);
      expect(sql).toContain('ORDER BY document_id ASC');
    });
  });

  describe('workspaceId filter', () => {
    it('adds workspace_id condition when workspaceId is set', () => {
      const { sql, params } = buildListQuery({ ...BASE, workspaceId: 'ws-1' });
      expect(sql).toContain('workspace_id = $3');
      expect(params[2]).toBe('ws-1');
    });
  });

  describe('equality filters', () => {
    it('adds JSONB equality condition for each filter', () => {
      const { sql, params } = buildListQuery({
        ...BASE,
        filters: [{ jsonField: 'status', value: 'Pending' }],
      });
      expect(sql).toContain("payload->>'status' = $3");
      expect(params[2]).toBe('Pending');
    });

    it('stacks multiple equality filters correctly', () => {
      const { sql, params } = buildListQuery({
        ...BASE,
        filters: [
          { jsonField: 'status', value: 'Pending' },
          { jsonField: 'priority', value: 'high' },
        ],
      });
      expect(sql).toContain("payload->>'status' = $3");
      expect(sql).toContain("payload->>'priority' = $4");
      expect(params[2]).toBe('Pending');
      expect(params[3]).toBe('high');
    });

    it('rejects invalid JSON field names to prevent SQL injection', () => {
      expect(() =>
        buildListQuery({
          ...BASE,
          filters: [{ jsonField: "status'; DROP TABLE", value: 'x' }],
        }),
      ).toThrow('Invalid JSON field name');
    });
  });

  describe('search filter', () => {
    it('adds ILIKE condition for single search field', () => {
      const { sql, params } = buildListQuery({
        ...BASE,
        search: { fields: ['title'], term: 'deploy' },
      });
      expect(sql).toContain("payload->>'title' ILIKE $3");
      expect(params[2]).toBe('%deploy%');
    });

    it('joins multiple search fields with OR', () => {
      const { sql } = buildListQuery({
        ...BASE,
        search: { fields: ['title', 'description'], term: 'prod' },
      });
      expect(sql).toContain("payload->>'title' ILIKE");
      expect(sql).toContain("payload->>'description' ILIKE");
      expect(sql).toContain(' OR ');
    });

    it('escapes ILIKE special characters', () => {
      const { params } = buildListQuery({
        ...BASE,
        search: { fields: ['title'], term: '50% off' },
      });
      expect(params[params.length - 1]).toBe(11); // still ends with limit+1
      // Find the ILIKE param (before the limit param)
      const iLikeParam = params.find((p) => typeof p === 'string' && String(p).includes('\\%'));
      expect(iLikeParam).toBe('%50\\% off%');
    });

    it('skips search block when term is blank', () => {
      const { sql } = buildListQuery({
        ...BASE,
        search: { fields: ['title'], term: '   ' },
      });
      expect(sql).not.toContain('ILIKE');
    });
  });

  describe('cursor pagination', () => {
    it('adds cursor condition with > operator for ASC sort', () => {
      const { sql, params } = buildListQuery({ ...BASE, cursor: 'work-item-5' });
      expect(sql).toContain('document_id > $3');
      expect(params[2]).toBe('work-item-5');
    });

    it('adds cursor condition with < operator for DESC sort', () => {
      const { sql } = buildListQuery({
        ...BASE,
        cursor: 'work-item-5',
        sort: { jsonField: 'createdAt', direction: 'DESC' },
      });
      expect(sql).toContain('document_id < $');
    });
  });

  describe('sort config', () => {
    it('uses custom ORDER BY when sort is provided', () => {
      const { sql } = buildListQuery({
        ...BASE,
        sort: { jsonField: 'createdAt', direction: 'ASC' },
      });
      expect(sql).toContain("ORDER BY payload->>'createdAt' ASC, document_id ASC");
    });

    it('supports DESC sorting', () => {
      const { sql } = buildListQuery({
        ...BASE,
        sort: { jsonField: 'updatedAt', direction: 'DESC' },
      });
      expect(sql).toContain("ORDER BY payload->>'updatedAt' DESC, document_id DESC");
    });

    it('rejects invalid sort field names', () => {
      expect(() =>
        buildListQuery({
          ...BASE,
          sort: { jsonField: 'field; --', direction: 'ASC' },
        }),
      ).toThrow('Invalid JSON field name');
    });
  });

  describe('combined params ordering', () => {
    it('orders params: tenantId, collection, workspaceId, filter, search, cursor, limit', () => {
      const { params } = buildListQuery({
        tenantId: 'tenant-x',
        workspaceId: 'ws-x',
        collection: 'events',
        filters: [{ jsonField: 'status', value: 'active' }],
        search: { fields: ['name'], term: 'foo' },
        sort: { jsonField: 'name', direction: 'ASC' },
        cursor: 'ev-10',
        cursorField: 'document_id',
        limit: 5,
      });
      expect(params[0]).toBe('tenant-x');
      expect(params[1]).toBe('events');
      expect(params[2]).toBe('ws-x');
      expect(params[3]).toBe('active');
      expect(params[4]).toBe('%foo%');
      expect(params[5]).toBe('ev-10');
      expect(params[6]).toBe(6); // limit + 1
    });
  });
});

/**
 * Unit tests for pageByCursor (bead-ijlt).
 *
 * pageByCursor is a pure function used by PostgresWorkItemStore and other
 * adapters to slice an in-memory array into stable cursor-paginated pages.
 */
import { describe, expect, it } from 'vitest';

import { pageByCursor } from './postgres-cursor-page.js';

const idOf = (item: { id: string }) => item.id;

const ITEMS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }] as const;

describe('pageByCursor', () => {
  describe('no cursor, no limit', () => {
    it('returns all items with no nextCursor', () => {
      const result = pageByCursor(ITEMS, idOf);
      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('limit without cursor', () => {
    it('returns first page with nextCursor set to last item id', () => {
      const result = pageByCursor(ITEMS, idOf, 2);
      expect(result.items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(result.nextCursor).toBe('b');
    });

    it('returns all items when limit equals length', () => {
      const result = pageByCursor(ITEMS, idOf, 5);
      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBeUndefined();
    });

    it('returns all items when limit exceeds length', () => {
      const result = pageByCursor(ITEMS, idOf, 100);
      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBeUndefined();
    });

    it('returns single item page', () => {
      const result = pageByCursor(ITEMS, idOf, 1);
      expect(result.items.map((i) => i.id)).toEqual(['a']);
      expect(result.nextCursor).toBe('a');
    });
  });

  describe('cursor without limit', () => {
    it('returns items after cursor with no nextCursor', () => {
      const result = pageByCursor(ITEMS, idOf, undefined, 'b');
      expect(result.items.map((i) => i.id)).toEqual(['c', 'd', 'e']);
      expect(result.nextCursor).toBeUndefined();
    });

    it('returns empty when cursor is past all items', () => {
      const result = pageByCursor(ITEMS, idOf, undefined, 'z');
      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('cursor with limit', () => {
    it('returns next page after cursor', () => {
      const result = pageByCursor(ITEMS, idOf, 2, 'b');
      expect(result.items.map((i) => i.id)).toEqual(['c', 'd']);
      expect(result.nextCursor).toBe('d');
    });

    it('returns last page with no nextCursor when items fit exactly', () => {
      const result = pageByCursor(ITEMS, idOf, 3, 'b');
      expect(result.items.map((i) => i.id)).toEqual(['c', 'd', 'e']);
      expect(result.nextCursor).toBeUndefined();
    });

    it('returns empty page when cursor is at end and limit > 0', () => {
      const result = pageByCursor(ITEMS, idOf, 2, 'e');
      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('cursor trimming', () => {
    it('trims whitespace from cursor value', () => {
      const result = pageByCursor(ITEMS, idOf, 2, '  b  ');
      expect(result.items.map((i) => i.id)).toEqual(['c', 'd']);
    });

    it('treats blank cursor as no cursor', () => {
      const result = pageByCursor(ITEMS, idOf, 2, '   ');
      expect(result.items.map((i) => i.id)).toEqual(['a', 'b']);
    });
  });

  describe('empty input', () => {
    it('returns empty result with no cursor', () => {
      const result = pageByCursor([], idOf, 10, 'x');
      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('stable pagination — sequential pages cover all items', () => {
    it('iterates three pages of size 2 over 5 items', () => {
      const all: string[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < 4; page++) {
        const result = pageByCursor(ITEMS, idOf, 2, cursor);
        all.push(...result.items.map((i) => i.id));
        cursor = result.nextCursor;
        if (!cursor) break;
      }

      expect(all).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });
});

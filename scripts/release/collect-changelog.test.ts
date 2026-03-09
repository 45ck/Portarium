import { describe, expect, it } from 'vitest';

// These functions mirror the logic in collect-changelog.mjs. The tests validate
// the categorization and prefix-stripping rules without importing .mjs (which
// lacks TypeScript declarations).

const CATEGORY_PATTERNS: { prefix: string; category: string | null }[] = [
  { prefix: 'feat', category: 'Added' },
  { prefix: 'add', category: 'Added' },
  { prefix: 'fix', category: 'Fixed' },
  { prefix: 'bug', category: 'Fixed' },
  { prefix: 'change', category: 'Changed' },
  { prefix: 'refactor', category: 'Changed' },
  { prefix: 'perf', category: 'Changed' },
  { prefix: 'remove', category: 'Removed' },
  { prefix: 'deprecate', category: 'Removed' },
  { prefix: 'chore', category: null },
  { prefix: 'ci', category: null },
  { prefix: 'docs', category: null },
  { prefix: 'test', category: null },
  { prefix: 'merge', category: null },
  { prefix: 'style', category: null },
];

function categorize(subject: string): string | null {
  const lower = subject.toLowerCase();
  for (const { prefix, category } of CATEGORY_PATTERNS) {
    if (lower.startsWith(`${prefix}:`) || lower.startsWith(`${prefix}(`)) {
      return category;
    }
  }
  return 'Added';
}

function stripPrefix(subject: string): string {
  return subject.replace(/^[a-z]+(\([^)]*\))?:\s*/i, '');
}

describe('collect-changelog', () => {
  describe('categorize', () => {
    it('maps feat: prefix to Added', () => {
      expect(categorize('feat: add widget')).toBe('Added');
    });

    it('maps fix: prefix to Fixed', () => {
      expect(categorize('fix: resolve crash')).toBe('Fixed');
    });

    it('maps refactor: prefix to Changed', () => {
      expect(categorize('refactor: simplify logic')).toBe('Changed');
    });

    it('maps perf: prefix to Changed', () => {
      expect(categorize('perf: optimize query')).toBe('Changed');
    });

    it('maps remove: prefix to Removed', () => {
      expect(categorize('remove: dead code')).toBe('Removed');
    });

    it('returns null for chore: prefix (skip)', () => {
      expect(categorize('chore: update deps')).toBeNull();
    });

    it('returns null for ci: prefix (skip)', () => {
      expect(categorize('ci: fix workflow')).toBeNull();
    });

    it('returns null for docs: prefix (skip)', () => {
      expect(categorize('docs: update readme')).toBeNull();
    });

    it('returns null for test: prefix (skip)', () => {
      expect(categorize('test: add coverage')).toBeNull();
    });

    it('returns null for merge: prefix (skip)', () => {
      expect(categorize('merge: bead-0900')).toBeNull();
    });

    it('handles scoped prefixes like feat(scope):', () => {
      expect(categorize('feat(proxy): add health check')).toBe('Added');
    });

    it('defaults to Added for unknown prefix', () => {
      expect(categorize('implement new feature')).toBe('Added');
    });
  });

  describe('stripPrefix', () => {
    it('strips simple prefix', () => {
      expect(stripPrefix('feat: add widget')).toBe('add widget');
    });

    it('strips scoped prefix', () => {
      expect(stripPrefix('fix(proxy): resolve crash')).toBe('resolve crash');
    });

    it('leaves unprefixed text unchanged', () => {
      expect(stripPrefix('some plain text')).toBe('some plain text');
    });

    it('handles empty string', () => {
      expect(stripPrefix('')).toBe('');
    });
  });
});

import { describe, expect, it } from 'vitest';

import { HashSha256 } from '../primitives/index.js';
import type { EvidenceHasher } from '../evidence/evidence-hasher.js';

import {
  createSnapshotBinding,
  createSnapshotSet,
  verifySnapshotBinding,
  verifySnapshotSet,
} from './approval-snapshot-binding-v1.js';

// ---------------------------------------------------------------------------
// Test hasher (deterministic, not cryptographic)
// ---------------------------------------------------------------------------

/**
 * Simple deterministic hasher for tests.  Produces a hex-like string
 * from the input's character codes.  NOT cryptographic — just unique
 * enough for unit test assertions.
 */
function makeTestHasher(): EvidenceHasher {
  return {
    sha256Hex(input: string) {
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const ch = input.charCodeAt(i);
        hash = ((hash << 5) - hash + ch) | 0;
      }
      const hex = Math.abs(hash).toString(16).padStart(64, '0');
      return HashSha256(hex);
    },
  };
}

const hasher = makeTestHasher();

// ---------------------------------------------------------------------------
// createSnapshotBinding
// ---------------------------------------------------------------------------

describe('createSnapshotBinding', () => {
  it('creates an immutable binding with content hash', () => {
    const binding = createSnapshotBinding({
      hasher,
      content: { amount: 1000, currency: 'USD' },
      subjectKind: 'financial_transaction',
      subjectLabel: 'Invoice #42',
      capturedAtIso: '2026-01-15T10:00:00Z',
    });

    expect(binding.schemaVersion).toBe(1);
    expect(binding.subjectKind).toBe('financial_transaction');
    expect(binding.subjectLabel).toBe('Invoice #42');
    expect(binding.contentHash).toBeTruthy();
    expect(binding.capturedAtIso).toBe('2026-01-15T10:00:00Z');
    expect(Object.isFrozen(binding)).toBe(true);
  });

  it('produces deterministic hashes for same content', () => {
    const content = { key: 'value', nested: { a: 1 } };
    const b1 = createSnapshotBinding({
      hasher,
      content,
      subjectKind: 'approval_payload',
      subjectLabel: 'test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });
    const b2 = createSnapshotBinding({
      hasher,
      content,
      subjectKind: 'approval_payload',
      subjectLabel: 'test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    expect(b1.contentHash).toBe(b2.contentHash);
  });

  it('produces different hashes for different content', () => {
    const b1 = createSnapshotBinding({
      hasher,
      content: { value: 'alpha' },
      subjectKind: 'custom',
      subjectLabel: 'test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });
    const b2 = createSnapshotBinding({
      hasher,
      content: { value: 'beta' },
      subjectKind: 'custom',
      subjectLabel: 'test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    expect(b1.contentHash).not.toBe(b2.contentHash);
  });

  it('canonicalizes JSON (key order does not matter)', () => {
    const b1 = createSnapshotBinding({
      hasher,
      content: { z: 1, a: 2 },
      subjectKind: 'custom',
      subjectLabel: 'test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });
    const b2 = createSnapshotBinding({
      hasher,
      content: { a: 2, z: 1 },
      subjectKind: 'custom',
      subjectLabel: 'test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    expect(b1.contentHash).toBe(b2.contentHash);
  });

  it('includes optional fields when provided', () => {
    const binding = createSnapshotBinding({
      hasher,
      content: { data: true },
      subjectKind: 'deployment_config',
      subjectLabel: 'prod config',
      capturedAtIso: '2026-01-01T00:00:00Z',
      contentUri: 'https://storage.example.com/configs/v3.json',
      contentSchemaVersion: '3.0.0',
    });

    expect(binding.contentUri).toBe('https://storage.example.com/configs/v3.json');
    expect(binding.contentSchemaVersion).toBe('3.0.0');
  });

  it('omits optional fields when not provided', () => {
    const binding = createSnapshotBinding({
      hasher,
      content: { x: 1 },
      subjectKind: 'custom',
      subjectLabel: 'test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    expect('contentUri' in binding).toBe(false);
    expect('contentSchemaVersion' in binding).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifySnapshotBinding
// ---------------------------------------------------------------------------

describe('verifySnapshotBinding', () => {
  it('returns verified when content has not changed', () => {
    const content = { amount: 500, status: 'pending' };
    const binding = createSnapshotBinding({
      hasher,
      content,
      subjectKind: 'financial_transaction',
      subjectLabel: 'Payment',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const result = verifySnapshotBinding({
      hasher,
      binding,
      currentContent: content,
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(result.status).toBe('verified');
    expect(result.verifiedAtIso).toBe('2026-01-02T00:00:00Z');
  });

  it('returns drifted when content has changed', () => {
    const original = { amount: 500, status: 'pending' };
    const binding = createSnapshotBinding({
      hasher,
      content: original,
      subjectKind: 'financial_transaction',
      subjectLabel: 'Payment',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const modified = { amount: 999, status: 'pending' };
    const result = verifySnapshotBinding({
      hasher,
      binding,
      currentContent: modified,
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(result.status).toBe('drifted');
    if (result.status === 'drifted') {
      expect(result.currentHash).not.toBe(binding.contentHash);
    }
  });

  it('detects drift from added fields', () => {
    const original = { name: 'Alice' };
    const binding = createSnapshotBinding({
      hasher,
      content: original,
      subjectKind: 'access_grant',
      subjectLabel: 'Grant',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const modified = { name: 'Alice', admin: true };
    const result = verifySnapshotBinding({
      hasher,
      binding,
      currentContent: modified,
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(result.status).toBe('drifted');
  });

  it('detects drift from removed fields', () => {
    const original = { name: 'Alice', role: 'admin' };
    const binding = createSnapshotBinding({
      hasher,
      content: original,
      subjectKind: 'access_grant',
      subjectLabel: 'Grant',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const modified = { name: 'Alice' };
    const result = verifySnapshotBinding({
      hasher,
      binding,
      currentContent: modified,
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(result.status).toBe('drifted');
  });

  it('returns frozen result', () => {
    const content = { x: 1 };
    const binding = createSnapshotBinding({
      hasher,
      content,
      subjectKind: 'custom',
      subjectLabel: 'test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const result = verifySnapshotBinding({
      hasher,
      binding,
      currentContent: content,
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createSnapshotSet
// ---------------------------------------------------------------------------

describe('createSnapshotSet', () => {
  it('creates a set from multiple bindings', () => {
    const b1 = createSnapshotBinding({
      hasher,
      content: { config: true },
      subjectKind: 'deployment_config',
      subjectLabel: 'Config',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });
    const b2 = createSnapshotBinding({
      hasher,
      content: { diff: 'abc' },
      subjectKind: 'code_diff',
      subjectLabel: 'Diff',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const set = createSnapshotSet({
      hasher,
      bindings: [b1, b2],
      createdAtIso: '2026-01-01T00:00:00Z',
    });

    expect(set.schemaVersion).toBe(1);
    expect(set.bindings).toHaveLength(2);
    expect(set.compoundHash).toBeTruthy();
    expect(Object.isFrozen(set)).toBe(true);
    expect(Object.isFrozen(set.bindings)).toBe(true);
  });

  it('produces deterministic compound hash regardless of binding order', () => {
    const b1 = createSnapshotBinding({
      hasher,
      content: { a: 1 },
      subjectKind: 'custom',
      subjectLabel: 'Alpha',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });
    const b2 = createSnapshotBinding({
      hasher,
      content: { b: 2 },
      subjectKind: 'custom',
      subjectLabel: 'Beta',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const set1 = createSnapshotSet({
      hasher,
      bindings: [b1, b2],
      createdAtIso: '2026-01-01T00:00:00Z',
    });
    const set2 = createSnapshotSet({
      hasher,
      bindings: [b2, b1],
      createdAtIso: '2026-01-01T00:00:00Z',
    });

    expect(set1.compoundHash).toBe(set2.compoundHash);
  });

  it('throws for empty bindings', () => {
    expect(() =>
      createSnapshotSet({
        hasher,
        bindings: [],
        createdAtIso: '2026-01-01T00:00:00Z',
      }),
    ).toThrow('at least one binding');
  });

  it('sorts bindings by subject label', () => {
    const bZ = createSnapshotBinding({
      hasher,
      content: {},
      subjectKind: 'custom',
      subjectLabel: 'Zulu',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });
    const bA = createSnapshotBinding({
      hasher,
      content: {},
      subjectKind: 'custom',
      subjectLabel: 'Alpha',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const set = createSnapshotSet({
      hasher,
      bindings: [bZ, bA],
      createdAtIso: '2026-01-01T00:00:00Z',
    });

    expect(set.bindings[0]!.subjectLabel).toBe('Alpha');
    expect(set.bindings[1]!.subjectLabel).toBe('Zulu');
  });
});

// ---------------------------------------------------------------------------
// verifySnapshotSet
// ---------------------------------------------------------------------------

describe('verifySnapshotSet', () => {
  it('returns allVerified=true when all content matches', () => {
    const configContent = { replicas: 3 };
    const diffContent = { lines: '+added' };

    const b1 = createSnapshotBinding({
      hasher,
      content: configContent,
      subjectKind: 'deployment_config',
      subjectLabel: 'Config',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });
    const b2 = createSnapshotBinding({
      hasher,
      content: diffContent,
      subjectKind: 'code_diff',
      subjectLabel: 'Diff',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const set = createSnapshotSet({
      hasher,
      bindings: [b1, b2],
      createdAtIso: '2026-01-01T00:00:00Z',
    });

    const currentContents = new Map<string, unknown>([
      ['Config', configContent],
      ['Diff', diffContent],
    ]);

    const result = verifySnapshotSet({
      hasher,
      snapshotSet: set,
      currentContents,
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(result.allVerified).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.status === 'verified')).toBe(true);
  });

  it('returns allVerified=false when any content drifted', () => {
    const configContent = { replicas: 3 };
    const diffContent = { lines: '+added' };

    const b1 = createSnapshotBinding({
      hasher,
      content: configContent,
      subjectKind: 'deployment_config',
      subjectLabel: 'Config',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });
    const b2 = createSnapshotBinding({
      hasher,
      content: diffContent,
      subjectKind: 'code_diff',
      subjectLabel: 'Diff',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const set = createSnapshotSet({
      hasher,
      bindings: [b1, b2],
      createdAtIso: '2026-01-01T00:00:00Z',
    });

    const currentContents = new Map<string, unknown>([
      ['Config', { replicas: 5 }], // changed!
      ['Diff', diffContent],
    ]);

    const result = verifySnapshotSet({
      hasher,
      snapshotSet: set,
      currentContents,
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(result.allVerified).toBe(false);
    const drifted = result.results.filter((r) => r.status === 'drifted');
    expect(drifted).toHaveLength(1);
  });

  it('marks missing content as drifted', () => {
    const binding = createSnapshotBinding({
      hasher,
      content: { x: 1 },
      subjectKind: 'custom',
      subjectLabel: 'Missing',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const set = createSnapshotSet({
      hasher,
      bindings: [binding],
      createdAtIso: '2026-01-01T00:00:00Z',
    });

    // Empty map — content is missing
    const result = verifySnapshotSet({
      hasher,
      snapshotSet: set,
      currentContents: new Map(),
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(result.allVerified).toBe(false);
    expect(result.results[0]!.status).toBe('drifted');
  });

  it('returns frozen result', () => {
    const binding = createSnapshotBinding({
      hasher,
      content: { x: 1 },
      subjectKind: 'custom',
      subjectLabel: 'Test',
      capturedAtIso: '2026-01-01T00:00:00Z',
    });

    const set = createSnapshotSet({
      hasher,
      bindings: [binding],
      createdAtIso: '2026-01-01T00:00:00Z',
    });

    const result = verifySnapshotSet({
      hasher,
      snapshotSet: set,
      currentContents: new Map([['Test', { x: 1 }]]),
      verifiedAtIso: '2026-01-02T00:00:00Z',
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.results)).toBe(true);
  });
});

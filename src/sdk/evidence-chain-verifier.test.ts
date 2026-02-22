/**
 * Tests for the portable evidence-chain verifier SDK helper.
 * Bead: bead-0741
 */

import { describe, it, expect } from 'vitest';
import {
  verifyEvidenceChain,
  canonicalJson,
  sha256Hex,
  type EvidenceEntryShape,
} from './evidence-chain-verifier.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeEntry(
  overrides: Partial<EvidenceEntryShape> & { evidenceId: string },
  prev?: EvidenceEntryShape,
): EvidenceEntryShape {
  const raw: Record<string, unknown> = {
    occurredAtIso: '2026-02-22T00:00:00.000Z',
    summary: `Entry ${overrides.evidenceId}`,
    ...overrides,
    ...(prev ? { previousHash: prev.hashSha256 } : {}),
  };
  delete raw['hashSha256'];
  const hashSha256 = sha256Hex(canonicalJson(raw));
  return { ...raw, hashSha256 } as EvidenceEntryShape;
}

function chainOf(count: number): EvidenceEntryShape[] {
  const entries: EvidenceEntryShape[] = [];
  for (let i = 0; i < count; i++) {
    const prev = entries[i - 1];
    entries.push(
      makeEntry(
        {
          evidenceId: `ev-${i}`,
          occurredAtIso: `2026-02-22T00:0${i}:00.000Z`,
        },
        prev,
      ),
    );
  }
  return entries;
}

// ── canonicalJson ─────────────────────────────────────────────────────────

describe('canonicalJson', () => {
  it('sorts keys deterministically', () => {
    expect(canonicalJson({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
  });

  it('handles nested objects', () => {
    const result = canonicalJson({ b: { y: 1, x: 2 }, a: 'v' });
    expect(result).toBe('{"a":"v","b":{"x":2,"y":1}}');
  });

  it('handles arrays', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('handles null and primitives', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson('hello')).toBe('"hello"');
  });
});

// ── verifyEvidenceChain ───────────────────────────────────────────────────

describe('verifyEvidenceChain', () => {
  it('accepts an empty chain', () => {
    const result = verifyEvidenceChain([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(0);
  });

  it('accepts a single-entry chain', () => {
    const entry = makeEntry({ evidenceId: 'ev-0' });
    const result = verifyEvidenceChain([entry]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(1);
  });

  it('accepts a valid multi-entry chain', () => {
    const entries = chainOf(5);
    const result = verifyEvidenceChain(entries);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(5);
  });

  it('detects hash_mismatch when an entry is tampered', () => {
    const entries = chainOf(3);
    // Tamper the summary of the second entry without recomputing the hash
    const tampered = { ...entries[1]!, summary: 'TAMPERED' };
    const chain = [entries[0]!, tampered, entries[2]!];

    const result = verifyEvidenceChain(chain);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.index).toBe(1);
      expect(result.reason).toBe('hash_mismatch');
    }
  });

  it('detects previous_hash_mismatch when link is broken', () => {
    const entries = chainOf(3);
    // Corrupt the previousHash of the third entry
    const broken = { ...entries[2]!, previousHash: 'deadbeef'.repeat(8) };
    const chain = [entries[0]!, entries[1]!, broken];

    const result = verifyEvidenceChain(chain);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.index).toBe(2);
      expect(result.reason).toBe('previous_hash_mismatch');
    }
  });

  it('detects unexpected_previous_hash on first entry', () => {
    const entry = makeEntry({ evidenceId: 'ev-0', previousHash: 'some-hash' } as Parameters<
      typeof makeEntry
    >[0]);
    const result = verifyEvidenceChain([entry]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.index).toBe(0);
      expect(result.reason).toBe('unexpected_previous_hash');
    }
  });

  it('detects timestamp_not_monotonic', () => {
    const e0 = makeEntry({ evidenceId: 'ev-0', occurredAtIso: '2026-02-22T00:01:00.000Z' });
    const e1 = makeEntry({ evidenceId: 'ev-1', occurredAtIso: '2026-02-22T00:00:00.000Z' }, e0);

    const result = verifyEvidenceChain([e0, e1]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.index).toBe(1);
      expect(result.reason).toBe('timestamp_not_monotonic');
    }
  });

  it('accepts a custom computeHash function', () => {
    const entries = chainOf(2);
    // Provide a custom hasher that wraps sha256Hex (same algo, proves extensibility)
    const result = verifyEvidenceChain(entries, { computeHash: sha256Hex });
    expect(result.ok).toBe(true);
  });
});

/**
 * Tests for the portable evidence-chain verifier (bead-0741).
 *
 * Uses the Web Crypto API via the test-setup polyfill — same environment
 * as the production runtime (Node.js 22+).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  type EvidenceChainVerificationResult,
  type PortableEvidenceEntry,
  verifyEvidenceChain,
} from './evidence-chain-verifier.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Compute the canonical SHA-256 hex for an entry (mirrors verifier internals). */
async function hashEntry(entry: PortableEvidenceEntry): Promise<string> {
  // Build canonical representation (sorted keys, exclude hashSha256/signatureBase64)
  const clean = sortedWithout(entry, ['hashSha256', 'signatureBase64']);
  const encoded = new TextEncoder().encode(JSON.stringify(clean, null));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Build a sorted-key object excluding specified keys — mirrors canonicalize(). */
function sortedWithout(
  obj: Record<string, unknown>,
  exclude: string[],
): Record<string, unknown> {
  const excludeSet = new Set(exclude);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    if (!excludeSet.has(k)) sorted[k] = obj[k];
  }
  return sorted;
}

/**
 * Build a valid chained entry list of a given length.
 * Each entry gets correct hashes so the chain is verifiable.
 */
async function buildValidChain(count: number): Promise<PortableEvidenceEntry[]> {
  const entries: PortableEvidenceEntry[] = [];

  for (let i = 0; i < count; i++) {
    const base: Record<string, unknown> = {
      evidenceId: `ev-${i}`,
      occurredAtIso: `2026-02-22T00:0${i}:00.000Z`,
      category: 'System',
      summary: `Entry ${i}`,
      actor: { kind: 'System' },
      ...(i > 0 ? { previousHash: entries[i - 1]!.hashSha256 } : {}),
    };

    const hashSha256 = await hashEntry({ ...base, hashSha256: '' } as PortableEvidenceEntry);
    entries.push({ ...base, hashSha256 } as PortableEvidenceEntry);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyEvidenceChain', () => {
  describe('empty chain', () => {
    it('accepts an empty chain', async () => {
      const result = await verifyEvidenceChain([]);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.entryCount).toBe(0);
    });
  });

  describe('single entry (no previous hash)', () => {
    let entry: PortableEvidenceEntry;

    beforeEach(async () => {
      const base = {
        evidenceId: 'ev-0',
        occurredAtIso: '2026-02-22T00:00:00.000Z',
        category: 'Approval',
        summary: 'Test entry',
        actor: { kind: 'User', userId: 'user-1' },
      };
      const hashSha256 = await hashEntry({ ...base, hashSha256: '' } as PortableEvidenceEntry);
      entry = { ...base, hashSha256 };
    });

    it('accepts a valid single entry', async () => {
      const result = await verifyEvidenceChain([entry]);
      expect(result.ok).toBe(true);
    });

    it('rejects a single entry with a previousHash', async () => {
      const tampered = { ...entry, previousHash: 'unexpected' };
      const result = await verifyEvidenceChain([tampered]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('unexpected_previous_hash');
    });

    it('rejects a single entry with a wrong hash', async () => {
      const tampered = { ...entry, hashSha256: 'a'.repeat(64) };
      const result = await verifyEvidenceChain([tampered]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('hash_mismatch');
    });
  });

  describe('multi-entry valid chains', () => {
    it('accepts a valid 3-entry chain', async () => {
      const chain = await buildValidChain(3);
      const result = await verifyEvidenceChain(chain);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.entryCount).toBe(3);
    });

    it('accepts a valid 10-entry chain', async () => {
      const chain = await buildValidChain(10);
      const result = await verifyEvidenceChain(chain);
      expect(result.ok).toBe(true);
    });
  });

  describe('broken hash chain (previous_hash_link_broken)', () => {
    it('detects a broken previousHash link at index 1', async () => {
      const chain = await buildValidChain(3);
      // Break the link: entry[1].previousHash should be entry[0].hashSha256
      const broken = { ...chain[1]!, previousHash: 'wrong-hash' };
      const tampered = [chain[0]!, broken, chain[2]!];
      const result = await verifyEvidenceChain(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('previous_hash_link_broken');
        expect(result.index).toBe(1);
      }
    });

    it('detects a broken previousHash link at index 2 in a 5-entry chain', async () => {
      const chain = await buildValidChain(5);
      const broken = { ...chain[2]!, previousHash: 'deadbeef' };
      const tampered = [...chain.slice(0, 2), broken, ...chain.slice(3)];
      const result = await verifyEvidenceChain(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('previous_hash_link_broken');
        expect(result.index).toBe(2);
      }
    });
  });

  describe('hash mismatch (tampered content)', () => {
    it('detects tampered content at index 0', async () => {
      const chain = await buildValidChain(2);
      // Mutate content without recalculating hash
      const tampered = [{ ...chain[0]!, summary: 'TAMPERED' }, chain[1]!];
      const result = await verifyEvidenceChain(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('hash_mismatch');
        expect(result.index).toBe(0);
      }
    });

    it('detects tampered content in the middle of a chain', async () => {
      const chain = await buildValidChain(5);
      const tampered = [
        chain[0]!,
        chain[1]!,
        { ...chain[2]!, category: 'INJECTED' },
        chain[3]!,
        chain[4]!,
      ];
      const result = await verifyEvidenceChain(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('hash_mismatch');
        expect(result.index).toBe(2);
      }
    });
  });

  describe('timestamp monotonicity', () => {
    it('detects non-monotonic timestamp at index 1', async () => {
      const chain = await buildValidChain(3);
      // entry[1] gets a timestamp earlier than entry[0]
      const broken = { ...chain[1]!, occurredAtIso: '2025-01-01T00:00:00.000Z' };
      const tampered = [chain[0]!, broken, chain[2]!];
      const result = await verifyEvidenceChain(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('timestamp_not_monotonic');
        expect(result.index).toBe(1);
      }
    });

    it('accepts equal timestamps (same second, different entries)', async () => {
      // Build chain manually with same timestamps
      const base0 = {
        evidenceId: 'ev-0',
        occurredAtIso: '2026-02-22T00:00:00.000Z',
        category: 'System',
        summary: 'A',
        actor: { kind: 'System' },
      };
      const hash0 = await hashEntry({ ...base0, hashSha256: '' } as PortableEvidenceEntry);
      const entry0 = { ...base0, hashSha256: hash0 };

      const base1 = {
        evidenceId: 'ev-1',
        occurredAtIso: '2026-02-22T00:00:00.000Z', // same timestamp
        category: 'System',
        summary: 'B',
        actor: { kind: 'System' },
        previousHash: hash0,
      };
      const hash1 = await hashEntry({ ...base1, hashSha256: '' } as PortableEvidenceEntry);
      const entry1 = { ...base1, hashSha256: hash1 };

      const result = await verifyEvidenceChain([entry0, entry1]);
      expect(result.ok).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('rejects entry missing evidenceId', async () => {
      const bad = {
        occurredAtIso: '2026-02-22T00:00:00.000Z',
        hashSha256: 'abc',
      } as unknown as PortableEvidenceEntry;
      const result = await verifyEvidenceChain([bad]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('entry_missing_required_fields');
    });

    it('rejects entry missing occurredAtIso', async () => {
      const bad = {
        evidenceId: 'ev-0',
        hashSha256: 'abc',
      } as unknown as PortableEvidenceEntry;
      const result = await verifyEvidenceChain([bad]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('entry_missing_required_fields');
    });

    it('rejects entry missing hashSha256', async () => {
      const bad = {
        evidenceId: 'ev-0',
        occurredAtIso: '2026-02-22T00:00:00.000Z',
      } as unknown as PortableEvidenceEntry;
      const result = await verifyEvidenceChain([bad]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('entry_missing_required_fields');
    });
  });

  describe('result shape', () => {
    it('ok result includes entryCount', async () => {
      const chain = await buildValidChain(4);
      const result = await verifyEvidenceChain(chain);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.entryCount).toBe(4);
    });

    it('error result includes index, reason, and message', async () => {
      const chain = await buildValidChain(3);
      const tampered = [chain[0]!, { ...chain[1]!, hashSha256: 'bad' }, chain[2]!];
      const result = await verifyEvidenceChain(tampered) as Extract<
        EvidenceChainVerificationResult,
        { ok: false }
      >;
      expect(result.ok).toBe(false);
      expect(typeof result.index).toBe('number');
      expect(typeof result.reason).toBe('string');
      expect(typeof result.message).toBe('string');
      expect(result.entryCount).toBe(3);
    });
  });
});

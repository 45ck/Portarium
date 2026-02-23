/**
 * bead-0758: Evidence chain V&V — Hash-chain integrity invariants.
 *
 * These tests verify the formal properties of the evidence hash chain:
 * - First entry has no previousHash
 * - Subsequent entries link to the previous entry's hash
 * - Timestamps are monotonically non-decreasing
 * - Tampering with any field invalidates the chain
 * - Signature verification catches invalid signatures
 */

import { describe, expect, it } from 'vitest';

import { appendEvidenceEntryV1, verifyEvidenceChainV1 } from '../evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../evidence/evidence-entry-v1.js';
import type { EvidenceHasher, EvidenceSignatureVerifier } from '../evidence/evidence-hasher.js';
import type { HashSha256 } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Test hasher (deterministic, non-cryptographic — for testing only)
// ---------------------------------------------------------------------------

function simpleHash(input: string): HashSha256 {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0') as unknown as HashSha256;
}

const testHasher: EvidenceHasher = {
  sha256Hex: simpleHash,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  index: number,
  previous: EvidenceEntryV1 | undefined,
  timestampSuffix: string,
): EvidenceEntryV1 {
  return appendEvidenceEntryV1({
    previous,
    next: {
      schemaVersion: 1,
      evidenceId: `ev-${index}` as EvidenceEntryV1['evidenceId'],
      workspaceId: 'ws-vv-1' as EvidenceEntryV1['workspaceId'],
      correlationId: `corr-vv-1` as EvidenceEntryV1['correlationId'],
      occurredAtIso: `2026-02-22T00:00:${timestampSuffix}Z`,
      category: 'Action',
      summary: `Evidence entry ${index}`,
      actor: { kind: 'System' },
    },
    hasher: testHasher,
  });
}

function buildChain(count: number): EvidenceEntryV1[] {
  const chain: EvidenceEntryV1[] = [];
  for (let i = 0; i < count; i += 1) {
    const suffix = String(i).padStart(2, '0') + '.000';
    chain.push(makeEntry(i, chain[i - 1], suffix));
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Chain construction invariants
// ---------------------------------------------------------------------------

describe('Evidence chain V&V: construction invariants', () => {
  it('first entry has no previousHash', () => {
    const chain = buildChain(1);
    expect(chain[0]!.previousHash).toBeUndefined();
  });

  it('subsequent entries reference the previous hash', () => {
    const chain = buildChain(3);
    expect(chain[1]!.previousHash).toBe(chain[0]!.hashSha256);
    expect(chain[2]!.previousHash).toBe(chain[1]!.hashSha256);
  });

  it('every entry has a non-empty hashSha256', () => {
    const chain = buildChain(5);
    for (const entry of chain) {
      expect(entry.hashSha256).toBeTruthy();
      expect(typeof entry.hashSha256).toBe('string');
    }
  });

  it('all entries share the same correlationId', () => {
    const chain = buildChain(4);
    const correlationId = chain[0]!.correlationId;
    for (const entry of chain) {
      expect(entry.correlationId).toBe(correlationId);
    }
  });
});

// ---------------------------------------------------------------------------
// Chain verification invariants
// ---------------------------------------------------------------------------

describe('Evidence chain V&V: verification invariants', () => {
  it('valid chain verifies successfully', () => {
    const chain = buildChain(5);
    const result = verifyEvidenceChainV1(chain, testHasher);
    expect(result.ok).toBe(true);
  });

  it('empty chain verifies successfully', () => {
    const result = verifyEvidenceChainV1([], testHasher);
    expect(result.ok).toBe(true);
  });

  it('single-entry chain verifies successfully', () => {
    const chain = buildChain(1);
    const result = verifyEvidenceChainV1(chain, testHasher);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tampering detection
// ---------------------------------------------------------------------------

describe('Evidence chain V&V: tampering detection', () => {
  it('modifying a summary invalidates the chain at that index', () => {
    const chain = buildChain(3);
    // Tamper with entry 1
    const tampered = { ...chain[1]!, summary: 'TAMPERED' };
    const tamperedChain = [chain[0]!, tampered, chain[2]!];

    const result = verifyEvidenceChainV1(tamperedChain, testHasher);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.index).toBe(1);
      expect(result.reason).toBe('hash_mismatch');
    }
  });

  it('swapping entry order breaks previousHash link', () => {
    const chain = buildChain(3);
    // Swap entries 1 and 2
    const swapped = [chain[0]!, chain[2]!, chain[1]!];

    const result = verifyEvidenceChainV1(swapped, testHasher);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Either previous_hash_mismatch or timestamp_not_monotonic depending on order
      expect(['previous_hash_mismatch', 'timestamp_not_monotonic']).toContain(result.reason);
    }
  });

  it('inserting a previousHash on the first entry is detected', () => {
    const chain = buildChain(2);
    const tampered = { ...chain[0]!, previousHash: 'fake-hash' as EvidenceEntryV1['hashSha256'] };
    const tamperedChain = [tampered, chain[1]!];

    const result = verifyEvidenceChainV1(tamperedChain, testHasher);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Hash will differ because the canonical JSON now includes previousHash
      expect(result.index).toBe(0);
    }
  });

  it('removing a previousHash from a non-first entry is detected', () => {
    const chain = buildChain(3);
    // Remove previousHash from entry 2
    const { previousHash: _, ...rest } = chain[2]!;
    void _;
    const tampered = rest as EvidenceEntryV1;
    const tamperedChain = [chain[0]!, chain[1]!, tampered];

    const result = verifyEvidenceChainV1(tamperedChain, testHasher);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.index).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Timestamp monotonicity
// ---------------------------------------------------------------------------

describe('Evidence chain V&V: timestamp monotonicity', () => {
  it('equal timestamps are allowed (monotonically non-decreasing)', () => {
    const e1 = makeEntry(0, undefined, '01.000');
    const e2 = appendEvidenceEntryV1({
      previous: e1,
      next: {
        schemaVersion: 1,
        evidenceId: 'ev-1' as EvidenceEntryV1['evidenceId'],
        workspaceId: 'ws-vv-1' as EvidenceEntryV1['workspaceId'],
        correlationId: 'corr-vv-1' as EvidenceEntryV1['correlationId'],
        occurredAtIso: '2026-02-22T00:00:01.000Z', // same timestamp
        category: 'Action',
        summary: 'Same timestamp entry',
        actor: { kind: 'System' },
      },
      hasher: testHasher,
    });

    const result = verifyEvidenceChainV1([e1, e2], testHasher);
    expect(result.ok).toBe(true);
  });

  it('decreasing timestamps are detected', () => {
    const e1 = makeEntry(0, undefined, '10.000');
    // Manually create an entry with earlier timestamp
    const e2 = appendEvidenceEntryV1({
      previous: e1,
      next: {
        schemaVersion: 1,
        evidenceId: 'ev-1' as EvidenceEntryV1['evidenceId'],
        workspaceId: 'ws-vv-1' as EvidenceEntryV1['workspaceId'],
        correlationId: 'corr-vv-1' as EvidenceEntryV1['correlationId'],
        occurredAtIso: '2026-02-22T00:00:05.000Z', // earlier than e1
        category: 'Action',
        summary: 'Earlier timestamp',
        actor: { kind: 'System' },
      },
      hasher: testHasher,
    });

    const result = verifyEvidenceChainV1([e1, e2], testHasher);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('timestamp_not_monotonic');
      expect(result.index).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('Evidence chain V&V: signature verification', () => {
  it('invalid signature is detected when verifier is provided', () => {
    const chain = buildChain(1);
    // Add a fake signature
    const signed = { ...chain[0]!, signatureBase64: 'fake-signature' };

    const alwaysRejectVerifier: EvidenceSignatureVerifier = {
      verify: () => false,
    };

    const result = verifyEvidenceChainV1([signed], testHasher, {
      verifier: alwaysRejectVerifier,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('signature_invalid');
    }
  });

  it('valid signature passes verification', () => {
    const chain = buildChain(1);
    const signed = { ...chain[0]!, signatureBase64: 'valid-sig' };

    const alwaysAcceptVerifier: EvidenceSignatureVerifier = {
      verify: () => true,
    };

    const result = verifyEvidenceChainV1([signed], testHasher, {
      verifier: alwaysAcceptVerifier,
    });
    expect(result.ok).toBe(true);
  });

  it('entries without signatures pass when verifier is provided', () => {
    const chain = buildChain(2);
    // No signatures on entries

    const verifier: EvidenceSignatureVerifier = {
      verify: () => false, // Would reject if called
    };

    const result = verifyEvidenceChainV1(chain, testHasher, { verifier });
    expect(result.ok).toBe(true);
  });
});

/**
 * Portable evidence-chain verifier for Portarium SDK consumers.
 *
 * This module is intentionally self-contained: it has no dependency on
 * `src/domain/` branded types so it can be vendored into any TypeScript
 * or JavaScript project without pulling in the full Portarium domain layer.
 *
 * Usage:
 *   import { verifyEvidenceChain, sha256Hex } from '@portarium/sdk/evidence-chain-verifier';
 *   const result = await verifyEvidenceChain(entries, { computeHash: sha256Hex });
 *   if (!result.ok) console.error('Chain broken at index', result.index, result.reason);
 *
 * Bead: bead-0741
 */

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Minimal shape of an evidence entry needed for chain verification. */
export type EvidenceEntryShape = Readonly<{
  evidenceId: string;
  occurredAtIso: string;
  previousHash?: string;
  hashSha256: string;
  [key: string]: unknown;
}>;

export type ChainVerificationOk = Readonly<{ ok: true; count: number }>;

export type ChainVerificationFail = Readonly<{
  ok: false;
  index: number;
  reason:
    | 'hash_mismatch'
    | 'previous_hash_mismatch'
    | 'unexpected_previous_hash'
    | 'timestamp_not_monotonic';
  expected?: string;
  actual?: string;
}>;

export type ChainVerificationResult = ChainVerificationOk | ChainVerificationFail;

// ---------------------------------------------------------------------------
// Canonical JSON (RFC 8785 subset — deterministic key order)
// ---------------------------------------------------------------------------

/**
 * Produces a deterministic JSON string suitable for SHA-256 hashing.
 * Keys are sorted recursively; this matches the domain-layer canonicalizer.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
  return `{${sorted.join(',')}}`;
}

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

/** Compute SHA-256 hex digest of a UTF-8 string using node:crypto. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Chain verifier
// ---------------------------------------------------------------------------

function stripHashFields(
  entry: EvidenceEntryShape,
): Omit<EvidenceEntryShape, 'hashSha256' | 'signatureBase64'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hashSha256, signatureBase64, ...rest } = entry as EvidenceEntryShape & {
    signatureBase64?: string;
  };
  return rest;
}

/**
 * Verify a sequence of evidence entries forms a valid tamper-evident chain.
 *
 * Checks performed for each entry (in order):
 * 1. Timestamp monotonicity (`occurredAtIso` must not decrease).
 * 2. `previousHash` link integrity (matches preceding entry's `hashSha256`).
 * 3. SHA-256 hash correctness (recomputed from canonical JSON).
 */
export function verifyEvidenceChain(
  entries: readonly EvidenceEntryShape[],
  opts?: Readonly<{ computeHash?: (input: string) => string }>,
): ChainVerificationResult {
  const computeHash = opts?.computeHash ?? sha256Hex;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;

    // 1. Timestamp monotonicity
    if (i > 0) {
      const prev = entries[i - 1]!;
      if (entry.occurredAtIso < prev.occurredAtIso) {
        return {
          ok: false,
          index: i,
          reason: 'timestamp_not_monotonic',
          expected: `>= ${prev.occurredAtIso}`,
          actual: entry.occurredAtIso,
        };
      }
    }

    // 2. previousHash link
    if (i === 0) {
      if (entry.previousHash !== undefined) {
        return { ok: false, index: i, reason: 'unexpected_previous_hash' };
      }
    } else {
      const prev = entries[i - 1]!;
      if (entry.previousHash !== prev.hashSha256) {
        return {
          ok: false,
          index: i,
          reason: 'previous_hash_mismatch',
          expected: prev.hashSha256,
          actual: entry.previousHash ?? 'undefined',
        };
      }
    }

    // 3. Hash correctness
    const stripped = stripHashFields(entry);
    const expected = computeHash(canonicalJson(stripped));
    if (expected !== entry.hashSha256) {
      return {
        ok: false,
        index: i,
        reason: 'hash_mismatch',
        expected,
        actual: entry.hashSha256,
      };
    }
  }

  return { ok: true, count: entries.length };
}

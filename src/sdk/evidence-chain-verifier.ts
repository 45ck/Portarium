/**
 * Portable evidence-chain verifier (bead-0741).
 *
 * A zero-dependency, browser-compatible utility for verifying Portarium
 * evidence chains downloaded from the control-plane API.
 *
 * Uses the Web Crypto API (available in Node.js 20+, all modern browsers,
 * and edge runtimes like Cloudflare Workers / Deno) — no native deps needed.
 *
 * Typical adopter usage:
 *
 *   import { verifyEvidenceChain } from '@portarium/sdk/evidence-chain-verifier';
 *
 *   const result = await verifyEvidenceChain(entries);
 *   if (!result.ok) {
 *     console.error('Chain broken at index', result.index, '—', result.reason);
 *   }
 */

// ---------------------------------------------------------------------------
// Public types (minimal surface — no internal domain types)
// ---------------------------------------------------------------------------

/**
 * A single evidence entry as returned by the Portarium API.
 * Only the fields required for chain verification are mandated.
 */
export type PortableEvidenceEntry = Readonly<{
  evidenceId: string;
  occurredAtIso: string;
  hashSha256: string;
  previousHash?: string;
  /** All remaining fields participate in the hash computation. */
  [key: string]: unknown;
}>;

export type EvidenceChainVerificationResult =
  | Readonly<{ ok: true; entryCount: number }>
  | Readonly<{
      ok: false;
      entryCount: number;
      index: number;
      reason:
        | 'hash_mismatch'
        | 'previous_hash_link_broken'
        | 'unexpected_previous_hash'
        | 'timestamp_not_monotonic'
        | 'entry_missing_required_fields';
      message: string;
    }>;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Verify the integrity of a Portarium evidence chain.
 *
 * Checks:
 *   1. Required fields present on every entry
 *   2. Timestamps are monotonically non-decreasing
 *   3. `previousHash` links form an unbroken chain
 *   4. `hashSha256` matches the SHA-256 of the canonicalized entry
 *
 * @param entries - Array of evidence entries in chain order (oldest first).
 * @returns Promise resolving to a verification result.
 */
export async function verifyEvidenceChain(
  entries: readonly PortableEvidenceEntry[],
): Promise<EvidenceChainVerificationResult> {
  const entryCount = entries.length;

  for (let i = 0; i < entryCount; i++) {
    const entry = entries[i]!;

    // ── (1) Required fields ───────────────────────────────────────────────
    if (
      typeof entry.evidenceId !== 'string' ||
      typeof entry.occurredAtIso !== 'string' ||
      typeof entry.hashSha256 !== 'string'
    ) {
      return {
        ok: false,
        entryCount,
        index: i,
        reason: 'entry_missing_required_fields',
        message: `Entry at index ${i} is missing evidenceId, occurredAtIso, or hashSha256.`,
      };
    }

    // ── (2) Timestamp monotonicity ────────────────────────────────────────
    if (i > 0) {
      const prev = entries[i - 1]!;
      if (entry.occurredAtIso < prev.occurredAtIso) {
        return {
          ok: false,
          entryCount,
          index: i,
          reason: 'timestamp_not_monotonic',
          message: `Entry at index ${i} has timestamp ${entry.occurredAtIso} which is before the previous entry (${prev.occurredAtIso}).`,
        };
      }
    }

    // ── (3) previousHash chain link ───────────────────────────────────────
    if (i === 0) {
      if (entry.previousHash !== undefined) {
        return {
          ok: false,
          entryCount,
          index: i,
          reason: 'unexpected_previous_hash',
          message: `First entry at index 0 must not have a previousHash field.`,
        };
      }
    } else {
      const prev = entries[i - 1]!;
      if (entry.previousHash !== prev.hashSha256) {
        return {
          ok: false,
          entryCount,
          index: i,
          reason: 'previous_hash_link_broken',
          message: `Entry at index ${i}: previousHash (${entry.previousHash ?? 'undefined'}) does not match the hash of the preceding entry (${prev.hashSha256}).`,
        };
      }
    }

    // ── (4) Hash integrity ────────────────────────────────────────────────
    const computedHash = await computeEntryHash(entry);
    if (computedHash !== entry.hashSha256) {
      return {
        ok: false,
        entryCount,
        index: i,
        reason: 'hash_mismatch',
        message: `Entry at index ${i} (${entry.evidenceId}): stored hash ${entry.hashSha256} does not match computed hash ${computedHash}.`,
      };
    }
  }

  return { ok: true, entryCount };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hash of an evidence entry, matching the server-side
 * canonicalization: JSON-stringify with sorted keys, `hashSha256` excluded.
 */
async function computeEntryHash(entry: PortableEvidenceEntry): Promise<string> {
  const entryWithoutHash = canonicalize(entry);
  const encoded = new TextEncoder().encode(entryWithoutHash);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return hexEncode(new Uint8Array(digest));
}

/**
 * Canonicalize an entry for hashing: sort keys lexicographically, exclude
 * `hashSha256` and `signatureBase64` (server-computed fields).
 */
function canonicalize(entry: PortableEvidenceEntry): string {
  return sortedJson(entry, new Set(['hashSha256', 'signatureBase64']));
}

function sortedJson(value: unknown, excludeKeys?: Set<string>, depth = 0): string {
  if (depth > 32) throw new Error('Evidence entry exceeds maximum nesting depth (32).');

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map((v) => sortedJson(v, undefined, depth + 1)).join(',') + ']';
  }

  const keys = Object.keys(value as Record<string, unknown>)
    .filter((k) => !excludeKeys?.has(k))
    .sort();

  const pairs = keys.map(
    (k) =>
      JSON.stringify(k) +
      ':' +
      sortedJson((value as Record<string, unknown>)[k], undefined, depth + 1),
  );

  return '{' + pairs.join(',') + '}';
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

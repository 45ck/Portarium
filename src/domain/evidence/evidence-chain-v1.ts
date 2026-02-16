import { canonicalizeJson } from './canonical-json.js';
import type { EvidenceEntryV1, EvidenceEntryV1WithoutHash } from './evidence-entry-v1.js';
import type { EvidenceHasher } from './evidence-hasher.js';

export type EvidenceChainVerificationResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      index: number;
      reason: 'hash_mismatch' | 'previous_hash_mismatch' | 'unexpected_previous_hash';
      expected?: string;
      actual?: string;
    }>;

export function canonicalizeEvidenceEntryV1(entry: EvidenceEntryV1WithoutHash): string {
  return canonicalizeJson(entry);
}

export function appendEvidenceEntryV1(params: {
  previous: EvidenceEntryV1 | undefined;
  next: Omit<EvidenceEntryV1, 'previousHash' | 'hashSha256'>;
  hasher: EvidenceHasher;
}): EvidenceEntryV1 {
  const base: EvidenceEntryV1WithoutHash = {
    ...params.next,
    ...(params.previous ? { previousHash: params.previous.hashSha256 } : {}),
  };

  const hashSha256 = params.hasher.sha256Hex(canonicalizeEvidenceEntryV1(base));
  return { ...base, hashSha256 };
}

export function verifyEvidenceChainV1(
  entries: readonly EvidenceEntryV1[],
  hasher: EvidenceHasher,
): EvidenceChainVerificationResult {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;

    const prevHashIssue = verifyPreviousHashLink({ entries, index: i });
    if (prevHashIssue) return prevHashIssue;

    const hashIssue = verifyEntryHash({ entry, index: i, hasher });
    if (hashIssue) return hashIssue;
  }

  return { ok: true };
}

function verifyPreviousHashLink(params: {
  entries: readonly EvidenceEntryV1[];
  index: number;
}): EvidenceChainVerificationResult | undefined {
  const entry = params.entries[params.index]!;

  if (params.index === 0) {
    if (entry.previousHash !== undefined) {
      return { ok: false, index: params.index, reason: 'unexpected_previous_hash' };
    }
    return undefined;
  }

  const prev = params.entries[params.index - 1]!;
  if (entry.previousHash !== prev.hashSha256) {
    return {
      ok: false,
      index: params.index,
      reason: 'previous_hash_mismatch',
      expected: String(prev.hashSha256),
      actual: entry.previousHash === undefined ? 'undefined' : String(entry.previousHash),
    };
  }

  return undefined;
}

function verifyEntryHash(params: {
  entry: EvidenceEntryV1;
  index: number;
  hasher: EvidenceHasher;
}): EvidenceChainVerificationResult | undefined {
  const withoutHash = stripHash(params.entry);
  const expected = params.hasher.sha256Hex(canonicalizeEvidenceEntryV1(withoutHash));
  if (expected !== params.entry.hashSha256) {
    return {
      ok: false,
      index: params.index,
      reason: 'hash_mismatch',
      expected: String(expected),
      actual: String(params.entry.hashSha256),
    };
  }

  return undefined;
}

function stripHash(entry: EvidenceEntryV1): EvidenceEntryV1WithoutHash {
  const { hashSha256, ...rest } = entry;
  void hashSha256;
  return rest;
}

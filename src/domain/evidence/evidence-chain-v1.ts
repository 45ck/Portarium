import { canonicalizeJson } from './canonical-json.js';
import type {
  EvidenceEntryV1,
  EvidenceEntryV1WithoutHash,
  EvidenceEntryV1WithoutSignature,
} from './evidence-entry-v1.js';
import type {
  EvidenceHasher,
  EvidenceSigner,
  EvidenceSignatureVerifier,
} from './evidence-hasher.js';

export type EvidenceChainVerificationResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      index: number;
      reason:
        | 'hash_mismatch'
        | 'previous_hash_mismatch'
        | 'unexpected_previous_hash'
        | 'signature_invalid'
        | 'timestamp_not_monotonic';
      expected?: string;
      actual?: string;
    }>;

/**
 * Canonicalize an entry for hash computation.
 * Input must not contain `hashSha256` or `signatureBase64`.
 */
export function canonicalizeEvidenceEntryV1(entry: EvidenceEntryV1WithoutHash): string {
  return canonicalizeJson(entry);
}

export function appendEvidenceEntryV1(params: {
  previous: EvidenceEntryV1 | undefined;
  next: Omit<EvidenceEntryV1, 'previousHash' | 'hashSha256' | 'signatureBase64'>;
  hasher: EvidenceHasher;
}): EvidenceEntryV1 {
  const base: EvidenceEntryV1WithoutHash = {
    ...params.next,
    ...(params.previous ? { previousHash: params.previous.hashSha256 } : {}),
  };

  const hashSha256 = params.hasher.sha256Hex(canonicalizeEvidenceEntryV1(base));
  return { ...base, hashSha256 };
}

/**
 * Sign a hashed evidence entry.  Returns a new entry with `signatureBase64` set.
 * The signature covers the canonical JSON of the entry WITHOUT `signatureBase64`
 * (i.e., all other fields including `hashSha256`).
 */
export function signEvidenceEntryV1(
  entry: EvidenceEntryV1,
  signer: EvidenceSigner,
): EvidenceEntryV1 {
  const withoutSig: EvidenceEntryV1WithoutSignature = stripSignature(entry);
  const canonical = canonicalizeJson(withoutSig);
  return { ...entry, signatureBase64: signer.sign(canonical) };
}

export function verifyEvidenceChainV1(
  entries: readonly EvidenceEntryV1[],
  hasher: EvidenceHasher,
  opts?: Readonly<{ verifier?: EvidenceSignatureVerifier }>,
): EvidenceChainVerificationResult {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;

    const tsIssue = verifyTimestampMonotonicity({ entries, index: i });
    if (tsIssue) return tsIssue;

    const prevHashIssue = verifyPreviousHashLink({ entries, index: i });
    if (prevHashIssue) return prevHashIssue;

    const hashIssue = verifyEntryHash({ entry, index: i, hasher });
    if (hashIssue) return hashIssue;

    if (opts?.verifier) {
      const sigIssue = verifyEntrySignature({ entry, index: i, verifier: opts.verifier });
      if (sigIssue) return sigIssue;
    }
  }

  return { ok: true };
}

function verifyTimestampMonotonicity(params: {
  entries: readonly EvidenceEntryV1[];
  index: number;
}): EvidenceChainVerificationResult | undefined {
  if (params.index === 0) return undefined;
  const prev = params.entries[params.index - 1]!;
  const curr = params.entries[params.index]!;
  if (curr.occurredAtIso < prev.occurredAtIso) {
    return {
      ok: false,
      index: params.index,
      reason: 'timestamp_not_monotonic',
      expected: `>= ${prev.occurredAtIso}`,
      actual: curr.occurredAtIso,
    };
  }
  return undefined;
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

function verifyEntrySignature(params: {
  entry: EvidenceEntryV1;
  index: number;
  verifier: EvidenceSignatureVerifier;
}): EvidenceChainVerificationResult | undefined {
  if (params.entry.signatureBase64 === undefined) return undefined;
  const withoutSig: EvidenceEntryV1WithoutSignature = stripSignature(params.entry);
  const canonical = canonicalizeJson(withoutSig);
  if (!params.verifier.verify(canonical, params.entry.signatureBase64)) {
    return { ok: false, index: params.index, reason: 'signature_invalid' };
  }
  return undefined;
}

function stripHash(entry: EvidenceEntryV1): EvidenceEntryV1WithoutHash {
  const { hashSha256, signatureBase64, ...rest } = entry;
  void hashSha256;
  void signatureBase64;
  return rest;
}

function stripSignature(entry: EvidenceEntryV1): EvidenceEntryV1WithoutSignature {
  const { signatureBase64, ...rest } = entry;
  void signatureBase64;
  return rest;
}

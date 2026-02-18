import type { HashSha256 } from '../primitives/index.js';

/**
 * EvidenceHasher abstracts hashing so the domain layer remains free of runtime
 * dependencies (e.g., node:crypto).
 */
export interface EvidenceHasher {
  sha256Hex(input: string): HashSha256;
}

export const HASH_SHA256_HEX_LENGTH = 64 as const;

/**
 * EvidenceSigner is a hook interface for producing digital signatures over
 * the canonical JSON form of an evidence entry or artifact.
 * The domain does not mandate a specific algorithm; implementations live in
 * the infrastructure layer (e.g., RSA-PSS, Ed25519).
 */
export interface EvidenceSigner {
  /** Sign canonical JSON (UTF-8). Returns base64-encoded signature. */
  sign(canonical: string): string;
}

/**
 * EvidenceSignatureVerifier is a hook interface for verifying digital signatures
 * produced by an EvidenceSigner.
 */
export interface EvidenceSignatureVerifier {
  /** Verify a base64-encoded signature over canonical JSON. */
  verify(canonical: string, signatureBase64: string): boolean;
}

import type { HashSha256 } from '../primitives/index.js';

/**
 * EvidenceHasher abstracts hashing so the domain layer remains free of runtime
 * dependencies (e.g., node:crypto).
 */
export interface EvidenceHasher {
  sha256Hex(input: string): HashSha256;
}

export const HASH_SHA256_HEX_LENGTH = 64 as const;

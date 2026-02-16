import crypto from 'node:crypto';

import type { EvidenceHasher } from '../../domain/evidence/evidence-hasher.js';
import { HashSha256 } from '../../domain/primitives/index.js';

/**
 * Node.js implementation of EvidenceHasher using node:crypto.
 */
export class NodeCryptoEvidenceHasher implements EvidenceHasher {
  public sha256Hex(input: string): HashSha256 {
    const hex = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    return HashSha256(hex);
  }
}

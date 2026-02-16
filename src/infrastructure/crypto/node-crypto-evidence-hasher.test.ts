import { describe, expect, it } from 'vitest';

import { NodeCryptoEvidenceHasher } from './node-crypto-evidence-hasher.js';

describe('NodeCryptoEvidenceHasher', () => {
  it('hashes known vectors as SHA-256 hex', () => {
    const hasher = new NodeCryptoEvidenceHasher();
    expect(hasher.sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

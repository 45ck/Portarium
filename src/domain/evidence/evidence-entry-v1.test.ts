import { describe, expect, it } from 'vitest';

import { EVIDENCE_ENTRY_V1_SCHEMA_VERSION } from './evidence-entry-v1.js';
import { HASH_SHA256_HEX_LENGTH } from './evidence-hasher.js';

describe('Evidence entry v1', () => {
  it('exports schema constants', () => {
    expect(EVIDENCE_ENTRY_V1_SCHEMA_VERSION).toBe(1);
    expect(HASH_SHA256_HEX_LENGTH).toBe(64);
  });
});

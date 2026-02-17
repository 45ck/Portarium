import { describe, expect, it } from 'vitest';
import { HASH_SHA256_HEX_LENGTH } from './evidence-hasher.js';

describe('HASH_SHA256_HEX_LENGTH', () => {
  it('is 64 (256 bits / 4 bits per hex digit)', () => {
    expect(HASH_SHA256_HEX_LENGTH).toBe(64);
  });
});

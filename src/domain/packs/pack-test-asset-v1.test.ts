import { describe, expect, it } from 'vitest';

import { parsePackTestAssetV1 } from './pack-test-asset-v1.js';

const VALID_TEST_ASSET = {
  schemaVersion: 1,
  assetId: 'ta-001',
  packId: 'scm.change-management',
  kind: 'fixture',
  dataPath: 'test-data/change-request-sample.json',
};

describe('parsePackTestAssetV1: happy path', () => {
  it('parses a valid v1 test asset', () => {
    const ta = parsePackTestAssetV1(VALID_TEST_ASSET);

    expect(ta.schemaVersion).toBe(1);
    expect(ta.assetId).toBe('ta-001');
    expect(ta.packId).toBe('scm.change-management');
    expect(ta.kind).toBe('fixture');
    expect(ta.dataPath).toBe('test-data/change-request-sample.json');
  });
});

describe('parsePackTestAssetV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parsePackTestAssetV1(null)).toThrow(/must be an object/);
    expect(() => parsePackTestAssetV1([])).toThrow(/must be an object/);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parsePackTestAssetV1({ ...VALID_TEST_ASSET, schemaVersion: 2 }),
    ).toThrow(/Unsupported schemaVersion/);
  });

  it('rejects missing required string fields', () => {
    expect(() =>
      parsePackTestAssetV1({ ...VALID_TEST_ASSET, assetId: '' }),
    ).toThrow(/assetId must be a non-empty string/);

    expect(() =>
      parsePackTestAssetV1({ ...VALID_TEST_ASSET, kind: 123 }),
    ).toThrow(/kind must be a non-empty string/);

    expect(() =>
      parsePackTestAssetV1({ ...VALID_TEST_ASSET, dataPath: '' }),
    ).toThrow(/dataPath must be a non-empty string/);
  });

  it('rejects non-integer schemaVersion', () => {
    expect(() =>
      parsePackTestAssetV1({ ...VALID_TEST_ASSET, schemaVersion: 1.5 }),
    ).toThrow(/schemaVersion must be an integer/);
  });
});

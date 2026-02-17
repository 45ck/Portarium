import { describe, expect, it } from 'vitest';

import { AssetParseError, parseAssetV1 } from './asset-v1.js';

describe('parseAssetV1', () => {
  const valid = {
    assetId: 'asset-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    name: 'MacBook Pro 16"',
    assetType: 'laptop',
    serialNumber: 'SN-12345',
    status: 'active',
    externalRefs: [
      {
        sorName: 'snipe-it',
        portFamily: 'ItsmItOps',
        externalId: 'snipe-99',
        externalType: 'Asset',
      },
    ],
  };

  it('parses a full AssetV1 with all fields', () => {
    const asset = parseAssetV1(valid);
    expect(asset.assetId).toBe('asset-1');
    expect(asset.name).toBe('MacBook Pro 16"');
    expect(asset.assetType).toBe('laptop');
    expect(asset.serialNumber).toBe('SN-12345');
    expect(asset.status).toBe('active');
    expect(asset.externalRefs).toHaveLength(1);
  });

  it('parses a minimal AssetV1 (required fields only)', () => {
    const asset = parseAssetV1({
      assetId: 'asset-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      name: 'Monitor',
      assetType: 'display',
      status: 'inactive',
    });
    expect(asset.assetId).toBe('asset-2');
    expect(asset.serialNumber).toBeUndefined();
    expect(asset.externalRefs).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseAssetV1('nope')).toThrow(AssetParseError);
    expect(() => parseAssetV1(null)).toThrow(AssetParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseAssetV1({ ...valid, name: '' })).toThrow(/name/);
    expect(() => parseAssetV1({ ...valid, assetType: 123 })).toThrow(/assetType/);
  });

  it('rejects invalid status', () => {
    expect(() => parseAssetV1({ ...valid, status: 'broken' })).toThrow(/status/);
  });
});

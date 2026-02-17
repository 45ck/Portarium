import { describe, expect, it } from 'vitest';

import { parseTenantConfigV1 } from './tenant-config-v1.js';

const VALID_TENANT_CONFIG = {
  schemaVersion: 1,
  tenantConfigId: 'tc-1',
  tenantId: 'tenant-1',
  workspaceId: 'ws-1',
  enabledPacks: [
    { packId: 'pack-crm', version: '1.2.3' },
    { packId: 'pack-billing', version: '0.9.0-beta.1' },
  ],
  featureFlags: [
    { flagName: 'darkMode', enabled: true },
    { flagName: 'experimentalSync', enabled: false },
  ],
  complianceProfiles: ['SOC2', 'GDPR'],
  updatedAtIso: '2026-02-17T00:00:00.000Z',
};

describe('parseTenantConfigV1: happy path', () => {
  it('parses a full TenantConfigV1 with all fields', () => {
    const config = parseTenantConfigV1(VALID_TENANT_CONFIG);

    expect(config.schemaVersion).toBe(1);
    expect(config.tenantConfigId).toBe('tc-1');
    expect(config.tenantId).toBe('tenant-1');
    expect(config.workspaceId).toBe('ws-1');
    expect(config.enabledPacks).toHaveLength(2);
    expect(config.enabledPacks[0]!.packId).toBe('pack-crm');
    expect(config.enabledPacks[0]!.version).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      preRelease: [],
      build: null,
    });
    expect(config.enabledPacks[1]!.version.preRelease).toEqual(['beta', 1]);
    expect(config.featureFlags).toHaveLength(2);
    expect(config.featureFlags[0]).toEqual({ flagName: 'darkMode', enabled: true });
    expect(config.featureFlags[1]).toEqual({ flagName: 'experimentalSync', enabled: false });
    expect(config.complianceProfiles).toEqual(['SOC2', 'GDPR']);
    expect(config.updatedAtIso).toBe('2026-02-17T00:00:00.000Z');
  });

  it('parses without optional complianceProfiles', () => {
    const config = parseTenantConfigV1({
      ...VALID_TENANT_CONFIG,
      complianceProfiles: undefined,
    });

    expect(config.complianceProfiles).toBeUndefined();
    expect(config.enabledPacks).toHaveLength(2);
    expect(config.featureFlags).toHaveLength(2);
  });

  it('parses with empty arrays for packs and flags', () => {
    const config = parseTenantConfigV1({
      ...VALID_TENANT_CONFIG,
      enabledPacks: [],
      featureFlags: [],
    });

    expect(config.enabledPacks).toEqual([]);
    expect(config.featureFlags).toEqual([]);
  });
});

describe('parseTenantConfigV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parseTenantConfigV1('nope')).toThrow(/TenantConfig must be an object/i);
    expect(() => parseTenantConfigV1(null)).toThrow(/TenantConfig must be an object/i);
    expect(() => parseTenantConfigV1([])).toThrow(/TenantConfig must be an object/i);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() => parseTenantConfigV1({ ...VALID_TENANT_CONFIG, schemaVersion: 2 })).toThrow(
      /schemaVersion/i,
    );
    expect(() => parseTenantConfigV1({ ...VALID_TENANT_CONFIG, schemaVersion: 1.5 })).toThrow(
      /schemaVersion/i,
    );
  });

  it('rejects missing required string fields', () => {
    expect(() =>
      parseTenantConfigV1({ ...VALID_TENANT_CONFIG, tenantConfigId: undefined }),
    ).toThrow(/tenantConfigId/i);
    expect(() => parseTenantConfigV1({ ...VALID_TENANT_CONFIG, tenantId: undefined })).toThrow(
      /tenantId/i,
    );
    expect(() => parseTenantConfigV1({ ...VALID_TENANT_CONFIG, workspaceId: undefined })).toThrow(
      /workspaceId/i,
    );
  });

  it('rejects invalid enabledPacks', () => {
    expect(() =>
      parseTenantConfigV1({ ...VALID_TENANT_CONFIG, enabledPacks: 'not-array' }),
    ).toThrow(/enabledPacks must be an array/i);
    expect(() => parseTenantConfigV1({ ...VALID_TENANT_CONFIG, enabledPacks: ['bad'] })).toThrow(
      /enabledPacks\[0\] must be an object/i,
    );
    expect(() =>
      parseTenantConfigV1({
        ...VALID_TENANT_CONFIG,
        enabledPacks: [{ packId: 'pack-1', version: 'not-semver!!!' }],
      }),
    ).toThrow(/enabledPacks\[0\]\.version/i);
  });

  it('rejects invalid featureFlags', () => {
    expect(() =>
      parseTenantConfigV1({ ...VALID_TENANT_CONFIG, featureFlags: 'not-array' }),
    ).toThrow(/featureFlags must be an array/i);
    expect(() =>
      parseTenantConfigV1({ ...VALID_TENANT_CONFIG, featureFlags: [{ flagName: 'x' }] }),
    ).toThrow(/featureFlags\[0\]\.enabled must be a boolean/i);
    expect(() =>
      parseTenantConfigV1({
        ...VALID_TENANT_CONFIG,
        featureFlags: [{ flagName: '', enabled: true }],
      }),
    ).toThrow(/featureFlags\[0\]\.flagName/i);
  });

  it('rejects invalid complianceProfiles', () => {
    expect(() =>
      parseTenantConfigV1({ ...VALID_TENANT_CONFIG, complianceProfiles: 'not-array' }),
    ).toThrow(/complianceProfiles must be an array/i);
    expect(() => parseTenantConfigV1({ ...VALID_TENANT_CONFIG, complianceProfiles: [''] })).toThrow(
      /complianceProfiles\[0\]/i,
    );
  });

  it('rejects invalid updatedAtIso', () => {
    expect(() =>
      parseTenantConfigV1({ ...VALID_TENANT_CONFIG, updatedAtIso: 'not-a-date' }),
    ).toThrow(/updatedAtIso/i);
  });
});

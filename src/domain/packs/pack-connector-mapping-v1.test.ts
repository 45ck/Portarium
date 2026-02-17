import { describe, expect, it } from 'vitest';

import { parsePackConnectorMappingV1 } from './pack-connector-mapping-v1.js';

const VALID_CONNECTOR_MAPPING = {
  schemaVersion: 1,
  mappingId: 'map-001',
  packId: 'scm.change-management',
  namespace: 'scm',
  protocol: 'REST',
  authModel: 'OAuth2',
  fieldMappings: [
    { sourceField: 'id', targetField: 'externalId', transform: 'toString' },
    { sourceField: 'name', targetField: 'displayName' },
  ],
};

describe('parsePackConnectorMappingV1: happy path', () => {
  it('parses a valid v1 connector mapping', () => {
    const cm = parsePackConnectorMappingV1(VALID_CONNECTOR_MAPPING);

    expect(cm.schemaVersion).toBe(1);
    expect(cm.mappingId).toBe('map-001');
    expect(cm.packId).toBe('scm.change-management');
    expect(cm.namespace).toBe('scm');
    expect(cm.protocol).toBe('REST');
    expect(cm.authModel).toBe('OAuth2');
    expect(cm.fieldMappings).toHaveLength(2);
    expect(cm.fieldMappings[0]!.transform).toBe('toString');
    expect(cm.fieldMappings[1]!.transform).toBeUndefined();
  });

  it('omits optional transform from field mappings when absent', () => {
    const cm = parsePackConnectorMappingV1({
      ...VALID_CONNECTOR_MAPPING,
      fieldMappings: [{ sourceField: 'a', targetField: 'b' }],
    });

    expect(cm.fieldMappings[0]).not.toHaveProperty('transform');
  });
});

describe('parsePackConnectorMappingV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parsePackConnectorMappingV1(null)).toThrow(/must be an object/);
    expect(() => parsePackConnectorMappingV1([])).toThrow(/must be an object/);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parsePackConnectorMappingV1({ ...VALID_CONNECTOR_MAPPING, schemaVersion: 2 }),
    ).toThrow(/Unsupported schemaVersion/);
  });

  it('rejects non-array fieldMappings', () => {
    expect(() =>
      parsePackConnectorMappingV1({ ...VALID_CONNECTOR_MAPPING, fieldMappings: 'oops' }),
    ).toThrow(/fieldMappings must be an array/);
  });

  it('rejects non-object field mapping entry', () => {
    expect(() =>
      parsePackConnectorMappingV1({ ...VALID_CONNECTOR_MAPPING, fieldMappings: [42] }),
    ).toThrow(/fieldMappings\[0\] must be an object/);
  });

  it('rejects missing required string fields', () => {
    expect(() =>
      parsePackConnectorMappingV1({ ...VALID_CONNECTOR_MAPPING, mappingId: '' }),
    ).toThrow(/mappingId must be a non-empty string/);

    expect(() =>
      parsePackConnectorMappingV1({ ...VALID_CONNECTOR_MAPPING, protocol: 123 }),
    ).toThrow(/protocol must be a non-empty string/);
  });

  it('rejects empty transform in field mapping when provided', () => {
    expect(() =>
      parsePackConnectorMappingV1({
        ...VALID_CONNECTOR_MAPPING,
        fieldMappings: [{ sourceField: 'a', targetField: 'b', transform: '' }],
      }),
    ).toThrow(/transform must be a non-empty string when provided/);
  });
});

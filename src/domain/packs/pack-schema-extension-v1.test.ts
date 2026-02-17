import { describe, expect, it } from 'vitest';

import { parsePackSchemaExtensionV1 } from './pack-schema-extension-v1.js';

const VALID_SCHEMA_EXTENSION = {
  schemaVersion: 1,
  extensionId: 'ext-001',
  packId: 'scm.change-management',
  namespace: 'scm',
  extendsCore: 'core.person',
  fields: [
    { fieldName: 'employeeId', fieldType: 'string', required: true, description: 'HR employee ID' },
    { fieldName: 'department', fieldType: 'string', required: false },
  ],
};

describe('parsePackSchemaExtensionV1: happy path', () => {
  it('parses a valid v1 schema extension', () => {
    const ext = parsePackSchemaExtensionV1(VALID_SCHEMA_EXTENSION);

    expect(ext.schemaVersion).toBe(1);
    expect(ext.extensionId).toBe('ext-001');
    expect(ext.packId).toBe('scm.change-management');
    expect(ext.namespace).toBe('scm');
    expect(ext.extendsCore).toBe('core.person');
    expect(ext.fields).toHaveLength(2);
    expect(ext.fields[0]!.fieldName).toBe('employeeId');
    expect(ext.fields[0]!.description).toBe('HR employee ID');
    expect(ext.fields[1]!.description).toBeUndefined();
  });

  it('omits optional description from fields when absent', () => {
    const ext = parsePackSchemaExtensionV1({
      ...VALID_SCHEMA_EXTENSION,
      fields: [{ fieldName: 'status', fieldType: 'string', required: true }],
    });

    expect(ext.fields[0]).not.toHaveProperty('description');
  });
});

describe('parsePackSchemaExtensionV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parsePackSchemaExtensionV1(null)).toThrow(/must be an object/);
    expect(() => parsePackSchemaExtensionV1([])).toThrow(/must be an object/);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parsePackSchemaExtensionV1({ ...VALID_SCHEMA_EXTENSION, schemaVersion: 2 }),
    ).toThrow(/Unsupported schemaVersion/);
  });

  it('rejects invalid extendsCore value', () => {
    expect(() =>
      parsePackSchemaExtensionV1({ ...VALID_SCHEMA_EXTENSION, extendsCore: 'core.invalid' }),
    ).toThrow(/Invalid extendsCore value/);
  });

  it('rejects non-array fields', () => {
    expect(() =>
      parsePackSchemaExtensionV1({ ...VALID_SCHEMA_EXTENSION, fields: 'oops' }),
    ).toThrow(/fields must be an array/);
  });

  it('rejects non-object field entry', () => {
    expect(() =>
      parsePackSchemaExtensionV1({ ...VALID_SCHEMA_EXTENSION, fields: ['bad'] }),
    ).toThrow(/fields\[0\] must be an object/);
  });

  it('rejects missing required string fields', () => {
    expect(() =>
      parsePackSchemaExtensionV1({ ...VALID_SCHEMA_EXTENSION, extensionId: '' }),
    ).toThrow(/extensionId must be a non-empty string/);

    expect(() =>
      parsePackSchemaExtensionV1({ ...VALID_SCHEMA_EXTENSION, namespace: 123 }),
    ).toThrow(/namespace must be a non-empty string/);
  });

  it('rejects non-boolean required in field', () => {
    expect(() =>
      parsePackSchemaExtensionV1({
        ...VALID_SCHEMA_EXTENSION,
        fields: [{ fieldName: 'x', fieldType: 'string', required: 'yes' }],
      }),
    ).toThrow(/required must be a boolean/);
  });

  it('rejects empty description in field when provided', () => {
    expect(() =>
      parsePackSchemaExtensionV1({
        ...VALID_SCHEMA_EXTENSION,
        fields: [{ fieldName: 'x', fieldType: 'string', required: true, description: '' }],
      }),
    ).toThrow(/description must be a non-empty string when provided/);
  });
});

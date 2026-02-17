import { describe, expect, it } from 'vitest';

import {
  buildJsonSchemaFromComponents,
  findDuplicates,
  listOperationIds,
  mustRecord,
  validateOrThrow,
} from './openapi-contract.test-helpers.js';

describe('openapi test helpers', () => {
  it('buildJsonSchemaFromComponents strips discriminator and rewrites refs', () => {
    const schema = {
      Workspace: {
        type: 'object',
        discriminator: { propertyName: 'kind' },
        properties: {
          nestedRef: { $ref: '#/components/schemas/Nested' },
        },
      },
      Nested: {
        type: 'object',
      },
    };

    const output = buildJsonSchemaFromComponents({
      rootName: 'Workspace',
      componentsSchemas: schema,
    }) as Record<string, unknown> &
      Record<'$defs', Record<string, unknown>> & { properties: { nestedRef: { $ref: string } } };

    expect(output['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(
      (output as { properties: { nestedRef: { $ref: string } } }).properties.nestedRef.$ref,
    ).toBe('#/$defs/Nested');
    expect((output as { $defs: Record<string, unknown> }).$defs).toHaveProperty('Workspace');
  });

  it('mustRecord enforces plain object input', () => {
    expect(() => mustRecord('not-object', 'value')).toThrow(/value must be an object/);
    expect(mustRecord({ a: 1 }, 'value')).toEqual({ a: 1 });
  });

  it('findDuplicates returns sorted duplicate values', () => {
    expect(findDuplicates(['b', 'a', 'b', 'c', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('listOperationIds extracts only valid operation ids', () => {
    const operationIds = listOperationIds({
      '/path': {
        get: { operationId: 'getWorkspace' },
        post: { operationId: '' },
      },
      '/ignore': {
        options: { operationId: 'listOperations' },
        foo: { operationId: 'invalidMethod' },
      },
    });

    expect(operationIds).toEqual(['getWorkspace', 'listOperations']);
  });

  it('validateOrThrow reports validator errors', () => {
    const validator = (() => false) as (data: unknown) => boolean;
    Object.assign(validator, { errors: [{ keyword: 'type' }] });

    expect(() => validateOrThrow(validator, { data: 'x' })).toThrow(/"keyword": "type"/);
  });
});

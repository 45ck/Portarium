import { describe, expect, it } from 'vitest';

import { parsePackUiTemplateV1 } from './pack-ui-template-v1.js';

const VALID_UI_TEMPLATE = {
  schemaVersion: 1,
  templateId: 'tpl-001',
  packId: 'scm.change-management',
  namespace: 'scm',
  schemaRef: 'schemas/change-request.json',
  fields: [
    { fieldName: 'title', widget: 'text-input', label: 'Title' },
    { fieldName: 'priority', widget: 'select' },
  ],
};

describe('parsePackUiTemplateV1: happy path', () => {
  it('parses a valid v1 UI template', () => {
    const tpl = parsePackUiTemplateV1(VALID_UI_TEMPLATE);

    expect(tpl.schemaVersion).toBe(1);
    expect(tpl.templateId).toBe('tpl-001');
    expect(tpl.packId).toBe('scm.change-management');
    expect(tpl.namespace).toBe('scm');
    expect(tpl.schemaRef).toBe('schemas/change-request.json');
    expect(tpl.fields).toHaveLength(2);
    expect(tpl.fields[0]!.label).toBe('Title');
    expect(tpl.fields[1]!.label).toBeUndefined();
  });

  it('omits optional label from fields when absent', () => {
    const tpl = parsePackUiTemplateV1({
      ...VALID_UI_TEMPLATE,
      fields: [{ fieldName: 'status', widget: 'badge' }],
    });

    expect(tpl.fields[0]).not.toHaveProperty('label');
  });
});

describe('parsePackUiTemplateV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parsePackUiTemplateV1(null)).toThrow(/must be an object/);
    expect(() => parsePackUiTemplateV1([])).toThrow(/must be an object/);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() => parsePackUiTemplateV1({ ...VALID_UI_TEMPLATE, schemaVersion: 2 })).toThrow(
      /Unsupported schemaVersion/,
    );
  });

  it('rejects non-array fields', () => {
    expect(() => parsePackUiTemplateV1({ ...VALID_UI_TEMPLATE, fields: 'oops' })).toThrow(
      /fields must be an array/,
    );
  });

  it('rejects non-object field entry', () => {
    expect(() => parsePackUiTemplateV1({ ...VALID_UI_TEMPLATE, fields: [null] })).toThrow(
      /fields\[0\] must be an object/,
    );
  });

  it('rejects missing required string fields', () => {
    expect(() => parsePackUiTemplateV1({ ...VALID_UI_TEMPLATE, templateId: '' })).toThrow(
      /templateId must be a non-empty string/,
    );

    expect(() => parsePackUiTemplateV1({ ...VALID_UI_TEMPLATE, schemaRef: 123 })).toThrow(
      /schemaRef must be a non-empty string/,
    );
  });

  it('rejects empty label in field when provided', () => {
    expect(() =>
      parsePackUiTemplateV1({
        ...VALID_UI_TEMPLATE,
        fields: [{ fieldName: 'x', widget: 'text', label: '' }],
      }),
    ).toThrow(/label must be a non-empty string when provided/);
  });
});

import { describe, expect, it } from 'vitest';

import { DocumentParseError, parseDocumentV1 } from './document-v1.js';

describe('parseDocumentV1', () => {
  const valid = {
    documentId: 'doc-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    title: 'Q4 Report',
    mimeType: 'application/pdf',
    sizeBytes: 204800,
    storagePath: '/docs/q4-report.pdf',
    createdAtIso: '2026-02-17T08:00:00.000Z',
    externalRefs: [
      {
        sorName: 'google-drive',
        portFamily: 'DocumentsEsign',
        externalId: 'gdrive-abc',
        externalType: 'File',
      },
    ],
  };

  it('parses a full DocumentV1 with all fields', () => {
    const doc = parseDocumentV1(valid);
    expect(doc.documentId).toBe('doc-1');
    expect(doc.title).toBe('Q4 Report');
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.sizeBytes).toBe(204800);
    expect(doc.storagePath).toBe('/docs/q4-report.pdf');
    expect(doc.externalRefs).toHaveLength(1);
  });

  it('parses a minimal DocumentV1 (required fields only)', () => {
    const doc = parseDocumentV1({
      documentId: 'doc-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      title: 'Readme',
      mimeType: 'text/plain',
      createdAtIso: '2026-01-01T00:00:00.000Z',
    });
    expect(doc.documentId).toBe('doc-2');
    expect(doc.sizeBytes).toBeUndefined();
    expect(doc.storagePath).toBeUndefined();
    expect(doc.externalRefs).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseDocumentV1('nope')).toThrow(DocumentParseError);
    expect(() => parseDocumentV1(null)).toThrow(DocumentParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseDocumentV1({ ...valid, title: '' })).toThrow(/title/);
    expect(() => parseDocumentV1({ ...valid, mimeType: 123 })).toThrow(/mimeType/);
  });

  it('rejects negative sizeBytes', () => {
    expect(() => parseDocumentV1({ ...valid, sizeBytes: -1 })).toThrow(/sizeBytes/);
  });
});

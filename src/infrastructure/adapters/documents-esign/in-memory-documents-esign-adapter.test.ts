import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryDocumentsEsignAdapter } from './in-memory-documents-esign-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryDocumentsEsignAdapter', () => {
  it('returns tenant-scoped documents and templates', async () => {
    const seedA = InMemoryDocumentsEsignAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryDocumentsEsignAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryDocumentsEsignAdapter({
      seed: {
        ...seedA,
        documents: [...seedA.documents!, ...seedB.documents!],
        templates: [...seedA.templates!, ...seedB.templates!],
      },
    });

    const documents = await adapter.execute({ tenantId: TENANT_A, operation: 'listDocuments' });
    expect(documents.ok).toBe(true);
    if (!documents.ok || documents.result.kind !== 'documents') return;
    expect(documents.result.documents).toHaveLength(1);
    expect(documents.result.documents[0]?.tenantId).toBe(TENANT_A);

    const templates = await adapter.execute({ tenantId: TENANT_A, operation: 'listTemplates' });
    expect(templates.ok).toBe(true);
    if (!templates.ok || templates.result.kind !== 'documents') return;
    expect(templates.result.documents).toHaveLength(1);
    expect(templates.result.documents[0]?.tenantId).toBe(TENANT_A);
  });

  it('supports document, folder, move, share, permission, and delete operations', async () => {
    const adapter = new InMemoryDocumentsEsignAdapter({
      seed: InMemoryDocumentsEsignAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const uploaded = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'uploadDocument',
      payload: { title: 'Security Addendum', mimeType: 'application/pdf', sizeBytes: 1200 },
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok || uploaded.result.kind !== 'document') return;
    const documentId = uploaded.result.document.documentId;

    const folder = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createFolder',
      payload: { name: 'Customer A' },
    });
    expect(folder.ok).toBe(true);
    if (!folder.ok || folder.result.kind !== 'externalRef') return;
    const folderId = folder.result.externalRef.externalId;

    const moved = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'moveDocument',
      payload: { documentId, folderId },
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok || moved.result.kind !== 'document') return;
    expect(moved.result.document.storagePath).toContain(folderId);

    const shared = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'shareDocument',
      payload: { documentId, target: 'legal@example.com' },
    });
    expect(shared.ok).toBe(true);
    if (!shared.ok || shared.result.kind !== 'externalRef') return;

    const permissionSet = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'setPermissions',
      payload: { documentId, permissions: ['viewer:legal@example.com', 'editor:ops@example.com'] },
    });
    expect(permissionSet.ok).toBe(true);
    if (!permissionSet.ok || permissionSet.result.kind !== 'externalRef') return;

    const permissions = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getPermissions',
      payload: { documentId },
    });
    expect(permissions.ok).toBe(true);
    if (!permissions.ok || permissions.result.kind !== 'externalRefs') return;
    expect(permissions.result.externalRefs).toHaveLength(2);

    const deleted = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'deleteDocument',
      payload: { documentId },
    });
    expect(deleted.ok).toBe(true);
    if (!deleted.ok || deleted.result.kind !== 'accepted') return;
  });

  it('supports signature requests, signed download, templates, and audit trail', async () => {
    const adapter = new InMemoryDocumentsEsignAdapter({
      seed: InMemoryDocumentsEsignAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const createdRequest = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createSignatureRequest',
      payload: { documentId: 'document-1000' },
    });
    expect(createdRequest.ok).toBe(true);
    if (!createdRequest.ok || createdRequest.result.kind !== 'externalRef') return;
    const signatureRequestId = createdRequest.result.externalRef.externalId;

    const fetchedRequest = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getSignatureRequest',
      payload: { signatureRequestId },
    });
    expect(fetchedRequest.ok).toBe(true);
    if (!fetchedRequest.ok || fetchedRequest.result.kind !== 'externalRef') return;
    expect(fetchedRequest.result.externalRef.externalId).toBe(signatureRequestId);

    const signed = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'downloadSignedDocument',
      payload: { signatureRequestId },
    });
    expect(signed.ok).toBe(true);
    if (!signed.ok || signed.result.kind !== 'document') return;
    expect(signed.result.document.title).toContain('Signed');

    const template = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createTemplate',
      payload: { title: 'SOW Template', mimeType: 'application/pdf' },
    });
    expect(template.ok).toBe(true);
    if (!template.ok || template.result.kind !== 'document') return;

    const audit = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAuditTrail',
      payload: { signatureRequestId },
    });
    expect(audit.ok).toBe(true);
    if (!audit.ok || audit.result.kind !== 'externalRef') return;
    expect(audit.result.externalRef.externalType).toBe('audit_trail');
  });

  it('returns validation errors for missing required fields', async () => {
    const adapter = new InMemoryDocumentsEsignAdapter({
      seed: InMemoryDocumentsEsignAdapter.seedMinimal(TENANT_A),
    });

    const missingTitle = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'uploadDocument',
      payload: {},
    });
    expect(missingTitle).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'title is required for uploadDocument.',
    });

    const missingPermissions = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'setPermissions',
      payload: { documentId: 'document-1000' },
    });
    expect(missingPermissions).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'permissions must be a non-empty array for setPermissions.',
    });

    const missingSignatureRef = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAuditTrail',
      payload: {},
    });
    expect(missingSignatureRef).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'signatureRequestId is required for getAuditTrail.',
    });
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryDocumentsEsignAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listDocuments',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported DocumentsEsign operation: bogusOperation.',
    });
  });
});

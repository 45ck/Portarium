import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryDocumentsEsignAdapter } from './in-memory-documents-esign-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryDocumentsEsignAdapter integration', () => {
  it('supports document lifecycle with folder placement and sharing', async () => {
    const adapter = new InMemoryDocumentsEsignAdapter({
      seed: InMemoryDocumentsEsignAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const documents = await adapter.execute({ tenantId: TENANT, operation: 'listDocuments' });
    expect(documents.ok).toBe(true);
    if (!documents.ok || documents.result.kind !== 'documents') return;
    const baselineDocumentId = documents.result.documents[0]!.documentId;

    const baselineDocument = await adapter.execute({
      tenantId: TENANT,
      operation: 'getDocument',
      payload: { documentId: baselineDocumentId },
    });
    expect(baselineDocument.ok).toBe(true);
    if (!baselineDocument.ok || baselineDocument.result.kind !== 'document') return;
    expect(baselineDocument.result.document.documentId).toBe(baselineDocumentId);

    const createdFolder = await adapter.execute({
      tenantId: TENANT,
      operation: 'createFolder',
      payload: { name: 'Executed Contracts' },
    });
    expect(createdFolder.ok).toBe(true);
    if (!createdFolder.ok || createdFolder.result.kind !== 'externalRef') return;
    const folderId = createdFolder.result.externalRef.externalId;

    const folders = await adapter.execute({ tenantId: TENANT, operation: 'listFolders' });
    expect(folders.ok).toBe(true);
    if (!folders.ok || folders.result.kind !== 'externalRefs') return;
    expect(folders.result.externalRefs.some((folder) => folder.externalId === folderId)).toBe(true);

    const uploadedDocument = await adapter.execute({
      tenantId: TENANT,
      operation: 'uploadDocument',
      payload: { title: 'Data Processing Addendum', mimeType: 'application/pdf', sizeBytes: 1024 },
    });
    expect(uploadedDocument.ok).toBe(true);
    if (!uploadedDocument.ok || uploadedDocument.result.kind !== 'document') return;
    const uploadedDocumentId = uploadedDocument.result.document.documentId;

    const movedDocument = await adapter.execute({
      tenantId: TENANT,
      operation: 'moveDocument',
      payload: { documentId: uploadedDocumentId, folderId },
    });
    expect(movedDocument.ok).toBe(true);
    if (!movedDocument.ok || movedDocument.result.kind !== 'document') return;
    expect(movedDocument.result.document.storagePath).toContain(`/folders/${folderId}/`);

    const sharedDocument = await adapter.execute({
      tenantId: TENANT,
      operation: 'shareDocument',
      payload: { documentId: uploadedDocumentId, target: 'legal@example.com' },
    });
    expect(sharedDocument.ok).toBe(true);
    if (!sharedDocument.ok || sharedDocument.result.kind !== 'externalRef') return;
    expect(sharedDocument.result.externalRef.externalType).toBe('share');

    const deletedDocument = await adapter.execute({
      tenantId: TENANT,
      operation: 'deleteDocument',
      payload: { documentId: uploadedDocumentId },
    });
    expect(deletedDocument.ok).toBe(true);
    if (!deletedDocument.ok || deletedDocument.result.kind !== 'accepted') return;

    const deletedLookup = await adapter.execute({
      tenantId: TENANT,
      operation: 'getDocument',
      payload: { documentId: uploadedDocumentId },
    });
    expect(deletedLookup).toEqual({
      ok: false,
      error: 'not_found',
      message: `Document ${uploadedDocumentId} was not found.`,
    });
  });

  it('supports permissions, signature requests, templates, and audit trail retrieval', async () => {
    const adapter = new InMemoryDocumentsEsignAdapter({
      seed: InMemoryDocumentsEsignAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const permissionSet = await adapter.execute({
      tenantId: TENANT,
      operation: 'setPermissions',
      payload: {
        documentId: 'document-1000',
        permissions: ['viewer:legal@example.com', 'editor:security@example.com'],
      },
    });
    expect(permissionSet.ok).toBe(true);
    if (!permissionSet.ok || permissionSet.result.kind !== 'externalRef') return;

    const permissions = await adapter.execute({
      tenantId: TENANT,
      operation: 'getPermissions',
      payload: { documentId: 'document-1000' },
    });
    expect(permissions.ok).toBe(true);
    if (!permissions.ok || permissions.result.kind !== 'externalRefs') return;
    expect(permissions.result.externalRefs).toHaveLength(2);

    const signatureRequest = await adapter.execute({
      tenantId: TENANT,
      operation: 'createSignatureRequest',
      payload: { documentId: 'document-1000' },
    });
    expect(signatureRequest.ok).toBe(true);
    if (!signatureRequest.ok || signatureRequest.result.kind !== 'externalRef') return;
    const signatureRequestId = signatureRequest.result.externalRef.externalId;

    const fetchedSignatureRequest = await adapter.execute({
      tenantId: TENANT,
      operation: 'getSignatureRequest',
      payload: { signatureRequestId },
    });
    expect(fetchedSignatureRequest.ok).toBe(true);
    if (!fetchedSignatureRequest.ok || fetchedSignatureRequest.result.kind !== 'externalRef') return;
    expect(fetchedSignatureRequest.result.externalRef.externalId).toBe(signatureRequestId);

    const listedSignatureRequests = await adapter.execute({
      tenantId: TENANT,
      operation: 'listSignatureRequests',
    });
    expect(listedSignatureRequests.ok).toBe(true);
    if (!listedSignatureRequests.ok || listedSignatureRequests.result.kind !== 'externalRefs') return;
    expect(
      listedSignatureRequests.result.externalRefs.some((entry) => entry.externalId === signatureRequestId),
    ).toBe(true);

    const downloadedSignedDocument = await adapter.execute({
      tenantId: TENANT,
      operation: 'downloadSignedDocument',
      payload: { signatureRequestId },
    });
    expect(downloadedSignedDocument.ok).toBe(true);
    if (!downloadedSignedDocument.ok || downloadedSignedDocument.result.kind !== 'document') return;
    expect(downloadedSignedDocument.result.document.title).toContain('Signed');

    const firstAuditTrail = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAuditTrail',
      payload: { signatureRequestId },
    });
    expect(firstAuditTrail.ok).toBe(true);
    if (!firstAuditTrail.ok || firstAuditTrail.result.kind !== 'externalRef') return;

    const secondAuditTrail = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAuditTrail',
      payload: { signatureRequestId },
    });
    expect(secondAuditTrail.ok).toBe(true);
    if (!secondAuditTrail.ok || secondAuditTrail.result.kind !== 'externalRef') return;
    expect(secondAuditTrail.result.externalRef.externalId).toBe(firstAuditTrail.result.externalRef.externalId);

    const template = await adapter.execute({
      tenantId: TENANT,
      operation: 'createTemplate',
      payload: { title: 'Master Order Form', mimeType: 'application/pdf' },
    });
    expect(template.ok).toBe(true);
    if (!template.ok || template.result.kind !== 'document') return;

    const templates = await adapter.execute({ tenantId: TENANT, operation: 'listTemplates' });
    expect(templates.ok).toBe(true);
    if (!templates.ok || templates.result.kind !== 'documents') return;
    expect(templates.result.documents.some((entry) => entry.title === 'Master Order Form')).toBe(true);
  });

  it('returns validation and not-found errors for invalid payloads', async () => {
    const adapter = new InMemoryDocumentsEsignAdapter({
      seed: InMemoryDocumentsEsignAdapter.seedMinimal(TENANT),
    });

    const missingDocumentId = await adapter.execute({
      tenantId: TENANT,
      operation: 'moveDocument',
      payload: { folderId: 'folder-1000' },
    });
    expect(missingDocumentId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'documentId is required for moveDocument.',
    });

    const invalidPermissionEntries = await adapter.execute({
      tenantId: TENANT,
      operation: 'setPermissions',
      payload: { documentId: 'document-1000', permissions: ['viewer:a@example.com', ''] },
    });
    expect(invalidPermissionEntries).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'permissions entries must be non-empty strings for setPermissions.',
    });

    const missingSignatureRequestId = await adapter.execute({
      tenantId: TENANT,
      operation: 'getSignatureRequest',
      payload: {},
    });
    expect(missingSignatureRequestId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'signatureRequestId is required for getSignatureRequest.',
    });

    const missingSourceDocument = await adapter.execute({
      tenantId: TENANT,
      operation: 'createSignatureRequest',
      payload: { documentId: 'document-does-not-exist' },
    });
    expect(missingSourceDocument).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Document document-does-not-exist was not found.',
    });
  });
});

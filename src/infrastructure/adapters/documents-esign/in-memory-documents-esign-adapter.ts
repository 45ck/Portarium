import type { DocumentV1 } from '../../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import { DocumentId } from '../../../domain/primitives/index.js';
import type {
  DocumentsEsignAdapterPort,
  DocumentsEsignExecuteInputV1,
  DocumentsEsignExecuteOutputV1,
} from '../../../application/ports/documents-esign-adapter.js';
import { DOCUMENTS_ESIGN_OPERATIONS_V1 } from '../../../application/ports/documents-esign-adapter.js';

const OPERATION_SET = new Set<string>(DOCUMENTS_ESIGN_OPERATIONS_V1);

type TenantExternalRef = Readonly<{
  tenantId: DocumentsEsignExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type PermissionEntry = Readonly<{
  tenantId: DocumentsEsignExecuteInputV1['tenantId'];
  documentId: string;
  externalRefs: readonly ExternalObjectRef[];
}>;

type SignedDocumentEntry = Readonly<{
  tenantId: DocumentsEsignExecuteInputV1['tenantId'];
  signatureRequestId: string;
  document: DocumentV1;
}>;

type AuditTrailEntry = Readonly<{
  tenantId: DocumentsEsignExecuteInputV1['tenantId'];
  signatureRequestId: string;
  externalRef: ExternalObjectRef;
}>;

type InMemoryDocumentsEsignAdapterSeed = Readonly<{
  documents?: readonly DocumentV1[];
  folders?: readonly TenantExternalRef[];
  permissionSets?: readonly PermissionEntry[];
  signatureRequests?: readonly TenantExternalRef[];
  signedDocuments?: readonly SignedDocumentEntry[];
  templates?: readonly DocumentV1[];
  auditTrails?: readonly AuditTrailEntry[];
}>;

type InMemoryDocumentsEsignAdapterParams = Readonly<{
  seed?: InMemoryDocumentsEsignAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(payload: Readonly<Record<string, unknown>> | undefined, key: string): number | null {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class InMemoryDocumentsEsignAdapter implements DocumentsEsignAdapterPort {
  readonly #now: () => Date;
  readonly #documents: DocumentV1[];
  readonly #folders: TenantExternalRef[];
  readonly #permissionSets: PermissionEntry[];
  readonly #signatureRequests: TenantExternalRef[];
  readonly #signedDocuments: SignedDocumentEntry[];
  readonly #templates: DocumentV1[];
  readonly #auditTrails: AuditTrailEntry[];
  #documentSequence: number;
  #folderSequence: number;
  #shareSequence: number;
  #signatureSequence: number;
  #templateSequence: number;
  #auditSequence: number;

  public constructor(params?: InMemoryDocumentsEsignAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#documents = [...(params?.seed?.documents ?? [])];
    this.#folders = [...(params?.seed?.folders ?? [])];
    this.#permissionSets = [...(params?.seed?.permissionSets ?? [])];
    this.#signatureRequests = [...(params?.seed?.signatureRequests ?? [])];
    this.#signedDocuments = [...(params?.seed?.signedDocuments ?? [])];
    this.#templates = [...(params?.seed?.templates ?? [])];
    this.#auditTrails = [...(params?.seed?.auditTrails ?? [])];
    this.#documentSequence = this.#documents.length;
    this.#folderSequence = this.#folders.length;
    this.#shareSequence = 0;
    this.#signatureSequence = this.#signatureRequests.length;
    this.#templateSequence = this.#templates.length;
    this.#auditSequence = this.#auditTrails.length;
  }

  public async execute(input: DocumentsEsignExecuteInputV1): Promise<DocumentsEsignExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported DocumentsEsign operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listDocuments':
        return { ok: true, result: { kind: 'documents', documents: this.#listDocuments(input) } };
      case 'getDocument':
        return this.#getDocument(input);
      case 'uploadDocument':
        return this.#uploadDocument(input);
      case 'deleteDocument':
        return this.#deleteDocument(input);
      case 'createFolder':
        return this.#createFolder(input);
      case 'listFolders':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#folders, input) },
        };
      case 'moveDocument':
        return this.#moveDocument(input);
      case 'shareDocument':
        return this.#shareDocument(input);
      case 'getPermissions':
        return this.#getPermissions(input);
      case 'setPermissions':
        return this.#setPermissions(input);
      case 'createSignatureRequest':
        return this.#createSignatureRequest(input);
      case 'getSignatureRequest':
        return this.#getTenantRef(
          input,
          this.#signatureRequests,
          'signatureRequestId',
          'Signature request',
          'getSignatureRequest',
        );
      case 'listSignatureRequests':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#signatureRequests, input),
          },
        };
      case 'downloadSignedDocument':
        return this.#downloadSignedDocument(input);
      case 'createTemplate':
        return this.#createTemplate(input);
      case 'listTemplates':
        return { ok: true, result: { kind: 'documents', documents: this.#listTemplates(input) } };
      case 'getAuditTrail':
        return this.#getAuditTrail(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported DocumentsEsign operation: ${String(input.operation)}.`,
        };
    }
  }

  #listDocuments(input: DocumentsEsignExecuteInputV1): readonly DocumentV1[] {
    return this.#documents.filter((document) => document.tenantId === input.tenantId);
  }

  #getDocument(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const documentId = readString(input.payload, 'documentId');
    if (documentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'documentId is required for getDocument.',
      };
    }

    const document = this.#documents.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.documentId === documentId,
    );
    if (document === undefined) {
      return { ok: false, error: 'not_found', message: `Document ${documentId} was not found.` };
    }
    return { ok: true, result: { kind: 'document', document } };
  }

  #uploadDocument(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for uploadDocument.',
      };
    }

    const sizeBytes = readNumber(input.payload, 'sizeBytes');
    if (sizeBytes !== null && sizeBytes < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'sizeBytes must be a non-negative number for uploadDocument.',
      };
    }

    const document: DocumentV1 = {
      documentId: DocumentId(`document-${++this.#documentSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title,
      mimeType:
        typeof input.payload?.['mimeType'] === 'string'
          ? (input.payload['mimeType'])
          : 'application/octet-stream',
      ...(sizeBytes !== null ? { sizeBytes } : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#documents.push(document);
    return { ok: true, result: { kind: 'document', document } };
  }

  #deleteDocument(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const documentId = readString(input.payload, 'documentId');
    if (documentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'documentId is required for deleteDocument.',
      };
    }

    const index = this.#documents.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.documentId === documentId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Document ${documentId} was not found.` };
    }
    this.#documents.splice(index, 1);
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #createFolder(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createFolder.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'DocSuite',
      portFamily: 'DocumentsEsign',
      externalId: `folder-${++this.#folderSequence}`,
      externalType: 'folder',
      displayLabel: name,
    };
    this.#folders.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #moveDocument(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const documentId = readString(input.payload, 'documentId');
    if (documentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'documentId is required for moveDocument.',
      };
    }
    const folderId = readString(input.payload, 'folderId');
    if (folderId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'folderId is required for moveDocument.',
      };
    }

    const folder = this.#folders.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.externalRef.externalId === folderId,
    );
    if (folder === undefined) {
      return { ok: false, error: 'not_found', message: `Folder ${folderId} was not found.` };
    }
    void folder;

    const index = this.#documents.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.documentId === documentId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Document ${documentId} was not found.` };
    }

    const document: DocumentV1 = {
      ...this.#documents[index]!,
      storagePath: `/folders/${folderId}/${documentId}`,
    };
    this.#documents[index] = document;
    return { ok: true, result: { kind: 'document', document } };
  }

  #shareDocument(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const documentId = readString(input.payload, 'documentId');
    if (documentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'documentId is required for shareDocument.',
      };
    }
    const target = readString(input.payload, 'target');
    if (target === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'target is required for shareDocument.',
      };
    }

    const document = this.#documents.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.documentId === documentId,
    );
    if (document === undefined) {
      return { ok: false, error: 'not_found', message: `Document ${documentId} was not found.` };
    }
    void document;

    const externalRef: ExternalObjectRef = {
      sorName: 'DocSuite',
      portFamily: 'DocumentsEsign',
      externalId: `share-${++this.#shareSequence}`,
      externalType: 'share',
      displayLabel: `Shared with ${target}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #getPermissions(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const documentId = readString(input.payload, 'documentId');
    if (documentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'documentId is required for getPermissions.',
      };
    }

    const found = this.#permissionSets.find(
      (entry) => entry.tenantId === input.tenantId && entry.documentId === documentId,
    );
    return {
      ok: true,
      result: { kind: 'externalRefs', externalRefs: found?.externalRefs ?? [] },
    };
  }

  #setPermissions(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const documentId = readString(input.payload, 'documentId');
    if (documentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'documentId is required for setPermissions.',
      };
    }

    const permissions = input.payload?.['permissions'];
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'permissions must be a non-empty array for setPermissions.',
      };
    }
    if (!permissions.every((value) => typeof value === 'string' && value.length > 0)) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'permissions entries must be non-empty strings for setPermissions.',
      };
    }

    const index = this.#permissionSets.findIndex(
      (entry) => entry.tenantId === input.tenantId && entry.documentId === documentId,
    );
    const externalRefs: ExternalObjectRef[] = permissions.map((permission, permissionIndex) => ({
      sorName: 'DocSuite',
      portFamily: 'DocumentsEsign',
      externalId: `permission-${documentId}-${permissionIndex + 1}`,
      externalType: 'permission',
      displayLabel: permission as string,
    }));
    const next: PermissionEntry = {
      tenantId: input.tenantId,
      documentId,
      externalRefs,
    };
    if (index < 0) {
      this.#permissionSets.push(next);
    } else {
      this.#permissionSets[index] = next;
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'DocSuite',
      portFamily: 'DocumentsEsign',
      externalId: `permission-set-${documentId}`,
      externalType: 'permission_set',
      displayLabel: `Permissions updated for ${documentId}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createSignatureRequest(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const documentId = readString(input.payload, 'documentId');
    if (documentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'documentId is required for createSignatureRequest.',
      };
    }

    const sourceDocument = this.#documents.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.documentId === documentId,
    );
    if (sourceDocument === undefined) {
      return { ok: false, error: 'not_found', message: `Document ${documentId} was not found.` };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'DocSuite',
      portFamily: 'DocumentsEsign',
      externalId: `signature-request-${++this.#signatureSequence}`,
      externalType: 'signature_request',
      displayLabel: `Signature request for ${sourceDocument.title}`,
    };
    this.#signatureRequests.push({ tenantId: input.tenantId, externalRef });

    const signedDocument: DocumentV1 = {
      documentId: DocumentId(`signed-${sourceDocument.documentId}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title: `Signed ${sourceDocument.title}`,
      mimeType: sourceDocument.mimeType,
      createdAtIso: this.#now().toISOString(),
    };
    this.#signedDocuments.push({
      tenantId: input.tenantId,
      signatureRequestId: externalRef.externalId,
      document: signedDocument,
    });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #downloadSignedDocument(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const signatureRequestId = readString(input.payload, 'signatureRequestId');
    if (signatureRequestId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'signatureRequestId is required for downloadSignedDocument.',
      };
    }

    const signed = this.#signedDocuments.find(
      (candidate) =>
        candidate.tenantId === input.tenantId && candidate.signatureRequestId === signatureRequestId,
    );
    if (signed === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Signed document for ${signatureRequestId} was not found.`,
      };
    }
    return { ok: true, result: { kind: 'document', document: signed.document } };
  }

  #createTemplate(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createTemplate.',
      };
    }

    const document: DocumentV1 = {
      documentId: DocumentId(`template-${++this.#templateSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title,
      mimeType:
        typeof input.payload?.['mimeType'] === 'string'
          ? (input.payload['mimeType'])
          : 'application/pdf',
      createdAtIso: this.#now().toISOString(),
    };
    this.#templates.push(document);
    return { ok: true, result: { kind: 'document', document } };
  }

  #listTemplates(input: DocumentsEsignExecuteInputV1): readonly DocumentV1[] {
    return this.#templates.filter((template) => template.tenantId === input.tenantId);
  }

  #getAuditTrail(input: DocumentsEsignExecuteInputV1): DocumentsEsignExecuteOutputV1 {
    const signatureRequestId = readString(input.payload, 'signatureRequestId');
    if (signatureRequestId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'signatureRequestId is required for getAuditTrail.',
      };
    }

    const signatureRequest = this.#signatureRequests.find(
      (entry) =>
        entry.tenantId === input.tenantId && entry.externalRef.externalId === signatureRequestId,
    );
    if (signatureRequest === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Signature request ${signatureRequestId} was not found.`,
      };
    }
    void signatureRequest;

    const existing = this.#auditTrails.find(
      (entry) =>
        entry.tenantId === input.tenantId && entry.signatureRequestId === signatureRequestId,
    );
    if (existing !== undefined) {
      return { ok: true, result: { kind: 'externalRef', externalRef: existing.externalRef } };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'DocSuite',
      portFamily: 'DocumentsEsign',
      externalId: `audit-trail-${++this.#auditSequence}`,
      externalType: 'audit_trail',
      displayLabel: `Audit trail for ${signatureRequestId}`,
    };
    this.#auditTrails.push({ tenantId: input.tenantId, signatureRequestId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: DocumentsEsignExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((entry) => entry.tenantId === input.tenantId)
      .map((entry) => entry.externalRef);
  }

  #getTenantRef(
    input: DocumentsEsignExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): DocumentsEsignExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${operationName}.`,
      };
    }
    const found = source.find(
      (entry) =>
        entry.tenantId === input.tenantId && entry.externalRef.externalId === externalId,
    );
    if (found === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: found.externalRef } };
  }

  public static seedMinimal(
    tenantId: DocumentsEsignExecuteInputV1['tenantId'],
  ): InMemoryDocumentsEsignAdapterSeed {
    return {
      documents: [
        {
          documentId: DocumentId('document-1000'),
          tenantId,
          schemaVersion: 1,
          title: 'Master Service Agreement',
          mimeType: 'application/pdf',
          createdAtIso: '2026-02-19T00:00:00.000Z',
        },
      ],
      folders: [
        {
          tenantId,
          externalRef: {
            sorName: 'DocSuite',
            portFamily: 'DocumentsEsign',
            externalId: 'folder-1000',
            externalType: 'folder',
            displayLabel: 'Contracts',
          },
        },
      ],
      permissionSets: [
        {
          tenantId,
          documentId: 'document-1000',
          externalRefs: [
            {
              sorName: 'DocSuite',
              portFamily: 'DocumentsEsign',
              externalId: 'permission-document-1000-1',
              externalType: 'permission',
              displayLabel: 'viewer:legal@example.com',
            },
          ],
        },
      ],
      signatureRequests: [
        {
          tenantId,
          externalRef: {
            sorName: 'DocSuite',
            portFamily: 'DocumentsEsign',
            externalId: 'signature-request-1000',
            externalType: 'signature_request',
            displayLabel: 'MSA signature request',
          },
        },
      ],
      signedDocuments: [
        {
          tenantId,
          signatureRequestId: 'signature-request-1000',
          document: {
            documentId: DocumentId('signed-document-1000'),
            tenantId,
            schemaVersion: 1,
            title: 'Signed Master Service Agreement',
            mimeType: 'application/pdf',
            createdAtIso: '2026-02-19T00:00:00.000Z',
          },
        },
      ],
      templates: [
        {
          documentId: DocumentId('template-1000'),
          tenantId,
          schemaVersion: 1,
          title: 'NDA Template',
          mimeType: 'application/pdf',
          createdAtIso: '2026-02-19T00:00:00.000Z',
        },
      ],
      auditTrails: [
        {
          tenantId,
          signatureRequestId: 'signature-request-1000',
          externalRef: {
            sorName: 'DocSuite',
            portFamily: 'DocumentsEsign',
            externalId: 'audit-trail-1000',
            externalType: 'audit_trail',
            displayLabel: 'MSA audit trail',
          },
        },
      ],
    };
  }
}

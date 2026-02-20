import type { DocumentV1 } from '../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const DOCUMENTS_ESIGN_OPERATIONS_V1 = [
  'listDocuments',
  'getDocument',
  'uploadDocument',
  'deleteDocument',
  'createFolder',
  'listFolders',
  'moveDocument',
  'shareDocument',
  'getPermissions',
  'setPermissions',
  'createSignatureRequest',
  'getSignatureRequest',
  'listSignatureRequests',
  'downloadSignedDocument',
  'createTemplate',
  'listTemplates',
  'getAuditTrail',
] as const;

export type DocumentsEsignOperationV1 = (typeof DOCUMENTS_ESIGN_OPERATIONS_V1)[number];

export type DocumentsEsignOperationResultV1 =
  | Readonly<{ kind: 'document'; document: DocumentV1 }>
  | Readonly<{ kind: 'documents'; documents: readonly DocumentV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: DocumentsEsignOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type DocumentsEsignExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: DocumentsEsignOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type DocumentsEsignExecuteOutputV1 =
  | Readonly<{ ok: true; result: DocumentsEsignOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface DocumentsEsignAdapterPort {
  execute(input: DocumentsEsignExecuteInputV1): Promise<DocumentsEsignExecuteOutputV1>;
}

import type { DocumentV1 } from '../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { OpportunityV1 } from '../../domain/canonical/opportunity-v1.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { CanonicalTaskV1 } from '../../domain/canonical/task-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const CRM_SALES_OPERATIONS_V1 = [
  'listContacts',
  'getContact',
  'createContact',
  'updateContact',
  'listCompanies',
  'getCompany',
  'createCompany',
  'listOpportunities',
  'getOpportunity',
  'createOpportunity',
  'updateOpportunityStage',
  'listPipelines',
  'listActivities',
  'createActivity',
  'listNotes',
  'createNote',
] as const;

export type CrmSalesOperationV1 = (typeof CRM_SALES_OPERATIONS_V1)[number];

export type CrmSalesOperationResultV1 =
  | Readonly<{ kind: 'party'; party: PartyV1 }>
  | Readonly<{ kind: 'parties'; parties: readonly PartyV1[] }>
  | Readonly<{ kind: 'opportunity'; opportunity: OpportunityV1 }>
  | Readonly<{ kind: 'opportunities'; opportunities: readonly OpportunityV1[] }>
  | Readonly<{ kind: 'task'; task: CanonicalTaskV1 }>
  | Readonly<{ kind: 'tasks'; tasks: readonly CanonicalTaskV1[] }>
  | Readonly<{ kind: 'document'; document: DocumentV1 }>
  | Readonly<{ kind: 'documents'; documents: readonly DocumentV1[] }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: CrmSalesOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type CrmSalesExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: CrmSalesOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type CrmSalesExecuteOutputV1 =
  | Readonly<{ ok: true; result: CrmSalesOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface CrmSalesAdapterPort {
  execute(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1>;
}

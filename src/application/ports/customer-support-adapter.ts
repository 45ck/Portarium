import type { DocumentV1 } from '../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { TicketV1 } from '../../domain/canonical/ticket-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const CUSTOMER_SUPPORT_OPERATIONS_V1 = [
  'listTickets',
  'getTicket',
  'createTicket',
  'updateTicket',
  'closeTicket',
  'listAgents',
  'assignTicket',
  'addComment',
  'listComments',
  'listTags',
  'createTag',
  'getKnowledgeArticle',
  'listKnowledgeArticles',
  'getSLA',
  'listCustomerSatisfactionRatings',
] as const;

export type CustomerSupportOperationV1 = (typeof CUSTOMER_SUPPORT_OPERATIONS_V1)[number];

export type CustomerSupportOperationResultV1 =
  | Readonly<{ kind: 'ticket'; ticket: TicketV1 }>
  | Readonly<{ kind: 'tickets'; tickets: readonly TicketV1[] }>
  | Readonly<{ kind: 'agent'; agent: PartyV1 }>
  | Readonly<{ kind: 'agents'; agents: readonly PartyV1[] }>
  | Readonly<{ kind: 'document'; document: DocumentV1 }>
  | Readonly<{ kind: 'documents'; documents: readonly DocumentV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: CustomerSupportOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type CustomerSupportExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: CustomerSupportOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type CustomerSupportExecuteOutputV1 =
  | Readonly<{ ok: true; result: CustomerSupportOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface CustomerSupportAdapterPort {
  execute(input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1>;
}

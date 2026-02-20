import type { AssetV1 } from '../../domain/canonical/asset-v1.js';
import type { DocumentV1 } from '../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { ProductV1 } from '../../domain/canonical/product-v1.js';
import type { SubscriptionV1 } from '../../domain/canonical/subscription-v1.js';
import type { TicketV1 } from '../../domain/canonical/ticket-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const ITSM_IT_OPS_OPERATIONS_V1 = [
  'listIncidents',
  'getIncident',
  'createIncident',
  'updateIncident',
  'resolveIncident',
  'listChangeRequests',
  'createChangeRequest',
  'approveChangeRequest',
  'listAssets',
  'getAsset',
  'createAsset',
  'updateAsset',
  'listCMDBItems',
  'getCMDBItem',
  'listProblems',
  'createProblem',
  'listServiceRequests',
] as const;

export type ItsmItOpsOperationV1 = (typeof ITSM_IT_OPS_OPERATIONS_V1)[number];

export type ItsmItOpsOperationResultV1 =
  | Readonly<{ kind: 'ticket'; ticket: TicketV1 }>
  | Readonly<{ kind: 'tickets'; tickets: readonly TicketV1[] }>
  | Readonly<{ kind: 'asset'; asset: AssetV1 }>
  | Readonly<{ kind: 'assets'; assets: readonly AssetV1[] }>
  | Readonly<{ kind: 'party'; party: PartyV1 }>
  | Readonly<{ kind: 'parties'; parties: readonly PartyV1[] }>
  | Readonly<{ kind: 'document'; document: DocumentV1 }>
  | Readonly<{ kind: 'documents'; documents: readonly DocumentV1[] }>
  | Readonly<{ kind: 'subscription'; subscription: SubscriptionV1 }>
  | Readonly<{ kind: 'subscriptions'; subscriptions: readonly SubscriptionV1[] }>
  | Readonly<{ kind: 'product'; product: ProductV1 }>
  | Readonly<{ kind: 'products'; products: readonly ProductV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: ItsmItOpsOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type ItsmItOpsExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: ItsmItOpsOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type ItsmItOpsExecuteOutputV1 =
  | Readonly<{ ok: true; result: ItsmItOpsOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface ItsmItOpsAdapterPort {
  execute(input: ItsmItOpsExecuteInputV1): Promise<ItsmItOpsExecuteOutputV1>;
}

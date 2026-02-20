import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { OrderV1 } from '../../domain/canonical/order-v1.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { SubscriptionV1 } from '../../domain/canonical/subscription-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const PROCUREMENT_SPEND_OPERATIONS_V1 = [
  'createPurchaseOrder',
  'getPurchaseOrder',
  'approvePurchaseOrder',
  'listPurchaseOrders',
  'createExpenseReport',
  'getExpenseReport',
  'approveExpenseReport',
  'listExpenseReports',
  'createVendor',
  'getVendor',
  'listVendors',
  'createRFQ',
  'listContracts',
  'getContract',
] as const;

export type ProcurementSpendOperationV1 = (typeof PROCUREMENT_SPEND_OPERATIONS_V1)[number];

export type ProcurementSpendOperationResultV1 =
  | Readonly<{ kind: 'order'; order: OrderV1 }>
  | Readonly<{ kind: 'orders'; orders: readonly OrderV1[] }>
  | Readonly<{ kind: 'vendor'; vendor: PartyV1 }>
  | Readonly<{ kind: 'vendors'; vendors: readonly PartyV1[] }>
  | Readonly<{ kind: 'contract'; contract: SubscriptionV1 }>
  | Readonly<{ kind: 'contracts'; contracts: readonly SubscriptionV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: ProcurementSpendOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type ProcurementSpendExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: ProcurementSpendOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type ProcurementSpendExecuteOutputV1 =
  | Readonly<{ ok: true; result: ProcurementSpendOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface ProcurementSpendAdapterPort {
  execute(input: ProcurementSpendExecuteInputV1): Promise<ProcurementSpendExecuteOutputV1>;
}

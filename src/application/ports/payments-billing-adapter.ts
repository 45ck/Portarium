import type { AccountV1 } from '../../domain/canonical/account-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { InvoiceV1 } from '../../domain/canonical/invoice-v1.js';
import type { PaymentV1 } from '../../domain/canonical/payment-v1.js';
import type { SubscriptionV1 } from '../../domain/canonical/subscription-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const PAYMENTS_BILLING_OPERATIONS_V1 = [
  'createCharge',
  'getCharge',
  'refundCharge',
  'listCharges',
  'createSubscription',
  'getSubscription',
  'cancelSubscription',
  'listSubscriptions',
  'createInvoice',
  'getInvoice',
  'listInvoices',
  'getPaymentMethod',
  'listPaymentMethods',
  'createPayout',
  'getBalance',
] as const;

export type PaymentsBillingOperationV1 = (typeof PAYMENTS_BILLING_OPERATIONS_V1)[number];

export type PaymentsBillingOperationResultV1 =
  | Readonly<{ kind: 'payment'; payment: PaymentV1 }>
  | Readonly<{ kind: 'payments'; payments: readonly PaymentV1[] }>
  | Readonly<{ kind: 'subscription'; subscription: SubscriptionV1 }>
  | Readonly<{ kind: 'subscriptions'; subscriptions: readonly SubscriptionV1[] }>
  | Readonly<{ kind: 'invoice'; invoice: InvoiceV1 }>
  | Readonly<{ kind: 'invoices'; invoices: readonly InvoiceV1[] }>
  | Readonly<{ kind: 'paymentMethod'; paymentMethod: ExternalObjectRef }>
  | Readonly<{ kind: 'paymentMethods'; paymentMethods: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'account'; account: AccountV1 }>
  | Readonly<{ kind: 'accepted'; operation: PaymentsBillingOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type PaymentsBillingExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: PaymentsBillingOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type PaymentsBillingExecuteOutputV1 =
  | Readonly<{ ok: true; result: PaymentsBillingOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface PaymentsBillingAdapterPort {
  execute(input: PaymentsBillingExecuteInputV1): Promise<PaymentsBillingExecuteOutputV1>;
}

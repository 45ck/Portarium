import type { AccountV1 } from '../../../domain/canonical/account-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { InvoiceV1 } from '../../../domain/canonical/invoice-v1.js';
import type { PaymentV1 } from '../../../domain/canonical/payment-v1.js';
import type { SubscriptionV1 } from '../../../domain/canonical/subscription-v1.js';
import {
  FinancialAccountId,
  InvoiceId,
  PaymentId,
  SubscriptionId,
  TenantId,
} from '../../../domain/primitives/index.js';
import type {
  PaymentsBillingAdapterPort,
  PaymentsBillingExecuteInputV1,
  PaymentsBillingExecuteOutputV1,
} from '../../../application/ports/payments-billing-adapter.js';
import { PAYMENTS_BILLING_OPERATIONS_V1 } from '../../../application/ports/payments-billing-adapter.js';

const OPERATION_SET = new Set<string>(PAYMENTS_BILLING_OPERATIONS_V1);

type InMemoryPaymentsBillingAdapterSeed = Readonly<{
  charges?: readonly PaymentV1[];
  subscriptions?: readonly SubscriptionV1[];
  invoices?: readonly InvoiceV1[];
  paymentMethods?: readonly ExternalObjectRef[];
  balance?: AccountV1;
}>;

type InMemoryPaymentsBillingAdapterParams = Readonly<{
  seed?: InMemoryPaymentsBillingAdapterSeed;
  now?: () => Date;
}>;

function readString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | null {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class InMemoryPaymentsBillingAdapter implements PaymentsBillingAdapterPort {
  readonly #now: () => Date;
  readonly #charges: PaymentV1[];
  readonly #subscriptions: SubscriptionV1[];
  readonly #invoices: InvoiceV1[];
  readonly #paymentMethods: ExternalObjectRef[];
  readonly #balance: AccountV1;
  #paymentSequence: number;
  #subscriptionSequence: number;
  #invoiceSequence: number;

  public constructor(params?: InMemoryPaymentsBillingAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#charges = [...(params?.seed?.charges ?? [])];
    this.#subscriptions = [...(params?.seed?.subscriptions ?? [])];
    this.#invoices = [...(params?.seed?.invoices ?? [])];
    this.#paymentMethods = [...(params?.seed?.paymentMethods ?? [])];
    const balanceTenantId =
      this.#charges[0]?.tenantId ??
      this.#invoices[0]?.tenantId ??
      this.#subscriptions[0]?.tenantId ??
      TenantId('tenant-default');
    this.#balance = params?.seed?.balance ?? {
      accountId: FinancialAccountId('bal-1000'),
      tenantId: balanceTenantId,
      schemaVersion: 1,
      accountName: 'Platform Balance',
      accountCode: 'BAL-1000',
      accountType: 'asset',
      currencyCode: 'USD',
      isActive: true,
    };
    this.#paymentSequence = this.#charges.length;
    this.#subscriptionSequence = this.#subscriptions.length;
    this.#invoiceSequence = this.#invoices.length;
  }

  public async execute(
    input: PaymentsBillingExecuteInputV1,
  ): Promise<PaymentsBillingExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported PaymentsBilling operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'createCharge':
        return this.#createCharge(input);
      case 'getCharge':
        return this.#getCharge(input);
      case 'refundCharge':
        return this.#refundCharge(input);
      case 'listCharges':
        return { ok: true, result: { kind: 'payments', payments: this.#listCharges(input) } };
      case 'createSubscription':
        return this.#createSubscription(input);
      case 'getSubscription':
        return this.#getSubscription(input);
      case 'cancelSubscription':
        return this.#cancelSubscription(input);
      case 'listSubscriptions':
        return {
          ok: true,
          result: { kind: 'subscriptions', subscriptions: this.#listSubscriptions(input) },
        };
      case 'createInvoice':
        return this.#createInvoice(input);
      case 'getInvoice':
        return this.#getInvoice(input);
      case 'listInvoices':
        return { ok: true, result: { kind: 'invoices', invoices: this.#listInvoices(input) } };
      case 'getPaymentMethod':
        return this.#getPaymentMethod(input);
      case 'listPaymentMethods':
        return {
          ok: true,
          result: { kind: 'paymentMethods', paymentMethods: this.#listPaymentMethods() },
        };
      case 'createPayout':
        return this.#createPayout(input);
      case 'getBalance':
        return { ok: true, result: { kind: 'account', account: this.#balance } };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported PaymentsBilling operation: ${String(input.operation)}.`,
        };
    }
  }

  #createCharge(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const amount = readNumber(input.payload, 'amount');
    if (amount === null || amount < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'amount must be a non-negative number for createCharge.',
      };
    }

    const payment: PaymentV1 = {
      paymentId: PaymentId(`pay-${++this.#paymentSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      amount,
      currencyCode:
        typeof input.payload?.['currencyCode'] === 'string' ? input.payload['currencyCode'] : 'USD',
      status: 'completed',
      paidAtIso: this.#now().toISOString(),
    };
    this.#charges.push(payment);
    return { ok: true, result: { kind: 'payment', payment } };
  }

  #getCharge(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const paymentId = readString(input.payload, 'paymentId');
    if (paymentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'paymentId is required for getCharge.',
      };
    }
    const payment = this.#charges.find(
      (item) => item.tenantId === input.tenantId && item.paymentId === paymentId,
    );
    if (payment === undefined) {
      return { ok: false, error: 'not_found', message: `Payment ${paymentId} was not found.` };
    }
    return { ok: true, result: { kind: 'payment', payment } };
  }

  #refundCharge(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const paymentId = readString(input.payload, 'paymentId');
    if (paymentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'paymentId is required for refundCharge.',
      };
    }
    const payment = this.#charges.find(
      (item) => item.tenantId === input.tenantId && item.paymentId === paymentId,
    );
    if (payment === undefined) {
      return { ok: false, error: 'not_found', message: `Payment ${paymentId} was not found.` };
    }
    const refunded: PaymentV1 = { ...payment, status: 'refunded' };
    const index = this.#charges.findIndex((item) => item.paymentId === payment.paymentId);
    this.#charges[index] = refunded;
    return { ok: true, result: { kind: 'payment', payment: refunded } };
  }

  #listCharges(input: PaymentsBillingExecuteInputV1): readonly PaymentV1[] {
    return this.#charges.filter((payment) => payment.tenantId === input.tenantId);
  }

  #createSubscription(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const planName = readString(input.payload, 'planName');
    if (planName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'planName is required for createSubscription.',
      };
    }
    const subscription: SubscriptionV1 = {
      subscriptionId: SubscriptionId(`sub-${++this.#subscriptionSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      planName,
      status: 'active',
      currencyCode: 'USD',
      recurringAmount: readNumber(input.payload, 'recurringAmount') ?? 0,
      currentPeriodStartIso: this.#now().toISOString(),
      currentPeriodEndIso: this.#now().toISOString(),
    };
    this.#subscriptions.push(subscription);
    return { ok: true, result: { kind: 'subscription', subscription } };
  }

  #getSubscription(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const subscriptionId = readString(input.payload, 'subscriptionId');
    if (subscriptionId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subscriptionId is required for getSubscription.',
      };
    }
    const subscription = this.#subscriptions.find(
      (item) => item.tenantId === input.tenantId && item.subscriptionId === subscriptionId,
    );
    if (subscription === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Subscription ${subscriptionId} was not found.`,
      };
    }
    return { ok: true, result: { kind: 'subscription', subscription } };
  }

  #cancelSubscription(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const subscriptionId = readString(input.payload, 'subscriptionId');
    if (subscriptionId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subscriptionId is required for cancelSubscription.',
      };
    }
    const index = this.#subscriptions.findIndex(
      (item) => item.tenantId === input.tenantId && item.subscriptionId === subscriptionId,
    );
    if (index < 0) {
      return {
        ok: false,
        error: 'not_found',
        message: `Subscription ${subscriptionId} was not found.`,
      };
    }
    const cancelled: SubscriptionV1 = { ...this.#subscriptions[index]!, status: 'cancelled' };
    this.#subscriptions[index] = cancelled;
    return { ok: true, result: { kind: 'subscription', subscription: cancelled } };
  }

  #listSubscriptions(input: PaymentsBillingExecuteInputV1): readonly SubscriptionV1[] {
    return this.#subscriptions.filter((subscription) => subscription.tenantId === input.tenantId);
  }

  #createInvoice(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const invoice: InvoiceV1 = {
      invoiceId: InvoiceId(`pbinv-${++this.#invoiceSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      invoiceNumber:
        typeof input.payload?.['invoiceNumber'] === 'string'
          ? input.payload['invoiceNumber']
          : `PB-INV-${this.#invoiceSequence}`,
      status: 'draft',
      currencyCode:
        typeof input.payload?.['currencyCode'] === 'string' ? input.payload['currencyCode'] : 'USD',
      totalAmount: readNumber(input.payload, 'totalAmount') ?? 0,
      issuedAtIso: this.#now().toISOString(),
    };
    this.#invoices.push(invoice);
    return { ok: true, result: { kind: 'invoice', invoice } };
  }

  #getInvoice(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const invoiceId = readString(input.payload, 'invoiceId');
    if (invoiceId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'invoiceId is required for getInvoice.',
      };
    }
    const invoice = this.#invoices.find(
      (item) => item.tenantId === input.tenantId && item.invoiceId === invoiceId,
    );
    if (invoice === undefined) {
      return { ok: false, error: 'not_found', message: `Invoice ${invoiceId} was not found.` };
    }
    return { ok: true, result: { kind: 'invoice', invoice } };
  }

  #listInvoices(input: PaymentsBillingExecuteInputV1): readonly InvoiceV1[] {
    return this.#invoices.filter((invoice) => invoice.tenantId === input.tenantId);
  }

  #getPaymentMethod(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const externalId = readString(input.payload, 'externalId');
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'externalId is required for getPaymentMethod.',
      };
    }
    const paymentMethod = this.#paymentMethods.find(
      (method) => method.portFamily === 'PaymentsBilling' && method.externalId === externalId,
    );
    if (paymentMethod === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Payment method ${externalId} was not found.`,
      };
    }
    return { ok: true, result: { kind: 'paymentMethod', paymentMethod } };
  }

  #listPaymentMethods(): readonly ExternalObjectRef[] {
    return this.#paymentMethods.filter((method) => method.portFamily === 'PaymentsBilling');
  }

  #createPayout(input: PaymentsBillingExecuteInputV1): PaymentsBillingExecuteOutputV1 {
    const amount = readNumber(input.payload, 'amount');
    if (amount === null || amount < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'amount must be a non-negative number for createPayout.',
      };
    }

    const payout: PaymentV1 = {
      paymentId: PaymentId(`payout-${++this.#paymentSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      amount,
      currencyCode:
        typeof input.payload?.['currencyCode'] === 'string' ? input.payload['currencyCode'] : 'USD',
      status: 'completed',
      paidAtIso: this.#now().toISOString(),
    };
    this.#charges.push(payout);
    return { ok: true, result: { kind: 'payment', payment: payout } };
  }

  public static seedMinimal(
    tenantId: PaymentsBillingExecuteInputV1['tenantId'],
  ): InMemoryPaymentsBillingAdapterSeed {
    return {
      charges: [
        {
          paymentId: PaymentId('pay-1000'),
          tenantId,
          schemaVersion: 1,
          amount: 100,
          currencyCode: 'USD',
          status: 'completed',
          paidAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      subscriptions: [
        {
          subscriptionId: SubscriptionId('sub-1000'),
          tenantId,
          schemaVersion: 1,
          planName: 'Starter',
          status: 'active',
          currencyCode: 'USD',
          recurringAmount: 29,
        },
      ],
      invoices: [
        {
          invoiceId: InvoiceId('pbinv-1000'),
          tenantId,
          schemaVersion: 1,
          invoiceNumber: 'PB-INV-1000',
          status: 'sent',
          currencyCode: 'USD',
          totalAmount: 100,
          issuedAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      paymentMethods: [
        {
          sorName: 'Stripe',
          portFamily: 'PaymentsBilling',
          externalId: 'pm_1000',
          externalType: 'card',
          displayLabel: 'Visa ending 4242',
        },
      ],
      balance: {
        accountId: FinancialAccountId('bal-1000'),
        tenantId,
        schemaVersion: 1,
        accountName: 'Platform Balance',
        accountCode: 'BAL-1000',
        accountType: 'asset',
        currencyCode: 'USD',
        isActive: true,
      },
    };
  }
}

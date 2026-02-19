import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryPaymentsBillingAdapter } from './in-memory-payments-billing-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryPaymentsBillingAdapter integration', () => {
  it('supports charge create/get/refund/list flow', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: InMemoryPaymentsBillingAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createCharge',
      payload: { amount: 199, currencyCode: 'USD' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'payment') return;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getCharge',
      payload: { paymentId: created.result.payment.paymentId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'payment') return;
    expect(fetched.result.payment.amount).toBe(199);

    const refunded = await adapter.execute({
      tenantId: TENANT,
      operation: 'refundCharge',
      payload: { paymentId: created.result.payment.paymentId },
    });
    expect(refunded.ok).toBe(true);
    if (!refunded.ok || refunded.result.kind !== 'payment') return;
    expect(refunded.result.payment.status).toBe('refunded');
    const createdPaymentId = created.result.payment.paymentId;

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listCharges' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'payments') return;
    expect(listed.result.payments.some((p) => p.paymentId === createdPaymentId)).toBe(true);
  });

  it('supports subscription create/get/cancel/list flow', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: InMemoryPaymentsBillingAdapter.seedMinimal(TENANT),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createSubscription',
      payload: { planName: 'Growth', recurringAmount: 79 },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'subscription') return;
    const createdSubscriptionId = created.result.subscription.subscriptionId;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getSubscription',
      payload: { subscriptionId: createdSubscriptionId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'subscription') return;
    expect(fetched.result.subscription.planName).toBe('Growth');

    const cancelled = await adapter.execute({
      tenantId: TENANT,
      operation: 'cancelSubscription',
      payload: { subscriptionId: createdSubscriptionId },
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok || cancelled.result.kind !== 'subscription') return;
    expect(cancelled.result.subscription.status).toBe('cancelled');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listSubscriptions' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'subscriptions') return;
    expect(
      listed.result.subscriptions.some(
        (sub) => sub.subscriptionId === createdSubscriptionId,
      ),
    ).toBe(true);
  });

  it('supports invoice create/get/list and balance retrieval', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: InMemoryPaymentsBillingAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createInvoice',
      payload: { invoiceNumber: 'PB-IT-1', totalAmount: 500, currencyCode: 'USD' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'invoice') return;
    const createdInvoiceId = created.result.invoice.invoiceId;

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getInvoice',
      payload: { invoiceId: createdInvoiceId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'invoice') return;
    expect(fetched.result.invoice.invoiceNumber).toBe('PB-IT-1');

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listInvoices' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'invoices') return;
    expect(listed.result.invoices.some((inv) => inv.invoiceId === createdInvoiceId)).toBe(true);

    const balance = await adapter.execute({ tenantId: TENANT, operation: 'getBalance' });
    expect(balance.ok).toBe(true);
    if (!balance.ok || balance.result.kind !== 'account') return;
    expect(balance.result.account.accountName).toBe('Platform Balance');
  });

  it('supports payment method get/list and payout create', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: InMemoryPaymentsBillingAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const methods = await adapter.execute({ tenantId: TENANT, operation: 'listPaymentMethods' });
    expect(methods.ok).toBe(true);
    if (!methods.ok || methods.result.kind !== 'paymentMethods') return;
    expect(methods.result.paymentMethods).toHaveLength(1);

    const method = methods.result.paymentMethods[0]!;
    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getPaymentMethod',
      payload: { externalId: method.externalId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'paymentMethod') return;
    expect(fetched.result.paymentMethod.externalId).toBe(method.externalId);

    const payout = await adapter.execute({
      tenantId: TENANT,
      operation: 'createPayout',
      payload: { amount: 77, currencyCode: 'USD' },
    });
    expect(payout.ok).toBe(true);
    if (!payout.ok || payout.result.kind !== 'payment') return;
    expect(payout.result.payment.amount).toBe(77);
  });
});

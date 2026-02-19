import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryPaymentsBillingAdapter } from './in-memory-payments-billing-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryPaymentsBillingAdapter', () => {
  it('returns tenant-scoped charges for listCharges', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: {
        ...InMemoryPaymentsBillingAdapter.seedMinimal(TENANT_A),
        charges: [
          ...InMemoryPaymentsBillingAdapter.seedMinimal(TENANT_A).charges!,
          ...InMemoryPaymentsBillingAdapter.seedMinimal(TENANT_B).charges!,
        ],
      },
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'listCharges' });
    expect(result.ok).toBe(true);
    if (!result.ok || result.result.kind !== 'payments') return;
    expect(result.result.payments).toHaveLength(1);
    expect(result.result.payments[0]?.tenantId).toBe(TENANT_A);
  });

  it('returns validation_error when createCharge is missing amount', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: InMemoryPaymentsBillingAdapter.seedMinimal(TENANT_A),
    });
    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'createCharge' });
    expect(result).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'amount must be a non-negative number for createCharge.',
    });
  });

  it('creates and refunds charges in memory', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: InMemoryPaymentsBillingAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createCharge',
      payload: { amount: 250, currencyCode: 'USD' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'payment') return;

    const refunded = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'refundCharge',
      payload: { paymentId: created.result.payment.paymentId },
    });
    expect(refunded.ok).toBe(true);
    if (!refunded.ok || refunded.result.kind !== 'payment') return;
    expect(refunded.result.payment.status).toBe('refunded');
  });

  it('creates and cancels subscriptions', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: InMemoryPaymentsBillingAdapter.seedMinimal(TENANT_A),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createSubscription',
      payload: { planName: 'Pro', recurringAmount: 99 },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'subscription') return;

    const cancelled = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'cancelSubscription',
      payload: { subscriptionId: created.result.subscription.subscriptionId },
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok || cancelled.result.kind !== 'subscription') return;
    expect(cancelled.result.subscription.status).toBe('cancelled');
  });

  it('reads payment methods and balance', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter({
      seed: InMemoryPaymentsBillingAdapter.seedMinimal(TENANT_A),
    });

    const methods = await adapter.execute({ tenantId: TENANT_A, operation: 'listPaymentMethods' });
    expect(methods.ok).toBe(true);
    if (!methods.ok || methods.result.kind !== 'paymentMethods') return;
    expect(methods.result.paymentMethods).toHaveLength(1);

    const balance = await adapter.execute({ tenantId: TENANT_A, operation: 'getBalance' });
    expect(balance.ok).toBe(true);
    if (!balance.ok || balance.result.kind !== 'account') return;
    expect(balance.result.account.accountName).toBe('Platform Balance');
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryPaymentsBillingAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listCharges',
    });

    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported PaymentsBilling operation: bogusOperation.',
    });
  });
});

import { describe, expect, it } from 'vitest';

import { PaymentParseError, parsePaymentV1 } from './payment-v1.js';

describe('parsePaymentV1', () => {
  const valid = {
    paymentId: 'pay-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    amount: 250.0,
    currencyCode: 'USD',
    status: 'completed',
    paidAtIso: '2026-02-17T12:00:00.000Z',
    externalRefs: [
      {
        sorName: 'stripe',
        portFamily: 'PaymentsBilling',
        externalId: 'pi_abc',
        externalType: 'PaymentIntent',
      },
    ],
  };

  it('parses a full PaymentV1 with all fields', () => {
    const payment = parsePaymentV1(valid);
    expect(payment.paymentId).toBe('pay-1');
    expect(payment.amount).toBe(250.0);
    expect(payment.status).toBe('completed');
    expect(payment.paidAtIso).toBe('2026-02-17T12:00:00.000Z');
    expect(payment.externalRefs).toHaveLength(1);
  });

  it('parses a minimal PaymentV1 (required fields only)', () => {
    const payment = parsePaymentV1({
      paymentId: 'pay-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      amount: 0,
      currencyCode: 'GBP',
      status: 'pending',
    });
    expect(payment.paymentId).toBe('pay-2');
    expect(payment.paidAtIso).toBeUndefined();
    expect(payment.externalRefs).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parsePaymentV1('nope')).toThrow(PaymentParseError);
    expect(() => parsePaymentV1(null)).toThrow(PaymentParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parsePaymentV1({ ...valid, paymentId: '' })).toThrow(/paymentId/);
  });

  it('rejects invalid status', () => {
    expect(() => parsePaymentV1({ ...valid, status: 'cancelled' })).toThrow(/status/);
  });

  it('rejects negative amount', () => {
    expect(() => parsePaymentV1({ ...valid, amount: -10 })).toThrow(/amount/);
  });

  it('rejects invalid currency code', () => {
    expect(() => parsePaymentV1({ ...valid, currencyCode: 'xx' })).toThrow(/currencyCode/);
  });
});

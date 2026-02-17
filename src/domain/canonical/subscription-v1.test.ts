import { describe, expect, it } from 'vitest';

import { SubscriptionParseError, parseSubscriptionV1 } from './subscription-v1.js';

describe('parseSubscriptionV1', () => {
  const valid = {
    subscriptionId: 'sub-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    planName: 'Pro Monthly',
    status: 'active',
    currencyCode: 'USD',
    recurringAmount: 49.99,
    currentPeriodStartIso: '2026-02-01T00:00:00.000Z',
    currentPeriodEndIso: '2026-03-01T00:00:00.000Z',
    externalRefs: [
      {
        sorName: 'stripe',
        portFamily: 'PaymentsBilling',
        externalId: 'sub_stripe_1',
        externalType: 'Subscription',
      },
    ],
  };

  it('parses a full SubscriptionV1 with all fields', () => {
    const sub = parseSubscriptionV1(valid);
    expect(sub.subscriptionId).toBe('sub-1');
    expect(sub.planName).toBe('Pro Monthly');
    expect(sub.status).toBe('active');
    expect(sub.currencyCode).toBe('USD');
    expect(sub.recurringAmount).toBe(49.99);
    expect(sub.currentPeriodStartIso).toBe('2026-02-01T00:00:00.000Z');
    expect(sub.currentPeriodEndIso).toBe('2026-03-01T00:00:00.000Z');
    expect(sub.externalRefs).toHaveLength(1);
  });

  it('parses a minimal SubscriptionV1 (required fields only)', () => {
    const sub = parseSubscriptionV1({
      subscriptionId: 'sub-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      planName: 'Free',
      status: 'trialing',
    });
    expect(sub.subscriptionId).toBe('sub-2');
    expect(sub.currencyCode).toBeUndefined();
    expect(sub.recurringAmount).toBeUndefined();
    expect(sub.currentPeriodStartIso).toBeUndefined();
    expect(sub.currentPeriodEndIso).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseSubscriptionV1('nope')).toThrow(SubscriptionParseError);
    expect(() => parseSubscriptionV1(null)).toThrow(SubscriptionParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseSubscriptionV1({ ...valid, planName: '' })).toThrow(/planName/);
  });

  it('rejects invalid status', () => {
    expect(() => parseSubscriptionV1({ ...valid, status: 'suspended' })).toThrow(/status/);
  });

  it('rejects negative recurringAmount', () => {
    expect(() => parseSubscriptionV1({ ...valid, recurringAmount: -5 })).toThrow(/recurringAmount/);
  });

  it('rejects invalid currencyCode', () => {
    expect(() => parseSubscriptionV1({ ...valid, currencyCode: 'usd' })).toThrow(/currencyCode/);
  });
});

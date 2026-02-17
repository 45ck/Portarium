import { describe, expect, it } from 'vitest';

import { OrderParseError, parseOrderV1 } from './order-v1.js';

describe('parseOrderV1', () => {
  const valid = {
    orderId: 'ord-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    orderNumber: 'ORD-2026-001',
    status: 'confirmed',
    totalAmount: 199.99,
    currencyCode: 'USD',
    lineItemCount: 3,
    createdAtIso: '2026-02-17T10:00:00.000Z',
    externalRefs: [
      {
        sorName: 'shopify',
        portFamily: 'PaymentsBilling',
        externalId: 'shop-ord-1',
        externalType: 'Order',
      },
    ],
  };

  it('parses a full OrderV1 with all fields', () => {
    const order = parseOrderV1(valid);
    expect(order.orderId).toBe('ord-1');
    expect(order.orderNumber).toBe('ORD-2026-001');
    expect(order.status).toBe('confirmed');
    expect(order.totalAmount).toBe(199.99);
    expect(order.currencyCode).toBe('USD');
    expect(order.lineItemCount).toBe(3);
    expect(order.externalRefs).toHaveLength(1);
  });

  it('parses a minimal OrderV1 (required fields only)', () => {
    const order = parseOrderV1({
      orderId: 'ord-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      orderNumber: 'ORD-002',
      status: 'draft',
      totalAmount: 0,
      currencyCode: 'EUR',
      createdAtIso: '2026-01-01T00:00:00.000Z',
    });
    expect(order.orderId).toBe('ord-2');
    expect(order.lineItemCount).toBeUndefined();
    expect(order.externalRefs).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseOrderV1('nope')).toThrow(OrderParseError);
    expect(() => parseOrderV1(null)).toThrow(OrderParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseOrderV1({ ...valid, orderNumber: '' })).toThrow(/orderNumber/);
  });

  it('rejects invalid status', () => {
    expect(() => parseOrderV1({ ...valid, status: 'shipped' })).toThrow(/status/);
  });

  it('rejects negative totalAmount', () => {
    expect(() => parseOrderV1({ ...valid, totalAmount: -1 })).toThrow(/totalAmount/);
  });

  it('rejects non-integer lineItemCount', () => {
    expect(() => parseOrderV1({ ...valid, lineItemCount: 2.5 })).toThrow(/lineItemCount/);
  });

  it('rejects negative lineItemCount', () => {
    expect(() => parseOrderV1({ ...valid, lineItemCount: -1 })).toThrow(/lineItemCount/);
  });
});

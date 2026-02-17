import { describe, expect, it } from 'vitest';

import { ProductParseError, parseProductV1 } from './product-v1.js';

describe('parseProductV1', () => {
  const valid = {
    productId: 'prod-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    name: 'Widget Pro',
    sku: 'WGT-PRO-001',
    active: true,
    unitPrice: 29.99,
    currencyCode: 'USD',
    externalRefs: [
      {
        sorName: 'shopify',
        portFamily: 'PaymentsBilling',
        externalId: 'shop-prod-1',
        externalType: 'Product',
      },
    ],
  };

  it('parses a full ProductV1 with all fields', () => {
    const product = parseProductV1(valid);
    expect(product.productId).toBe('prod-1');
    expect(product.name).toBe('Widget Pro');
    expect(product.sku).toBe('WGT-PRO-001');
    expect(product.active).toBe(true);
    expect(product.unitPrice).toBe(29.99);
    expect(product.currencyCode).toBe('USD');
    expect(product.externalRefs).toHaveLength(1);
  });

  it('parses a minimal ProductV1 (required fields only)', () => {
    const product = parseProductV1({
      productId: 'prod-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      name: 'Basic Widget',
      active: false,
    });
    expect(product.productId).toBe('prod-2');
    expect(product.sku).toBeUndefined();
    expect(product.unitPrice).toBeUndefined();
    expect(product.currencyCode).toBeUndefined();
    expect(product.externalRefs).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseProductV1('nope')).toThrow(ProductParseError);
    expect(() => parseProductV1(null)).toThrow(ProductParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseProductV1({ ...valid, name: '' })).toThrow(/name/);
  });

  it('rejects non-boolean active', () => {
    expect(() => parseProductV1({ ...valid, active: 'yes' })).toThrow(/active/);
  });

  it('rejects negative unitPrice', () => {
    expect(() => parseProductV1({ ...valid, unitPrice: -5 })).toThrow(/unitPrice/);
  });
});

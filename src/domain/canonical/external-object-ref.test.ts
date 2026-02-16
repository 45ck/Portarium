import { describe, expect, it } from 'vitest';

import { ExternalObjectRefParseError, parseExternalObjectRef } from './external-object-ref.js';

describe('ExternalObjectRef', () => {
  it('parses a minimal ExternalObjectRef', () => {
    const ref = parseExternalObjectRef({
      sorName: 'stripe',
      portFamily: 'PaymentsBilling',
      externalId: 'cus_123',
      externalType: 'Customer',
    });

    expect(ref).toEqual({
      sorName: 'stripe',
      portFamily: 'PaymentsBilling',
      externalId: 'cus_123',
      externalType: 'Customer',
    });
  });

  it('parses optional fields when provided', () => {
    const ref = parseExternalObjectRef({
      sorName: 'stripe',
      portFamily: 'PaymentsBilling',
      externalId: 'cus_123',
      externalType: 'Customer',
      displayLabel: 'ACME Corp',
      deepLinkUrl: 'https://dashboard.stripe.com/customers/cus_123',
    });

    expect(ref.displayLabel).toBe('ACME Corp');
    expect(ref.deepLinkUrl).toBe('https://dashboard.stripe.com/customers/cus_123');
  });

  it('rejects non-object inputs', () => {
    expect(() => parseExternalObjectRef('nope')).toThrow(ExternalObjectRefParseError);
    expect(() => parseExternalObjectRef([])).toThrow(ExternalObjectRefParseError);
  });

  it('rejects invalid portFamily values', () => {
    expect(() =>
      parseExternalObjectRef({
        sorName: 'stripe',
        portFamily: 'NotARealPortFamily',
        externalId: 'x',
        externalType: 'Thing',
      }),
    ).toThrow(/portFamily/i);
  });

  it('rejects missing/invalid required string fields', () => {
    expect(() =>
      parseExternalObjectRef({
        sorName: '   ',
        portFamily: 'PaymentsBilling',
        externalId: 'x',
        externalType: 'Thing',
      }),
    ).toThrow(/sorName/i);

    expect(() =>
      parseExternalObjectRef({
        sorName: 123,
        portFamily: 'PaymentsBilling',
        externalId: 'x',
        externalType: 'Thing',
      }),
    ).toThrow(/sorName/i);
  });

  it('rejects invalid optional string fields when provided', () => {
    expect(() =>
      parseExternalObjectRef({
        sorName: 'stripe',
        portFamily: 'PaymentsBilling',
        externalId: 'cus_123',
        externalType: 'Customer',
        displayLabel: '   ',
      }),
    ).toThrow(/displayLabel/i);

    expect(() =>
      parseExternalObjectRef({
        sorName: 'stripe',
        portFamily: 'PaymentsBilling',
        externalId: 'cus_123',
        externalType: 'Customer',
        deepLinkUrl: '',
      }),
    ).toThrow(/deepLinkUrl/i);
  });

  it('rejects invalid required string fields beyond sorName', () => {
    expect(() =>
      parseExternalObjectRef({
        sorName: 'stripe',
        portFamily: 'PaymentsBilling',
        externalId: '   ',
        externalType: 'Customer',
      }),
    ).toThrow(/externalId/i);
  });
});

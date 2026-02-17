import { describe, expect, it } from 'vitest';

import { InvoiceParseError, parseInvoiceV1 } from './invoice-v1.js';

describe('parseInvoiceV1', () => {
  const valid = {
    invoiceId: 'inv-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    invoiceNumber: 'INV-2026-001',
    status: 'sent',
    currencyCode: 'USD',
    totalAmount: 1500.5,
    issuedAtIso: '2026-02-17T00:00:00.000Z',
    dueDateIso: '2026-03-17T00:00:00.000Z',
    externalRefs: [
      {
        sorName: 'quickbooks',
        portFamily: 'FinanceAccounting',
        externalId: 'qb-inv-1',
        externalType: 'Invoice',
      },
    ],
  };

  it('parses a full InvoiceV1 with all fields', () => {
    const invoice = parseInvoiceV1(valid);
    expect(invoice.invoiceId).toBe('inv-1');
    expect(invoice.status).toBe('sent');
    expect(invoice.currencyCode).toBe('USD');
    expect(invoice.totalAmount).toBe(1500.5);
    expect(invoice.dueDateIso).toBe('2026-03-17T00:00:00.000Z');
    expect(invoice.externalRefs).toHaveLength(1);
  });

  it('parses a minimal InvoiceV1 (required fields only)', () => {
    const invoice = parseInvoiceV1({
      invoiceId: 'inv-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      invoiceNumber: 'INV-002',
      status: 'draft',
      currencyCode: 'EUR',
      totalAmount: 0,
      issuedAtIso: '2026-01-01T00:00:00.000Z',
    });
    expect(invoice.invoiceId).toBe('inv-2');
    expect(invoice.dueDateIso).toBeUndefined();
    expect(invoice.externalRefs).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => parseInvoiceV1('nope')).toThrow(InvoiceParseError);
    expect(() => parseInvoiceV1(null)).toThrow(InvoiceParseError);
  });

  it('rejects missing required string fields', () => {
    expect(() => parseInvoiceV1({ ...valid, invoiceNumber: '' })).toThrow(/invoiceNumber/);
  });

  it('rejects invalid status', () => {
    expect(() => parseInvoiceV1({ ...valid, status: 'unpaid' })).toThrow(/status/);
  });

  it('rejects invalid currency code', () => {
    expect(() => parseInvoiceV1({ ...valid, currencyCode: 'us' })).toThrow(/currencyCode/);
    expect(() => parseInvoiceV1({ ...valid, currencyCode: 'usd' })).toThrow(/currencyCode/);
  });

  it('rejects negative totalAmount', () => {
    expect(() => parseInvoiceV1({ ...valid, totalAmount: -1 })).toThrow(/totalAmount/);
  });
});

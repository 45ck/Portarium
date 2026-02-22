/**
 * Unit tests for odoo-mappers.ts pure helper functions.
 * Covers fallback branches not exercised through the adapter integration tests.
 * Bead: bead-0422
 */

import { describe, expect, it } from 'vitest';
import {
  extractCurrencyCode,
  mapOdooAccount,
  mapOdooInvoice,
  mapOdooPartner,
  resolveInvoiceStatus,
} from './odoo-mappers.js';

describe('extractCurrencyCode', () => {
  it('returns currency code from array format', () => {
    expect(extractCurrencyCode([1, 'EUR'])).toBe('EUR');
  });

  it('falls back to USD when input is not an array', () => {
    expect(extractCurrencyCode(false)).toBe('USD');
    expect(extractCurrencyCode(null)).toBe('USD');
    expect(extractCurrencyCode('USD')).toBe('USD');
  });

  it('falls back to USD when array second element is not a string', () => {
    expect(extractCurrencyCode([1, 2])).toBe('USD');
  });
});

describe('resolveInvoiceStatus', () => {
  it('returns paid when odooState is paid', () => {
    expect(resolveInvoiceStatus('paid', 'posted')).toBe('paid');
  });

  it('returns paid when odooState is in_payment', () => {
    expect(resolveInvoiceStatus('in_payment', 'posted')).toBe('paid');
  });

  it('maps posted recState to sent', () => {
    expect(resolveInvoiceStatus('open', 'posted')).toBe('sent');
  });

  it('defaults to draft for unknown states', () => {
    expect(resolveInvoiceStatus('unknown', 'unknown')).toBe('draft');
  });
});

describe('mapOdooAccount', () => {
  it('falls back to empty string when name absent', () => {
    const account = mapOdooAccount({ id: 1 }, 'tenant-1');
    expect(account.accountName).toBe('');
  });

  it('falls back to empty string when code absent', () => {
    const account = mapOdooAccount({ id: 1 }, 'tenant-1');
    expect(account.accountCode).toBe('');
  });

  it('falls back to asset account type for unknown type', () => {
    const account = mapOdooAccount({ id: 1, account_type: 'unknown_type' }, 'tenant-1');
    expect(account.accountType).toBe('asset');
  });

  it('falls back to USD when currency_id absent', () => {
    const account = mapOdooAccount({ id: 1 }, 'tenant-1');
    expect(account.currencyCode).toBe('USD');
  });

  it('defaults isActive to true when active absent', () => {
    const account = mapOdooAccount({ id: 1 }, 'tenant-1');
    expect(account.isActive).toBe(true);
  });
});

describe('mapOdooInvoice', () => {
  it('resolves paid status when payment_state is paid', () => {
    const invoice = mapOdooInvoice({ id: 1, payment_state: 'paid', state: 'posted' }, 'tenant-1');
    expect(invoice.status).toBe('paid');
  });

  it('falls back to date when invoice_date absent', () => {
    const invoice = mapOdooInvoice({ id: 1, date: '2024-01-01' }, 'tenant-1');
    expect(invoice.issuedAtIso).toBe('2024-01-01');
  });

  it('generates invoice number from id when name absent', () => {
    const invoice = mapOdooInvoice({ id: 42 }, 'tenant-1');
    expect(invoice.invoiceNumber).toBe('INV-42');
  });

  it('includes dueDateIso when invoice_date_due is a string', () => {
    const invoice = mapOdooInvoice(
      { id: 1, invoice_date_due: '2024-02-01', invoice_date: '2024-01-01' },
      'tenant-1',
    );
    expect(invoice.dueDateIso).toBe('2024-02-01');
  });

  it('omits dueDateIso when invoice_date_due is not a string', () => {
    const invoice = mapOdooInvoice({ id: 1 }, 'tenant-1');
    expect('dueDateIso' in invoice).toBe(false);
  });
});

describe('mapOdooPartner', () => {
  it('falls back to empty displayName when name absent', () => {
    const partner = mapOdooPartner({ id: 1 }, 'tenant-1');
    expect(partner.displayName).toBe('');
  });

  it('includes email when present', () => {
    const partner = mapOdooPartner({ id: 1, email: 'a@b.com' }, 'tenant-1');
    expect(partner.email).toBe('a@b.com');
  });

  it('omits email when not a string', () => {
    const partner = mapOdooPartner({ id: 1 }, 'tenant-1');
    expect('email' in partner).toBe(false);
  });

  it('includes phone when present', () => {
    const partner = mapOdooPartner({ id: 1, phone: '+1-555-0100' }, 'tenant-1');
    expect(partner.phone).toBe('+1-555-0100');
  });

  it('omits phone when not a string', () => {
    const partner = mapOdooPartner({ id: 1 }, 'tenant-1');
    expect('phone' in partner).toBe(false);
  });
});

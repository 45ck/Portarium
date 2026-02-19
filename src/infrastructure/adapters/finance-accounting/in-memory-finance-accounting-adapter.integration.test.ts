import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryFinanceAccountingAdapter } from './in-memory-finance-accounting-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryFinanceAccountingAdapter integration', () => {
  it('supports create/list/get invoice flow for a tenant', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter({
      seed: InMemoryFinanceAccountingAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createInvoice',
      payload: { invoiceNumber: 'INV-IT-1', totalAmount: 950, currencyCode: 'USD' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'invoice') return;
    const createdInvoiceId = created.result.invoice.invoiceId;

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listInvoices' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'invoices') return;
    expect(listed.result.invoices.some((invoice) => invoice.invoiceId === createdInvoiceId)).toBe(true);

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getInvoice',
      payload: { invoiceId: createdInvoiceId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'invoice') return;
    expect(fetched.result.invoice.invoiceNumber).toBe('INV-IT-1');
  });

  it('supports create/list/get bill flow for a tenant', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter({
      seed: InMemoryFinanceAccountingAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT,
      operation: 'createBill',
      payload: { invoiceNumber: 'BILL-IT-1', totalAmount: 1200, currencyCode: 'USD' },
    });
    expect(created.ok).toBe(true);
    if (!created.ok || created.result.kind !== 'invoice') return;
    const createdBillId = created.result.invoice.invoiceId;

    const listed = await adapter.execute({ tenantId: TENANT, operation: 'listBills' });
    expect(listed.ok).toBe(true);
    if (!listed.ok || listed.result.kind !== 'invoices') return;
    expect(listed.result.invoices.some((invoice) => invoice.invoiceId === createdBillId)).toBe(true);

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getBill',
      payload: { invoiceId: createdBillId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'invoice') return;
    expect(fetched.result.invoice.invoiceNumber).toBe('BILL-IT-1');
  });

  it('returns seeded vendor objects through list/get vendor operations', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter({
      seed: InMemoryFinanceAccountingAdapter.seedMinimal(TENANT),
    });

    const vendors = await adapter.execute({ tenantId: TENANT, operation: 'listVendors' });
    expect(vendors.ok).toBe(true);
    if (!vendors.ok || vendors.result.kind !== 'vendors') return;
    expect(vendors.result.vendors).toHaveLength(1);

    const fetched = await adapter.execute({
      tenantId: TENANT,
      operation: 'getVendor',
      payload: { partyId: vendors.result.vendors[0]!.partyId },
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok || fetched.result.kind !== 'vendor') return;
    expect(fetched.result.vendor.roles).toContain('vendor');
  });

  it('returns opaque result payloads for report and reconciliation operations', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter();
    const operations = [
      'listJournalEntries',
      'getTrialBalance',
      'reconcileAccount',
      'getBalanceSheet',
      'getProfitAndLoss',
    ] as const;

    for (const operation of operations) {
      const result = await adapter.execute({ tenantId: TENANT, operation });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'opaque') continue;
      expect(result.result.payload).toMatchObject({ operation, tenantId: TENANT, status: 'stubbed' });
    }
  });
});

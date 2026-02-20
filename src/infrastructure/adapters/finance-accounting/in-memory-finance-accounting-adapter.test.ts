import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryFinanceAccountingAdapter } from './in-memory-finance-accounting-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryFinanceAccountingAdapter', () => {
  it('returns tenant-scoped accounts for listAccounts', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter({
      seed: {
        ...InMemoryFinanceAccountingAdapter.seedMinimal(TENANT_A),
        accounts: [
          ...InMemoryFinanceAccountingAdapter.seedMinimal(TENANT_A).accounts!,
          ...InMemoryFinanceAccountingAdapter.seedMinimal(TENANT_B).accounts!,
        ],
      },
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'listAccounts' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('accounts');
    if (result.result.kind !== 'accounts') return;
    expect(result.result.accounts).toHaveLength(1);
    expect(result.result.accounts[0]?.tenantId).toBe(TENANT_A);
  });

  it('returns validation_error when getAccount misses accountId', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter({
      seed: InMemoryFinanceAccountingAdapter.seedMinimal(TENANT_A),
    });

    const result = await adapter.execute({ tenantId: TENANT_A, operation: 'getAccount' });
    expect(result).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'accountId is required for getAccount.',
    });
  });

  it('creates and persists invoices in memory', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter({
      seed: InMemoryFinanceAccountingAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const created = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createInvoice',
      payload: {
        invoiceNumber: 'INV-2000',
        totalAmount: 1200,
        currencyCode: 'USD',
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.result.kind).toBe('invoice');

    const listed = await adapter.execute({ tenantId: TENANT_A, operation: 'listInvoices' });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.result.kind).toBe('invoices');
    if (listed.result.kind !== 'invoices') return;
    expect(listed.result.invoices).toHaveLength(2);
    expect(listed.result.invoices.some((invoice) => invoice.invoiceNumber === 'INV-2000')).toBe(
      true,
    );
  });

  it('returns vendor not_found when missing', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter({
      seed: InMemoryFinanceAccountingAdapter.seedMinimal(TENANT_A),
    });

    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getVendor',
      payload: { partyId: 'vendor-missing' },
    });
    expect(result).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Vendor vendor-missing was not found.',
    });
  });

  it('returns accepted result for createJournalEntry', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter({
      seed: InMemoryFinanceAccountingAdapter.seedMinimal(TENANT_A),
    });

    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createJournalEntry',
      payload: { memo: 'accrual' },
    });
    expect(result).toEqual({
      ok: true,
      result: { kind: 'accepted', operation: 'createJournalEntry' },
    });
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryFinanceAccountingAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listAccounts',
    });

    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported FinanceAccounting operation: bogusOperation.',
    });
  });
});

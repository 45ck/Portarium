/**
 * Integration tests for the Odoo FinanceAccounting adapter.
 *
 * Level 1 — recorded-fixture tests: mocked fetch responses matching real Odoo
 *   JSON-RPC 2.0 wire shapes. Exercises complete GL / AR / AP flows without a
 *   live server.
 *
 * Level 2 — round-trip tests against a local Odoo container (Odoo 17 on
 *   port 4000). Skipped unless ODOO_INTEGRATION=true is set in the environment.
 *   Start the container first:
 *     npm run dev:all && npm run dev:seed:odoo
 *
 * Bead: bead-0823
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OdooFinanceAccountingAdapter,
  type OdooAdapterConfig,
} from './odoo-finance-accounting-adapter.js';
import type { FinanceAccountingExecuteInputV1 } from '../../../application/ports/finance-accounting-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';

// ── Shared constants ──────────────────────────────────────────────────────────

const TENANT = TenantId('tenant-integration-test');

const FIXTURE_CONFIG: OdooAdapterConfig = {
  baseUrl: 'https://odoo.fixture.test',
  database: 'portarium',
  username: 'admin@portarium.dev',
  apiKey: 'fixture-api-key',
};

// ── Fixture builders ──────────────────────────────────────────────────────────

/** Build a realistic Odoo JSON-RPC 2.0 success envelope. */
function rpcOk(result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, result });
}

/** Sequence of recorded responses (first call is always session/authenticate). */
type CallSequence = unknown[];

/**
 * Build a fetch mock from a sequence of Odoo response payloads.
 * Call 0: `/web/session/authenticate` → `{ uid: 7 }` (always injected first).
 * Calls 1+: taken from `dataResponses` in order.
 */
function recordedFetch(dataResponses: CallSequence) {
  const queue = [{ uid: 7 }, ...dataResponses];
  let idx = 0;
  return vi.fn(async (_url: string, _init: RequestInit) => {
    const payload = queue[idx++] ?? null;
    return new Response(rpcOk(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function makeInput(
  operation: FinanceAccountingExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): FinanceAccountingExecuteInputV1 {
  return { tenantId: TENANT, operation, ...(payload !== undefined ? { payload } : {}) };
}

// ── Odoo 17 realistic fixture records ─────────────────────────────────────────

const FIXTURE_ACCOUNTS = [
  {
    id: 101,
    name: 'Cash',
    code: '101000',
    account_type: 'asset_cash',
    currency_id: [1, 'USD'],
    active: true,
  },
  {
    id: 201,
    name: 'Accounts Receivable',
    code: '130000',
    account_type: 'asset_receivable',
    currency_id: false,
    active: true,
  },
  {
    id: 301,
    name: 'Accounts Payable',
    code: '210000',
    account_type: 'liability_payable',
    currency_id: false,
    active: true,
  },
  {
    id: 401,
    name: 'Revenue',
    code: '400000',
    account_type: 'income',
    currency_id: false,
    active: true,
  },
  {
    id: 501,
    name: 'Operating Expenses',
    code: '600000',
    account_type: 'expense',
    currency_id: false,
    active: true,
  },
];

const FIXTURE_INVOICES = [
  {
    id: 10,
    name: 'INV/2025/00001',
    state: 'posted',
    payment_state: 'paid',
    currency_id: [1, 'USD'],
    amount_total: 1500.0,
    invoice_date: '2025-01-15',
    invoice_date_due: '2025-02-15',
  },
  {
    id: 11,
    name: 'INV/2025/00002',
    state: 'posted',
    payment_state: 'not_paid',
    currency_id: [2, 'EUR'],
    amount_total: 750.0,
    invoice_date: '2025-02-01',
    invoice_date_due: '2025-03-01',
  },
  {
    id: 12,
    name: 'INV/2025/00003',
    state: 'draft',
    payment_state: 'not_paid',
    currency_id: [1, 'USD'],
    amount_total: 320.0,
    invoice_date: '2025-02-10',
    invoice_date_due: null,
  },
];

const FIXTURE_BILLS = [
  {
    id: 20,
    name: 'BILL/2025/00001',
    state: 'posted',
    payment_state: 'not_paid',
    currency_id: [1, 'USD'],
    amount_total: 200.0,
    invoice_date: '2025-01-20',
    invoice_date_due: '2025-02-20',
  },
  {
    id: 21,
    name: 'BILL/2025/00002',
    state: 'posted',
    payment_state: 'paid',
    currency_id: [1, 'USD'],
    amount_total: 450.0,
    invoice_date: '2025-02-05',
    invoice_date_due: '2025-03-05',
  },
];

const FIXTURE_VENDORS = [
  {
    id: 30,
    name: 'Acme Supplies Ltd',
    email: 'billing@acme.example',
    phone: '+1-555-0100',
  },
  {
    id: 31,
    name: 'Beta Materials Inc',
    email: null,
    phone: '+1-555-0200',
  },
];

const FIXTURE_JOURNAL_ENTRIES = [
  {
    id: 50,
    name: 'MISC/2025/00001',
    date: '2025-01-10',
    ref: 'Opening balance',
    state: 'posted',
  },
  {
    id: 51,
    name: 'MISC/2025/00002',
    date: '2025-01-31',
    ref: 'Month-end accrual',
    state: 'posted',
  },
];

// ── Level 1: GL flow ──────────────────────────────────────────────────────────

describe('Level 1 — GL flow (General Ledger, recorded fixtures)', () => {
  it('lists all chart-of-accounts entries', async () => {
    const fetchFn = recordedFetch([FIXTURE_ACCOUNTS]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('listAccounts'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('accounts');
    if (result.result.kind !== 'accounts') return;

    expect(result.result.accounts).toHaveLength(5);
    expect(result.result.accounts[0]).toMatchObject({
      accountId: '101',
      tenantId: TENANT,
      schemaVersion: 1,
      accountName: 'Cash',
      accountCode: '101000',
      accountType: 'asset',
      currencyCode: 'USD',
      isActive: true,
    });
    expect(result.result.accounts[1]?.accountType).toBe('asset');
    expect(result.result.accounts[2]?.accountType).toBe('liability');
    expect(result.result.accounts[3]?.accountType).toBe('revenue');
    expect(result.result.accounts[4]?.accountType).toBe('expense');
  });

  it('fetches a single account by id', async () => {
    const fetchFn = recordedFetch([[FIXTURE_ACCOUNTS[0]]]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getAccount', { accountId: '101' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('account');
    if (result.result.kind !== 'account') return;
    expect(result.result.account.accountId).toBe('101');
    expect(result.result.account.accountName).toBe('Cash');
    expect(result.result.account.accountType).toBe('asset');
  });

  it('returns not_found for unknown account id', async () => {
    const fetchFn = recordedFetch([[]]); // empty search_read result
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getAccount', { accountId: '99999' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });

  it('returns validation_error when accountId is omitted', async () => {
    const fetchFn = recordedFetch([]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getAccount'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
    expect(fetchFn).not.toHaveBeenCalled(); // validation short-circuits before fetch
  });

  it('lists journal entries (search_read on account.move type=entry)', async () => {
    const fetchFn = recordedFetch([FIXTURE_JOURNAL_ENTRIES]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('listJournalEntries'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('opaque');
    if (result.result.kind !== 'opaque') return;

    const entries = result.result.payload['entries'] as unknown[];
    expect(Array.isArray(entries)).toBe(true);
    expect(entries).toHaveLength(2);
  });

  it('creates a journal entry and returns opaque record with id', async () => {
    // Call 0: auth; Call 1: create → returns new id 99
    const fetchFn = recordedFetch([99]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(
      makeInput('createJournalEntry', { date: '2025-03-01', reference: 'Manual adjustment' }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('opaque');
    if (result.result.kind !== 'opaque') return;
    expect(result.result.payload['id']).toBe(99);
    expect(result.result.payload['move_type']).toBe('entry');
    expect(result.result.payload['date']).toBe('2025-03-01');
  });
});

// ── Level 1: AR flow ──────────────────────────────────────────────────────────

describe('Level 1 — AR flow (Accounts Receivable, recorded fixtures)', () => {
  it('lists all AR invoices with correct status mapping', async () => {
    const fetchFn = recordedFetch([FIXTURE_INVOICES]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('listInvoices'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('invoices');
    if (result.result.kind !== 'invoices') return;

    const invoices = result.result.invoices;
    expect(invoices).toHaveLength(3);

    // paid: payment_state=paid overrides state=posted
    expect(invoices[0]).toMatchObject({
      invoiceId: '10',
      tenantId: TENANT,
      schemaVersion: 1,
      invoiceNumber: 'INV/2025/00001',
      status: 'paid',
      currencyCode: 'USD',
      totalAmount: 1500,
      issuedAtIso: '2025-01-15',
      dueDateIso: '2025-02-15',
    });

    // sent: state=posted, payment_state=not_paid → sent
    expect(invoices[1]?.status).toBe('sent');
    expect(invoices[1]?.currencyCode).toBe('EUR');
    expect(invoices[1]?.totalAmount).toBe(750);

    // draft: state=draft
    expect(invoices[2]?.status).toBe('draft');
    expect(invoices[2]?.dueDateIso).toBeUndefined();
  });

  it('fetches a single invoice by id', async () => {
    const fetchFn = recordedFetch([[FIXTURE_INVOICES[0]]]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getInvoice', { invoiceId: '10' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('invoice');
    if (result.result.kind !== 'invoice') return;
    expect(result.result.invoice.invoiceId).toBe('10');
    expect(result.result.invoice.status).toBe('paid');
  });

  it('returns not_found for missing invoice id', async () => {
    const fetchFn = recordedFetch([[]]); // empty
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getInvoice', { invoiceId: '99999' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });

  it('returns validation_error when invoiceId is omitted for getInvoice', async () => {
    const fetchFn = recordedFetch([]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getInvoice'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });

  it('creates an AR invoice and returns draft InvoiceV1 with assigned id', async () => {
    // Call 0: auth; Call 1: create → returns new id 200
    const fetchFn = recordedFetch([200]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(
      makeInput('createInvoice', {
        invoiceNumber: 'INV-INT-001',
        totalAmount: 1200,
        currencyCode: 'USD',
        issuedAtIso: '2025-03-01',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('invoice');
    if (result.result.kind !== 'invoice') return;
    expect(result.result.invoice.invoiceId).toBe('200');
    expect(result.result.invoice.status).toBe('draft');
    expect(result.result.invoice.totalAmount).toBe(1200);
    expect(result.result.invoice.currencyCode).toBe('USD');
    expect(result.result.invoice.issuedAtIso).toBe('2025-03-01');
  });
});

// ── Level 1: AP flow ──────────────────────────────────────────────────────────

describe('Level 1 — AP flow (Accounts Payable, recorded fixtures)', () => {
  it('lists all AP bills with correct status mapping', async () => {
    const fetchFn = recordedFetch([FIXTURE_BILLS]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('listBills'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('invoices');
    if (result.result.kind !== 'invoices') return;

    const bills = result.result.invoices;
    expect(bills).toHaveLength(2);
    expect(bills[0]).toMatchObject({
      invoiceId: '20',
      tenantId: TENANT,
      schemaVersion: 1,
      invoiceNumber: 'BILL/2025/00001',
      status: 'sent', // posted + not_paid → sent
      currencyCode: 'USD',
      totalAmount: 200,
      issuedAtIso: '2025-01-20',
      dueDateIso: '2025-02-20',
    });
    expect(bills[1]?.status).toBe('paid'); // posted + paid
  });

  it('fetches a single bill by billId', async () => {
    const fetchFn = recordedFetch([[FIXTURE_BILLS[0]]]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getBill', { billId: '20' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('invoice');
    if (result.result.kind !== 'invoice') return;
    expect(result.result.invoice.invoiceId).toBe('20');
    expect(result.result.invoice.invoiceNumber).toBe('BILL/2025/00001');
  });

  it('returns not_found for missing bill id', async () => {
    const fetchFn = recordedFetch([[]]); // empty
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getBill', { billId: '99999' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });

  it('creates an AP bill and returns draft InvoiceV1 with assigned id', async () => {
    const fetchFn = recordedFetch([300]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(
      makeInput('createBill', {
        invoiceNumber: 'BILL-INT-001',
        totalAmount: 480,
        currencyCode: 'EUR',
        issuedAtIso: '2025-03-15',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('invoice');
    if (result.result.kind !== 'invoice') return;
    expect(result.result.invoice.invoiceId).toBe('300');
    expect(result.result.invoice.status).toBe('draft');
    expect(result.result.invoice.totalAmount).toBe(480);
    expect(result.result.invoice.currencyCode).toBe('EUR');
  });
});

// ── Level 1: Vendor management ────────────────────────────────────────────────

describe('Level 1 — Vendor management (recorded fixtures)', () => {
  it('lists vendors mapped to PartyV1 with vendor role', async () => {
    const fetchFn = recordedFetch([FIXTURE_VENDORS]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('listVendors'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('vendors');
    if (result.result.kind !== 'vendors') return;

    const vendors = result.result.vendors;
    expect(vendors).toHaveLength(2);
    expect(vendors[0]).toMatchObject({
      partyId: '30',
      tenantId: TENANT,
      schemaVersion: 1,
      displayName: 'Acme Supplies Ltd',
      email: 'billing@acme.example',
      phone: '+1-555-0100',
      roles: ['vendor'],
    });
    // null email/phone are omitted from canonical PartyV1
    expect(vendors[1]?.email).toBeUndefined();
  });

  it('fetches a single vendor by id', async () => {
    const fetchFn = recordedFetch([[FIXTURE_VENDORS[0]]]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getVendor', { vendorId: '30' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('vendor');
    if (result.result.kind !== 'vendor') return;
    expect(result.result.vendor.partyId).toBe('30');
    expect(result.result.vendor.displayName).toBe('Acme Supplies Ltd');
  });

  it('returns not_found for missing vendor id', async () => {
    const fetchFn = recordedFetch([[]]); // empty
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getVendor', { vendorId: '99999' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });

  it('returns validation_error when vendorId is omitted', async () => {
    const fetchFn = recordedFetch([]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getVendor'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation_error');
  });
});

// ── Level 1: Report operations (opaque) ───────────────────────────────────────

describe('Level 1 — Report operations (recorded fixtures)', () => {
  it('getTrialBalance returns opaque report reference without fetching Odoo', async () => {
    const fetchFn = vi.fn();
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getTrialBalance'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('opaque');
    if (result.result.kind !== 'opaque') return;
    expect(result.result.payload['reportType']).toBe('trial_balance');
    expect(String(result.result.payload['viewUrl'])).toContain('trial_balance');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('getBalanceSheet returns opaque report reference', async () => {
    const fetchFn = vi.fn();
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getBalanceSheet'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('opaque');
    if (result.result.kind !== 'opaque') return;
    expect(result.result.payload['reportType']).toBe('balance_sheet');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('getProfitAndLoss returns opaque report reference', async () => {
    const fetchFn = vi.fn();
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('getProfitAndLoss'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('opaque');
    if (result.result.kind !== 'opaque') return;
    expect(result.result.payload['reportType']).toBe('profit_loss');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reconcileAccount returns accepted result', async () => {
    const fetchFn = recordedFetch([null]);
    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);

    const result = await adapter.execute(makeInput('reconcileAccount', { accountId: '101' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.kind).toBe('accepted');
    if (result.result.kind !== 'accepted') return;
    expect(result.result.operation).toBe('reconcileAccount');
  });
});

// ── Level 1: Session caching ──────────────────────────────────────────────────

describe('Level 1 — Session caching (recorded fixtures)', () => {
  it('authenticates only once across multiple consecutive operations', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string, _init: RequestInit) => {
      calls.push(new URL(url).pathname);
      if (url.includes('/web/session/authenticate')) {
        return new Response(rpcOk({ uid: 7 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(rpcOk([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);
    await adapter.execute(makeInput('listAccounts'));
    await adapter.execute(makeInput('listInvoices'));
    await adapter.execute(makeInput('listVendors'));

    const authCalls = calls.filter((p) => p.includes('authenticate'));
    const dataCalls = calls.filter((p) => !p.includes('authenticate'));
    expect(authCalls).toHaveLength(1); // single auth for all three operations
    expect(dataCalls).toHaveLength(3); // one data call each
  });
});

// ── Level 1: Error handling ───────────────────────────────────────────────────

describe('Level 1 — Error handling (recorded fixtures)', () => {
  it('wraps an HTTP 503 as provider_error', async () => {
    let callCount = 0;
    const fetchFn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(rpcOk({ uid: 7 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Service Unavailable', { status: 503 });
    });

    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);
    const result = await adapter.execute(makeInput('listAccounts'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('provider_error');
    expect(result.message).toContain('503');
  });

  it('wraps a JSON-RPC error response as provider_error', async () => {
    let callCount = 0;
    const fetchFn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(rpcOk({ uid: 7 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: {
            message: 'Odoo Session Expired',
            data: { message: 'SessionExpiredError: Login Required' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);
    const result = await adapter.execute(makeInput('listAccounts'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('provider_error');
    expect(result.message).toContain('SessionExpiredError');
  });

  it('wraps a network failure as provider_error', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED connect ECONNREFUSED 127.0.0.1:8069');
    });

    const adapter = new OdooFinanceAccountingAdapter(FIXTURE_CONFIG, fetchFn as typeof fetch);
    const result = await adapter.execute(makeInput('listAccounts'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('provider_error');
    expect(result.message).toContain('ECONNREFUSED');
  });
});

// ── Level 2: Live Odoo container (skipped unless ODOO_INTEGRATION=true) ───────

const RUN_LIVE = process.env['ODOO_INTEGRATION'] === 'true';
const LIVE_CONFIG: OdooAdapterConfig = {
  baseUrl: process.env['ODOO_URL'] ?? 'http://localhost:4000',
  database: process.env['ODOO_DB'] ?? 'portarium',
  username: process.env['ODOO_USER'] ?? 'admin',
  apiKey: process.env['ODOO_PASSWORD'] ?? 'admin',
};

describe.skipIf(!RUN_LIVE)(
  'Level 2 — Live Odoo container round-trip (ODOO_INTEGRATION=true)',
  () => {
    let adapter: OdooFinanceAccountingAdapter;

    beforeEach(() => {
      adapter = new OdooFinanceAccountingAdapter(LIVE_CONFIG);
    });

    afterEach(() => {
      // No teardown needed — read-only operations in these tests
    });

    it('connects and lists chart-of-accounts (account.account)', async () => {
      const result = await adapter.execute(makeInput('listAccounts'));

      expect(result.ok).toBe(true);
      if (!result.ok) {
        // Provide actionable failure message
        throw new Error(
          `listAccounts failed (${result.error}): ${result.message}. ` +
            `Ensure Odoo is running at ${LIVE_CONFIG.baseUrl} and ` +
            `\`npm run dev:seed:odoo\` has been run.`,
        );
      }
      expect(result.result.kind).toBe('accounts');
      if (result.result.kind !== 'accounts') return;

      // Odoo 17 with account module always has at least a few default accounts
      expect(result.result.accounts.length).toBeGreaterThan(0);
      for (const account of result.result.accounts) {
        expect(account.schemaVersion).toBe(1);
        expect(account.tenantId).toBeDefined();
        expect(['asset', 'liability', 'equity', 'revenue', 'expense']).toContain(
          account.accountType,
        );
      }
    });

    it('lists vendors / partners (res.partner, supplier_rank > 0)', async () => {
      const result = await adapter.execute(makeInput('listVendors'));

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(
          `listVendors failed (${result.error}): ${result.message}. ` +
            `Ensure Odoo account module is installed.`,
        );
      }
      expect(result.result.kind).toBe('vendors');
      if (result.result.kind !== 'vendors') return;

      // Even a fresh Odoo instance may have 0 vendors until demo data is loaded;
      // just verify the schema of any returned records
      for (const vendor of result.result.vendors) {
        expect(vendor.schemaVersion).toBe(1);
        expect(vendor.roles).toContain('vendor');
        expect(typeof vendor.displayName).toBe('string');
      }
    });

    it('lists invoices (account.move type=out_invoice)', async () => {
      const result = await adapter.execute(makeInput('listInvoices'));

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`listInvoices failed (${result.error}): ${result.message}.`);
      }
      expect(result.result.kind).toBe('invoices');
      if (result.result.kind !== 'invoices') return;

      for (const invoice of result.result.invoices) {
        expect(invoice.schemaVersion).toBe(1);
        expect(['draft', 'sent', 'paid', 'void', 'overdue']).toContain(invoice.status);
      }
    });

    it('lists bills (account.move type=in_invoice)', async () => {
      const result = await adapter.execute(makeInput('listBills'));

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`listBills failed (${result.error}): ${result.message}.`);
      }
      expect(result.result.kind).toBe('invoices');
    });

    it('getTrialBalance returns opaque report URL even against live server', async () => {
      const result = await adapter.execute(makeInput('getTrialBalance'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('opaque');
      if (result.result.kind !== 'opaque') return;
      expect(result.result.payload['reportType']).toBe('trial_balance');
    });
  },
);

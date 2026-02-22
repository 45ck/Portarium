import { describe, it, expect, vi } from 'vitest';
import {
  OdooFinanceAccountingAdapter,
  type OdooAdapterConfig,
} from './odoo-finance-accounting-adapter.js';
import type { FinanceAccountingExecuteInputV1 } from '../../../application/ports/finance-accounting-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

const TENANT_ID = TenantId('tenant-001');

const DEFAULT_CONFIG: OdooAdapterConfig = {
  baseUrl: 'https://odoo.example.com',
  database: 'test-db',
  username: 'admin@example.com',
  apiKey: 'api-key-secret',
};

/** Build a fetch mock that handles auth then a single subsequent call. */
function makeFetchMock(dataResponse: unknown, { authUid = 7 }: { authUid?: number } = {}) {
  let callCount = 0;
  return vi.fn(async (_url: string, _init: RequestInit) => {
    callCount++;
    // First call is always /web/session/authenticate
    if (callCount === 1) {
      return new Response(JSON.stringify({ result: { uid: authUid } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ result: dataResponse }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function makeInput(
  operation: FinanceAccountingExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): FinanceAccountingExecuteInputV1 {
  return { tenantId: TENANT_ID, operation, ...(payload !== undefined ? { payload } : {}) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OdooFinanceAccountingAdapter', () => {
  describe('listAccounts', () => {
    it('maps Odoo account records to AccountV1 array', async () => {
      const odooAccounts = [
        {
          id: 1,
          name: 'Cash',
          code: '101000',
          account_type: 'asset_cash',
          currency_id: [1, 'USD'],
          active: true,
        },
        {
          id: 2,
          name: 'Revenue',
          code: '400000',
          account_type: 'income',
          currency_id: false,
          active: true,
        },
      ];
      const fetchFn = makeFetchMock(odooAccounts);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('listAccounts'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('accounts');
      if (result.result.kind !== 'accounts') return;

      const accounts = result.result.accounts;
      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toMatchObject({
        accountId: '1',
        tenantId: TENANT_ID,
        schemaVersion: 1,
        accountName: 'Cash',
        accountCode: '101000',
        accountType: 'asset',
        currencyCode: 'USD',
        isActive: true,
      });
      expect(accounts[1]).toMatchObject({
        accountType: 'revenue',
        currencyCode: 'USD', // falls back to USD when currency_id is false
      });
    });
  });

  describe('getAccount', () => {
    it('returns a single account when found', async () => {
      const odooAccounts = [
        {
          id: 5,
          name: 'Accounts Payable',
          code: '201000',
          account_type: 'liability_payable',
          currency_id: false,
          active: true,
        },
      ];
      const fetchFn = makeFetchMock(odooAccounts);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('getAccount', { accountId: '5' }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('account');
      if (result.result.kind !== 'account') return;
      expect(result.result.account.accountType).toBe('liability');
    });

    it('returns not_found when no records returned', async () => {
      const fetchFn = makeFetchMock([]);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('getAccount', { accountId: '999' }));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('not_found');
    });

    it('returns validation_error when accountId is missing', async () => {
      const fetchFn = makeFetchMock([]);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('getAccount'));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('listInvoices', () => {
    it('maps Odoo move records to InvoiceV1 array', async () => {
      const odooMoves = [
        {
          id: 10,
          name: 'INV/2024/0001',
          state: 'posted',
          payment_state: 'paid',
          currency_id: [2, 'EUR'],
          amount_total: 1500.0,
          invoice_date: '2024-01-15',
          invoice_date_due: '2024-02-15',
        },
        {
          id: 11,
          name: 'INV/2024/0002',
          state: 'draft',
          payment_state: 'not_paid',
          currency_id: [1, 'USD'],
          amount_total: 250.0,
          invoice_date: '2024-01-20',
          invoice_date_due: null,
        },
      ];
      const fetchFn = makeFetchMock(odooMoves);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('listInvoices'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('invoices');
      if (result.result.kind !== 'invoices') return;

      const invoices = result.result.invoices;
      expect(invoices).toHaveLength(2);
      expect(invoices[0]).toMatchObject({
        invoiceId: '10',
        tenantId: TENANT_ID,
        schemaVersion: 1,
        invoiceNumber: 'INV/2024/0001',
        status: 'paid',
        currencyCode: 'EUR',
        totalAmount: 1500,
        issuedAtIso: '2024-01-15',
        dueDateIso: '2024-02-15',
      });
      expect(invoices[1]?.status).toBe('draft');
      expect(invoices[1]?.dueDateIso).toBeUndefined();
    });
  });

  describe('createInvoice', () => {
    it('creates a move and returns draft InvoiceV1', async () => {
      // Auth call returns uid, then create returns new ID
      let callCount = 0;
      const fetchFn = vi.fn(async (_url: string) => {
        callCount++;
        const result = callCount === 1 ? { uid: 7 } : 42; // new invoice ID
        return new Response(JSON.stringify({ result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);
      const result = await adapter.execute(
        makeInput('createInvoice', {
          totalAmount: 800,
          currencyCode: 'GBP',
          issuedAtIso: '2024-03-01',
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('invoice');
      if (result.result.kind !== 'invoice') return;
      expect(result.result.invoice).toMatchObject({
        invoiceId: '42',
        status: 'draft',
        currencyCode: 'GBP',
        totalAmount: 800,
        issuedAtIso: '2024-03-01',
      });
    });
  });

  describe('listVendors', () => {
    it('maps Odoo partner records to PartyV1 with vendor role', async () => {
      const odooPartners = [
        { id: 20, name: 'Acme Supplies', email: 'billing@acme.com', phone: '+1-555-0100' },
        { id: 21, name: 'Beta Corp', email: null, phone: null },
      ];
      const fetchFn = makeFetchMock(odooPartners);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('listVendors'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('vendors');
      if (result.result.kind !== 'vendors') return;

      const vendors = result.result.vendors;
      expect(vendors).toHaveLength(2);
      expect(vendors[0]).toMatchObject({
        partyId: '20',
        tenantId: TENANT_ID,
        schemaVersion: 1,
        displayName: 'Acme Supplies',
        email: 'billing@acme.com',
        phone: '+1-555-0100',
        roles: ['vendor'],
      });
      expect(vendors[1]?.email).toBeUndefined();
    });
  });

  describe('reconcileAccount', () => {
    it('returns accepted result', async () => {
      const fetchFn = makeFetchMock(null);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('reconcileAccount', { accountId: '5' }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('accepted');
      if (result.result.kind !== 'accepted') return;
      expect(result.result.operation).toBe('reconcileAccount');
    });

    it('returns validation_error when accountId missing', async () => {
      const fetchFn = makeFetchMock(null);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('reconcileAccount'));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('getTrialBalance / getBalanceSheet / getProfitAndLoss', () => {
    it('returns opaque report reference', async () => {
      // These don't call Odoo API, but still need auth for #callKw — actually
      // getReport is fully local, no fetch needed.
      const fetchFn = vi.fn();
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      const result = await adapter.execute(makeInput('getTrialBalance'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('opaque');
      if (result.result.kind !== 'opaque') return;
      expect(result.result.payload['reportType']).toBe('trial_balance');
      expect(String(result.result.payload['viewUrl'])).toContain('trial_balance');
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('HTTP error handling', () => {
    it('wraps HTTP errors as provider_error', async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async (_url: string) => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ result: { uid: 7 } }), { status: 200 });
        }
        return new Response('Bad Gateway', { status: 502 });
      });

      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);
      const result = await adapter.execute(makeInput('listAccounts'));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
      expect(result.message).toContain('502');
    });

    it('wraps network failures as provider_error', async () => {
      const fetchFn = vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      });

      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);
      const result = await adapter.execute(makeInput('listAccounts'));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
      expect(result.message).toContain('ECONNREFUSED');
    });

    it('wraps Odoo JSON-RPC error as provider_error', async () => {
      let callCount = 0;
      const fetchFn = vi.fn(async (_url: string) => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ result: { uid: 7 } }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ error: { message: 'RPC Error', data: { message: 'Model not found' } } }),
          { status: 200 },
        );
      });

      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);
      const result = await adapter.execute(makeInput('listAccounts'));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
      expect(result.message).toContain('Model not found');
    });
  });

  describe('session caching', () => {
    it('authenticates only once across multiple calls', async () => {
      const fetchFn = makeFetchMock([]);
      const adapter = new OdooFinanceAccountingAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);

      await adapter.execute(makeInput('listAccounts'));
      await adapter.execute(makeInput('listVendors'));

      // 1 auth + 1 listAccounts + 1 listVendors = 3 calls
      expect(fetchFn).toHaveBeenCalledTimes(3);

      const authUrl = (fetchFn.mock.calls[0] as unknown as [string])[0];
      expect(authUrl).toContain('/web/session/authenticate');
    });
  });
});

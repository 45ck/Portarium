/**
 * Odoo reference adapter for the FinanceAccounting port family.
 *
 * Implements `FinanceAccountingAdapterPort` against Odoo's JSON-RPC 2.0
 * API (Odoo 16/17 compatible). Odoo exposes all model data through the
 * `/web/dataset/call_kw` endpoint.
 *
 * Authentication: session-based (login via /web/session/authenticate) or
 * API key (X-API-Key header, Odoo 16+).
 *
 * Covered operations:
 *   listAccounts / getAccount    — res.partner / account.account
 *   createJournalEntry           — account.move (type=entry)
 *   listJournalEntries           — account.move (type=entry)
 *   getTrialBalance              — account.report (trial balance report)
 *   listInvoices / getInvoice / createInvoice — account.move (type=out_invoice)
 *   listBills / getBill / createBill — account.move (type=in_invoice)
 *   listVendors / getVendor      — res.partner (supplier_rank > 0)
 *   reconcileAccount             — account.move.line reconcile
 *   getBalanceSheet / getProfitAndLoss — opaque (direct to Odoo report)
 *
 * Odoo JSON-RPC reference: https://www.odoo.com/documentation/17.0/developer/reference/external_api.html
 *
 * Bead: bead-0422
 */

import type { AccountV1 } from '../../../domain/canonical/account-v1.js';
import type { InvoiceV1 } from '../../../domain/canonical/invoice-v1.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { FinancialAccountId, InvoiceId, PartyId } from '../../../domain/primitives/index.js';
import type {
  FinanceAccountingAdapterPort,
  FinanceAccountingExecuteInputV1,
  FinanceAccountingExecuteOutputV1,
} from '../../../application/ports/finance-accounting-adapter.js';

// ── Config ────────────────────────────────────────────────────────────────

export interface OdooAdapterConfig {
  /** Base URL (e.g. https://my-company.odoo.com). */
  baseUrl: string;
  /** Odoo database name. */
  database: string;
  /** Odoo username (email). */
  username: string;
  /** Odoo API key (Odoo 16+) or password. */
  apiKey: string;
  /** Optional timeout in ms. Default: 15 000. */
  timeoutMs?: number;
}

type FetchFn = typeof fetch;

// ── Mappers ────────────────────────────────────────────────────────────────

function extractCurrencyCode(raw: unknown): string {
  if (Array.isArray(raw) && typeof raw[1] === 'string') return raw[1];
  return 'USD';
}

const ODOO_ACCOUNT_TYPE_MAP: Record<string, AccountV1['accountType']> = {
  'asset_receivable': 'asset',
  'asset_cash': 'asset',
  'asset_current': 'asset',
  'asset_non_current': 'asset',
  'liability_payable': 'liability',
  'liability_current': 'liability',
  'liability_non_current': 'liability',
  'equity': 'equity',
  'income': 'revenue',
  'income_other': 'revenue',
  'expense': 'expense',
  'expense_depreciation': 'expense',
  'expense_direct_cost': 'expense',
  'off_balance': 'asset',
};

function mapOdooAccount(rec: Record<string, unknown>, tenantId: string): AccountV1 {
  return {
    accountId: FinancialAccountId(String(rec['id'])),
    tenantId: tenantId as AccountV1['tenantId'],
    schemaVersion: 1,
    accountName: String(rec['name'] ?? ''),
    accountCode: String(rec['code'] ?? ''),
    accountType: ODOO_ACCOUNT_TYPE_MAP[String(rec['account_type'] ?? '')] ?? 'asset',
    currencyCode: extractCurrencyCode(rec['currency_id']),
    isActive: Boolean(rec['active'] ?? true),
  };
}

const ODOO_INVOICE_STATUS_MAP: Record<string, InvoiceV1['status']> = {
  draft: 'draft',
  posted: 'sent',
  cancel: 'void',
};

function mapOdooInvoice(rec: Record<string, unknown>, tenantId: string): InvoiceV1 {
  const odooState = String(rec['payment_state'] ?? rec['state'] ?? 'draft');
  const status: InvoiceV1['status'] =
    odooState === 'paid' || odooState === 'in_payment' ? 'paid'
      : ODOO_INVOICE_STATUS_MAP[String(rec['state'] ?? 'draft')] ?? 'draft';

  return {
    invoiceId: InvoiceId(String(rec['id'])),
    tenantId: tenantId as InvoiceV1['tenantId'],
    schemaVersion: 1,
    invoiceNumber: String(rec['name'] ?? `INV-${rec['id']}`),
    status,
    currencyCode: extractCurrencyCode(rec['currency_id']),
    totalAmount: Number(rec['amount_total'] ?? 0),
    issuedAtIso: String(rec['invoice_date'] ?? rec['date'] ?? new Date().toISOString().slice(0, 10)),
    ...(typeof rec['invoice_date_due'] === 'string' ? { dueDateIso: rec['invoice_date_due'] } : {}),
  };
}

function mapOdooPartner(rec: Record<string, unknown>, tenantId: string): PartyV1 {
  return {
    partyId: PartyId(String(rec['id'])),
    tenantId: tenantId as PartyV1['tenantId'],
    schemaVersion: 1,
    displayName: String(rec['name'] ?? ''),
    ...(typeof rec['email'] === 'string' ? { email: rec['email'] } : {}),
    ...(typeof rec['phone'] === 'string' ? { phone: rec['phone'] } : {}),
    roles: ['vendor'],
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────

export class OdooFinanceAccountingAdapter implements FinanceAccountingAdapterPort {
  readonly #config: OdooAdapterConfig;
  readonly #fetch: FetchFn;
  #uid: number | null = null;

  constructor(config: OdooAdapterConfig, fetchFn: FetchFn = fetch) {
    this.#config = config;
    this.#fetch = fetchFn;
  }

  async execute(input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1> {
    try {
      switch (input.operation) {
        case 'listAccounts':      return await this.#listAccounts(input);
        case 'getAccount':        return await this.#getAccount(input);
        case 'createJournalEntry': return await this.#createJournalEntry(input);
        case 'listJournalEntries': return await this.#listJournalEntries(input);
        case 'getTrialBalance':   return await this.#getReport(input, 'trial_balance');
        case 'listInvoices':      return await this.#listMoves(input, 'out_invoice');
        case 'getInvoice':        return await this.#getInvoice(input);
        case 'createInvoice':     return await this.#createMove(input, 'out_invoice');
        case 'listBills':         return await this.#listMoves(input, 'in_invoice');
        case 'getBill':           return await this.#getInvoice(input, 'in_invoice');
        case 'createBill':        return await this.#createMove(input, 'in_invoice');
        case 'listVendors':       return await this.#listVendors(input);
        case 'getVendor':         return await this.#getVendor(input);
        case 'reconcileAccount':  return await this.#reconcileAccount(input);
        case 'getBalanceSheet':   return await this.#getReport(input, 'balance_sheet');
        case 'getProfitAndLoss':  return await this.#getReport(input, 'profit_loss');
        default:
          return { ok: false, error: 'unsupported_operation', message: `Unsupported: ${String(input.operation)}` };
      }
    } catch (err) {
      return {
        ok: false,
        error: 'provider_error',
        message: `Odoo API error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Accounts ───────────────────────────────────────────────────────────────

  async #listAccounts(input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1> {
    const records = await this.#searchRead<Record<string, unknown>>(
      'account.account',
      [],
      ['id', 'name', 'code', 'account_type', 'currency_id', 'active'],
    );
    return {
      ok: true,
      result: { kind: 'accounts', accounts: records.map((r) => mapOdooAccount(r, String(input.tenantId))) },
    };
  }

  async #getAccount(input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1> {
    const accountId = String(input.payload?.['accountId'] ?? '');
    if (!accountId) return { ok: false, error: 'validation_error', message: 'accountId is required.' };

    const records = await this.#searchRead<Record<string, unknown>>(
      'account.account',
      [['id', '=', Number(accountId)]],
      ['id', 'name', 'code', 'account_type', 'currency_id', 'active'],
    );
    if (records.length === 0) {
      return { ok: false, error: 'not_found', message: `Account ${accountId} not found.` };
    }
    return { ok: true, result: { kind: 'account', account: mapOdooAccount(records[0]!, String(input.tenantId)) } };
  }

  // ── Journal entries ────────────────────────────────────────────────────────

  async #createJournalEntry(input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1> {
    const date = String(input.payload?.['date'] ?? new Date().toISOString().slice(0, 10));
    const ref = String(input.payload?.['reference'] ?? '');

    const id = await this.#create('account.move', {
      move_type: 'entry',
      date,
      ref,
    });
    return {
      ok: true,
      result: {
        kind: 'opaque',
        payload: { id, model: 'account.move', move_type: 'entry', date, ref },
      },
    };
  }

  async #listJournalEntries(_input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1> {
    const records = await this.#searchRead<Record<string, unknown>>(
      'account.move',
      [['move_type', '=', 'entry']],
      ['id', 'name', 'date', 'ref', 'state'],
      { limit: 50 },
    );
    return { ok: true, result: { kind: 'opaque', payload: { entries: records } } };
  }

  // ── Invoices / Bills ───────────────────────────────────────────────────────

  async #listMoves(input: FinanceAccountingExecuteInputV1, moveType: string): Promise<FinanceAccountingExecuteOutputV1> {
    const records = await this.#searchRead<Record<string, unknown>>(
      'account.move',
      [['move_type', '=', moveType]],
      ['id', 'name', 'state', 'payment_state', 'currency_id', 'amount_total', 'invoice_date', 'invoice_date_due'],
    );
    const invoices = records.map((r) => mapOdooInvoice(r, String(input.tenantId)));
    return { ok: true, result: { kind: 'invoices', invoices } };
  }

  async #getInvoice(input: FinanceAccountingExecuteInputV1, _moveType?: string): Promise<FinanceAccountingExecuteOutputV1> {
    const invoiceId = String(input.payload?.['invoiceId'] ?? input.payload?.['billId'] ?? '');
    if (!invoiceId) return { ok: false, error: 'validation_error', message: 'invoiceId is required.' };

    const records = await this.#searchRead<Record<string, unknown>>(
      'account.move',
      [['id', '=', Number(invoiceId)]],
      ['id', 'name', 'state', 'payment_state', 'currency_id', 'amount_total', 'invoice_date', 'invoice_date_due'],
    );
    if (records.length === 0) {
      return { ok: false, error: 'not_found', message: `Invoice ${invoiceId} not found.` };
    }
    return { ok: true, result: { kind: 'invoice', invoice: mapOdooInvoice(records[0]!, String(input.tenantId)) } };
  }

  async #createMove(input: FinanceAccountingExecuteInputV1, moveType: string): Promise<FinanceAccountingExecuteOutputV1> {
    const totalAmount = Number(input.payload?.['totalAmount'] ?? 0);
    const currencyCode = String(input.payload?.['currencyCode'] ?? 'USD');
    const date = String(input.payload?.['issuedAtIso'] ?? new Date().toISOString().slice(0, 10));

    const id = await this.#create('account.move', {
      move_type: moveType,
      invoice_date: date,
      amount_total: totalAmount,
    });

    return {
      ok: true,
      result: {
        kind: 'invoice',
        invoice: {
          invoiceId: InvoiceId(String(id)),
          tenantId: input.tenantId,
          schemaVersion: 1,
          invoiceNumber: `INV-${id}`,
          status: 'draft',
          currencyCode,
          totalAmount,
          issuedAtIso: date,
        },
      },
    };
  }

  // ── Vendors ────────────────────────────────────────────────────────────────

  async #listVendors(input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1> {
    const records = await this.#searchRead<Record<string, unknown>>(
      'res.partner',
      [['supplier_rank', '>', 0]],
      ['id', 'name', 'email', 'phone'],
    );
    return {
      ok: true,
      result: { kind: 'vendors', vendors: records.map((r) => mapOdooPartner(r, String(input.tenantId))) },
    };
  }

  async #getVendor(input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1> {
    const vendorId = String(input.payload?.['vendorId'] ?? '');
    if (!vendorId) return { ok: false, error: 'validation_error', message: 'vendorId is required.' };

    const records = await this.#searchRead<Record<string, unknown>>(
      'res.partner',
      [['id', '=', Number(vendorId)], ['supplier_rank', '>', 0]],
      ['id', 'name', 'email', 'phone'],
    );
    if (records.length === 0) {
      return { ok: false, error: 'not_found', message: `Vendor ${vendorId} not found.` };
    }
    return { ok: true, result: { kind: 'vendor', vendor: mapOdooPartner(records[0]!, String(input.tenantId)) } };
  }

  // ── Reconcile ─────────────────────────────────────────────────────────────

  async #reconcileAccount(input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1> {
    // Odoo reconcile: call account.move.line.auto_reconcile on the account.
    const accountId = String(input.payload?.['accountId'] ?? '');
    if (!accountId) return { ok: false, error: 'validation_error', message: 'accountId is required.' };

    await this.#callKw('account.move.line', 'auto_reconcile_lines', [], {
      account_id: Number(accountId),
    });
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  // ── Reports (opaque) ───────────────────────────────────────────────────────

  async #getReport(_input: FinanceAccountingExecuteInputV1, reportType: string): Promise<FinanceAccountingExecuteOutputV1> {
    // Odoo financial reports are rendered server-side. Return opaque ref.
    return {
      ok: true,
      result: {
        kind: 'opaque',
        payload: {
          reportType,
          viewUrl: `${this.#config.baseUrl}/odoo/accounting/reports/${reportType}`,
          generatedAt: new Date().toISOString(),
        },
      },
    };
  }

  // ── JSON-RPC primitives ────────────────────────────────────────────────────

  async #ensureAuthenticated(): Promise<number> {
    if (this.#uid !== null) return this.#uid;

    const res = await this.#rpc<{ uid: number }>('/web/session/authenticate', {
      db: this.#config.database,
      login: this.#config.username,
      password: this.#config.apiKey,
    });
    this.#uid = res.uid;
    return this.#uid;
  }

  async #searchRead<T>(
    model: string,
    domain: unknown[],
    fields: string[],
    options: { limit?: number; offset?: number } = {},
  ): Promise<T[]> {
    await this.#ensureAuthenticated();
    const res = await this.#callKw(model, 'search_read', [domain], {
      fields,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    });
    return res as T[];
  }

  async #create(model: string, values: Record<string, unknown>): Promise<number> {
    await this.#ensureAuthenticated();
    const res = await this.#callKw(model, 'create', [values], {});
    return res as number;
  }

  async #callKw(model: string, method: string, args: unknown[], kwargs: Record<string, unknown>): Promise<unknown> {
    const uid = this.#uid ?? (await this.#ensureAuthenticated());
    return this.#rpc<unknown>('/web/dataset/call_kw', {
      model,
      method,
      args,
      kwargs: {
        context: { lang: 'en_US', tz: 'UTC', uid },
        ...kwargs,
      },
    });
  }

  async #rpc<T>(path: string, params: Record<string, unknown>): Promise<T> {
    const url = `${this.#config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs ?? 15_000);

    try {
      const res = await this.#fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // API key auth (Odoo 16+): X-API-Key header.
          ...(path !== '/web/session/authenticate'
            ? { 'X-API-Key': this.#config.apiKey }
            : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} from Odoo (${path}): ${text}`);
      }

      const json = await res.json() as { result?: T; error?: { message: string; data?: { message: string } } };
      if (json.error) {
        throw new Error(json.error.data?.message ?? json.error.message);
      }
      return json.result as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Mapping helpers for the Odoo FinanceAccounting adapter.
 * Converts raw Odoo JSON-RPC records to canonical domain types.
 * Bead: bead-0422
 */

import type { AccountV1 } from '../../../domain/canonical/account-v1.js';
import type { InvoiceV1 } from '../../../domain/canonical/invoice-v1.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { FinancialAccountId, InvoiceId, PartyId } from '../../../domain/primitives/index.js';

export function extractCurrencyCode(raw: unknown): string {
  if (Array.isArray(raw) && typeof raw[1] === 'string') return raw[1];
  return 'USD';
}

export const ODOO_ACCOUNT_TYPE_MAP: Record<string, AccountV1['accountType']> = {
  asset_receivable: 'asset',
  asset_cash: 'asset',
  asset_current: 'asset',
  asset_non_current: 'asset',
  liability_payable: 'liability',
  liability_current: 'liability',
  liability_non_current: 'liability',
  equity: 'equity',
  income: 'revenue',
  income_other: 'revenue',
  expense: 'expense',
  expense_depreciation: 'expense',
  expense_direct_cost: 'expense',
  off_balance: 'asset',
};

export function mapOdooAccount(rec: Record<string, unknown>, tenantId: string): AccountV1 {
  return {
    accountId: FinancialAccountId(String(rec['id'])),
    tenantId: tenantId as AccountV1['tenantId'],
    schemaVersion: 1,
    accountName: (rec['name'] as string | undefined) ?? '',
    accountCode: (rec['code'] as string | undefined) ?? '',
    accountType:
      ODOO_ACCOUNT_TYPE_MAP[(rec['account_type'] as string | undefined) ?? ''] ?? 'asset',
    currencyCode: extractCurrencyCode(rec['currency_id']),
    isActive: Boolean(rec['active'] ?? true),
  };
}

export const ODOO_INVOICE_STATUS_MAP: Record<string, InvoiceV1['status']> = {
  draft: 'draft',
  posted: 'sent',
  cancel: 'void',
};

export function resolveInvoiceStatus(odooState: string, recState: string): InvoiceV1['status'] {
  if (odooState === 'paid' || odooState === 'in_payment') return 'paid';
  return ODOO_INVOICE_STATUS_MAP[recState] ?? 'draft';
}

export function mapOdooInvoice(rec: Record<string, unknown>, tenantId: string): InvoiceV1 {
  const paymentState = rec['payment_state'] as string | undefined;
  const recState = (rec['state'] as string | undefined) ?? 'draft';
  const odooState = paymentState ?? recState;
  const status: InvoiceV1['status'] = resolveInvoiceStatus(odooState, recState);

  return {
    invoiceId: InvoiceId(String(rec['id'])),
    tenantId: tenantId as InvoiceV1['tenantId'],
    schemaVersion: 1,
    invoiceNumber: (rec['name'] as string | undefined) ?? `INV-${String(rec['id'])}`,
    status,
    currencyCode: extractCurrencyCode(rec['currency_id']),
    totalAmount: Number(rec['amount_total'] ?? 0),
    issuedAtIso:
      (rec['invoice_date'] as string | undefined) ??
      (rec['date'] as string | undefined) ??
      new Date().toISOString().slice(0, 10),
    ...(typeof rec['invoice_date_due'] === 'string' ? { dueDateIso: rec['invoice_date_due'] } : {}),
  };
}

export function mapOdooPartner(rec: Record<string, unknown>, tenantId: string): PartyV1 {
  return {
    partyId: PartyId(String(rec['id'])),
    tenantId: tenantId as PartyV1['tenantId'],
    schemaVersion: 1,
    displayName: (rec['name'] as string | undefined) ?? '',
    ...(typeof rec['email'] === 'string' ? { email: rec['email'] } : {}),
    ...(typeof rec['phone'] === 'string' ? { phone: rec['phone'] } : {}),
    roles: ['vendor'],
  };
}

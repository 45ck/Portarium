import type { AccountV1 } from '../../../domain/canonical/account-v1.js';
import type { InvoiceV1 } from '../../../domain/canonical/invoice-v1.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { FinancialAccountId, InvoiceId, PartyId } from '../../../domain/primitives/index.js';
import type {
  FinanceAccountingAdapterPort,
  FinanceAccountingExecuteInputV1,
  FinanceAccountingExecuteOutputV1,
} from '../../../application/ports/finance-accounting-adapter.js';
import { FINANCE_ACCOUNTING_OPERATIONS_V1 } from '../../../application/ports/finance-accounting-adapter.js';

const OPERATION_SET = new Set<string>(FINANCE_ACCOUNTING_OPERATIONS_V1);

type InMemoryFinanceAccountingAdapterSeed = Readonly<{
  accounts?: readonly AccountV1[];
  invoices?: readonly InvoiceV1[];
  bills?: readonly InvoiceV1[];
  vendors?: readonly PartyV1[];
}>;

type InMemoryFinanceAccountingAdapterParams = Readonly<{
  seed?: InMemoryFinanceAccountingAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class InMemoryFinanceAccountingAdapter implements FinanceAccountingAdapterPort {
  readonly #now: () => Date;
  readonly #accounts: AccountV1[];
  readonly #invoices: InvoiceV1[];
  readonly #bills: InvoiceV1[];
  readonly #vendors: PartyV1[];
  #invoiceSequence: number;
  #billSequence: number;

  public constructor(params?: InMemoryFinanceAccountingAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#accounts = [...(params?.seed?.accounts ?? [])];
    this.#invoices = [...(params?.seed?.invoices ?? [])];
    this.#bills = [...(params?.seed?.bills ?? [])];
    this.#vendors = [...(params?.seed?.vendors ?? [])];
    this.#invoiceSequence = this.#invoices.length;
    this.#billSequence = this.#bills.length;
  }

  public async execute(
    input: FinanceAccountingExecuteInputV1,
  ): Promise<FinanceAccountingExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported FinanceAccounting operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listAccounts':
        return { ok: true, result: { kind: 'accounts', accounts: this.#listAccounts(input) } };
      case 'getAccount':
        return this.#getAccount(input);
      case 'createJournalEntry':
        return { ok: true, result: { kind: 'accepted', operation: 'createJournalEntry' } };
      case 'listJournalEntries':
      case 'getTrialBalance':
      case 'reconcileAccount':
      case 'getBalanceSheet':
      case 'getProfitAndLoss':
        return {
          ok: true,
          result: {
            kind: 'opaque',
            payload: {
              operation: input.operation,
              tenantId: input.tenantId,
              status: 'stubbed',
            },
          },
        };
      case 'listInvoices':
        return { ok: true, result: { kind: 'invoices', invoices: this.#listInvoices(input) } };
      case 'getInvoice':
        return this.#getInvoice(input, false);
      case 'createInvoice':
        return this.#createInvoice(input, false);
      case 'listBills':
        return { ok: true, result: { kind: 'invoices', invoices: this.#listBills(input) } };
      case 'getBill':
        return this.#getInvoice(input, true);
      case 'createBill':
        return this.#createInvoice(input, true);
      case 'listVendors':
        return { ok: true, result: { kind: 'vendors', vendors: this.#listVendors(input) } };
      case 'getVendor':
        return this.#getVendor(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported FinanceAccounting operation: ${String(input.operation)}.`,
        };
    }
  }

  #listAccounts(input: FinanceAccountingExecuteInputV1): readonly AccountV1[] {
    return this.#accounts.filter((account) => account.tenantId === input.tenantId);
  }

  #getAccount(input: FinanceAccountingExecuteInputV1): FinanceAccountingExecuteOutputV1 {
    const accountId = readString(input.payload, 'accountId');
    if (accountId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'accountId is required for getAccount.',
      };
    }

    const account = this.#accounts.find(
      (item) => item.tenantId === input.tenantId && item.accountId === accountId,
    );
    if (account === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Account ${accountId} was not found.`,
      };
    }

    return { ok: true, result: { kind: 'account', account } };
  }

  #listInvoices(input: FinanceAccountingExecuteInputV1): readonly InvoiceV1[] {
    return this.#invoices.filter((invoice) => invoice.tenantId === input.tenantId);
  }

  #listBills(input: FinanceAccountingExecuteInputV1): readonly InvoiceV1[] {
    return this.#bills.filter((bill) => bill.tenantId === input.tenantId);
  }

  #getInvoice(
    input: FinanceAccountingExecuteInputV1,
    isBill: boolean,
  ): FinanceAccountingExecuteOutputV1 {
    const invoiceId = readString(input.payload, 'invoiceId');
    if (invoiceId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'invoiceId is required.',
      };
    }

    const source = isBill ? this.#bills : this.#invoices;
    const invoice = source.find(
      (item) => item.tenantId === input.tenantId && item.invoiceId === invoiceId,
    );
    if (invoice === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Invoice ${invoiceId} was not found.`,
      };
    }

    return { ok: true, result: { kind: 'invoice', invoice } };
  }

  #createInvoice(
    input: FinanceAccountingExecuteInputV1,
    isBill: boolean,
  ): FinanceAccountingExecuteOutputV1 {
    const nowIso = this.#now().toISOString();
    const prefix = isBill ? 'BILL' : 'INV';
    const sequence = isBill ? ++this.#billSequence : ++this.#invoiceSequence;
    const record = {
      invoiceId: InvoiceId(`${prefix}-${sequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1 as const,
      invoiceNumber: `${prefix}-${String(sequence).padStart(5, '0')}`,
      status: 'draft' as const,
      currencyCode: 'USD',
      totalAmount: 0,
      issuedAtIso: nowIso,
    };

    const output: InvoiceV1 = {
      ...record,
      ...(typeof input.payload?.['currencyCode'] === 'string'
        ? { currencyCode: input.payload['currencyCode'] }
        : {}),
      ...(typeof input.payload?.['totalAmount'] === 'number'
        ? { totalAmount: input.payload['totalAmount'] }
        : {}),
      ...(typeof input.payload?.['invoiceNumber'] === 'string'
        ? { invoiceNumber: input.payload['invoiceNumber'] }
        : {}),
    };

    if (isBill) {
      this.#bills.push(output);
    } else {
      this.#invoices.push(output);
    }

    return { ok: true, result: { kind: 'invoice', invoice: output } };
  }

  #listVendors(input: FinanceAccountingExecuteInputV1): readonly PartyV1[] {
    return this.#vendors.filter((vendor) => vendor.tenantId === input.tenantId);
  }

  #getVendor(input: FinanceAccountingExecuteInputV1): FinanceAccountingExecuteOutputV1 {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'partyId is required for getVendor.',
      };
    }

    const vendor = this.#vendors.find(
      (item) => item.tenantId === input.tenantId && item.partyId === partyId,
    );
    if (vendor === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Vendor ${partyId} was not found.`,
      };
    }

    return { ok: true, result: { kind: 'vendor', vendor } };
  }

  public static seedMinimal(
    tenantId: FinanceAccountingExecuteInputV1['tenantId'],
  ): InMemoryFinanceAccountingAdapterSeed {
    return {
      accounts: [
        {
          accountId: FinancialAccountId('acc-1000'),
          tenantId,
          schemaVersion: 1,
          accountName: 'Cash',
          accountCode: '1000',
          accountType: 'asset',
          currencyCode: 'USD',
          isActive: true,
        },
      ],
      invoices: [
        {
          invoiceId: InvoiceId('inv-1000'),
          tenantId,
          schemaVersion: 1,
          invoiceNumber: 'INV-1000',
          status: 'sent',
          currencyCode: 'USD',
          totalAmount: 2500,
          issuedAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      vendors: [
        {
          partyId: PartyId('vendor-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Default Vendor',
          roles: ['vendor'],
        },
      ],
    };
  }
}

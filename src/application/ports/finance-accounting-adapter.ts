import type { AccountV1 } from '../../domain/canonical/account-v1.js';
import type { InvoiceV1 } from '../../domain/canonical/invoice-v1.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const FINANCE_ACCOUNTING_OPERATIONS_V1 = [
  'listAccounts',
  'getAccount',
  'createJournalEntry',
  'listJournalEntries',
  'getTrialBalance',
  'listInvoices',
  'getInvoice',
  'createInvoice',
  'listBills',
  'getBill',
  'createBill',
  'listVendors',
  'getVendor',
  'reconcileAccount',
  'getBalanceSheet',
  'getProfitAndLoss',
] as const;

export type FinanceAccountingOperationV1 = (typeof FINANCE_ACCOUNTING_OPERATIONS_V1)[number];

export type FinanceAccountingOperationResultV1 =
  | Readonly<{ kind: 'accounts'; accounts: readonly AccountV1[] }>
  | Readonly<{ kind: 'account'; account: AccountV1 }>
  | Readonly<{ kind: 'invoices'; invoices: readonly InvoiceV1[] }>
  | Readonly<{ kind: 'invoice'; invoice: InvoiceV1 }>
  | Readonly<{ kind: 'vendors'; vendors: readonly PartyV1[] }>
  | Readonly<{ kind: 'vendor'; vendor: PartyV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>
  | Readonly<{ kind: 'accepted'; operation: FinanceAccountingOperationV1 }>;

export type FinanceAccountingExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: FinanceAccountingOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type FinanceAccountingExecuteOutputV1 =
  | Readonly<{ ok: true; result: FinanceAccountingOperationResultV1 }>
  | Readonly<{
      ok: false;
      error:
        | 'unsupported_operation'
        | 'not_found'
        | 'validation_error'
        | 'provider_error';
      message: string;
    }>;

export interface FinanceAccountingAdapterPort {
  execute(input: FinanceAccountingExecuteInputV1): Promise<FinanceAccountingExecuteOutputV1>;
}

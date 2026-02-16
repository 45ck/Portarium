# Port 1: Finance & Accounting — Integration Catalog

## Port Operations

| Operation            | Description                                                  | Idempotent |
| -------------------- | ------------------------------------------------------------ | ---------- |
| `listAccounts`       | Return chart-of-accounts filtered by type, status, or class  | Yes        |
| `getAccount`         | Retrieve a single account by canonical ID or external ref    | Yes        |
| `createJournalEntry` | Post a balanced journal entry (debits = credits)             | No         |
| `listJournalEntries` | Query journal entries by date range, account, or status      | Yes        |
| `getTrialBalance`    | Compute trial balance as-of a given date                     | Yes        |
| `listInvoices`       | List accounts-receivable invoices with filter and pagination | Yes        |
| `getInvoice`         | Retrieve a single AR invoice by ID                           | Yes        |
| `createInvoice`      | Issue a new AR invoice to a customer                         | No         |
| `listBills`          | List accounts-payable bills with filter and pagination       | Yes        |
| `getBill`            | Retrieve a single AP bill by ID                              | Yes        |
| `createBill`         | Record a new AP bill from a vendor                           | No         |
| `listVendors`        | List vendor/supplier records                                 | Yes        |
| `getVendor`          | Retrieve a single vendor by ID                               | Yes        |
| `reconcileAccount`   | Mark a bank-account statement period as reconciled           | No         |
| `getBalanceSheet`    | Generate balance sheet as-of a given date                    | Yes        |
| `getProfitAndLoss`   | Generate profit-and-loss for a date range                    | Yes        |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30 % market share or >50 k customers)

| Provider                            | Source                                      | Adoption | Est. Customers                            | API Style                                              | Webhooks                                      | Key Entities                                                                                |
| ----------------------------------- | ------------------------------------------- | -------- | ----------------------------------------- | ------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **QuickBooks Online** (Intuit)      | S1 — full OpenAPI spec, public sandbox      | A1       | ~7 M small-business customers worldwide   | REST (JSON), OAuth 2.0                                 | Yes — change-data-capture webhooks per entity | Account, JournalEntry, Invoice, Bill, Vendor, Customer, Payment, TaxRate, Class, Department |
| **Xero**                            | S1 — OpenAPI 3.0 spec, demo company sandbox | A1       | ~4.2 M subscribers (strongest in UK/ANZ)  | REST (JSON), OAuth 2.0                                 | Yes — per-event webhooks with HMAC signing    | Account, ManualJournal, Invoice, Bill, Contact, Payment, TaxRate, TrackingCategory          |
| **Sage** (Intacct / Business Cloud) | S2 — REST & legacy SOAP; sandbox by request | A1       | ~3 M customers across Sage product family | REST (Business Cloud), SOAP/XML (Intacct Web Services) | Limited — polling recommended for Intacct     | GLAccount, JournalEntry, ARInvoice, APBill, Vendor, Customer, Payment                       |

### Tier A2 — Strong Contenders (10-30 % share or >10 k customers)

| Provider       | Source                                      | Adoption | Est. Customers                                  | API Style                       | Webhooks                  | Key Entities                                                  |
| -------------- | ------------------------------------------- | -------- | ----------------------------------------------- | ------------------------------- | ------------------------- | ------------------------------------------------------------- |
| **FreshBooks** | S1 — REST API with sandbox environment      | A2       | ~30 M users (invoicing-centric)                 | REST (JSON), OAuth 2.0          | Yes — webhook callbacks   | Account, Invoice, Expense, Client, Payment, Tax, Item         |
| **Zoho Books** | S1 — REST API, sandbox org available        | A2       | ~15 M+ users (part of Zoho ecosystem)           | REST (JSON), OAuth 2.0          | Yes — per-module webhooks | ChartOfAccount, Journal, Invoice, Bill, Contact, Payment, Tax |
| **Wave**       | S2 — GraphQL API; limited endpoint coverage | A2       | ~5 M users (free tier popular with freelancers) | GraphQL (queries and mutations) | No native webhooks        | Account, Invoice, Bill, Customer, Payment                     |

### Best OSS for Domain Extraction

| Project                        | Source                                       | API Style                 | Key Entities                                                                           | Notes                                                                                                                               |
| ------------------------------ | -------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **ERPNext** (Frappe Framework) | S1 — self-hosted, full REST + Python SDK     | REST (JSON-RPC over HTTP) | Account, JournalEntry, SalesInvoice, PurchaseInvoice, Supplier, Customer, PaymentEntry | Full double-entry GL; multi-company, multi-currency. Active community (~15 k GitHub stars). Good reference for entity modelling.    |
| **Odoo** (Community Edition)   | S1 — self-hosted, XML-RPC & JSON-RPC         | XML-RPC / JSON-RPC        | account.account, account.move, account.move.line, res.partner, account.payment         | Modular ERP; accounting module covers GL, AR, AP, bank reconciliation. ~35 k GitHub stars. Dotted model names map 1:1 to DB tables. |
| **GnuCash**                    | S4 — file-based (XML or SQLite), no HTTP API | File I/O (SQLite / XML)   | Account, Transaction, Split, Invoice, Customer, Vendor                                 | Desktop-first; useful for understanding pure double-entry data structures. No live API — adapter reads SQLite directly.             |

### Tier A3 — Established Niche / Enterprise

| Provider                           | Source                                                                  | Adoption | Notes                                                                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NetSuite** (Oracle)              | S2 — SuiteTalk SOAP & RESTlet framework; sandbox available with license | A3       | Dominant mid-market/enterprise ERP. Entities: Account, JournalEntry, Invoice, VendorBill, Vendor, Customer, Payment. Complex customization model (SuiteScript). |
| **Microsoft Dynamics 365 Finance** | S2 — OData v4 REST API; Azure-hosted sandboxes                          | A3       | Enterprise ERP. Entities: LedgerJournalHeader, GeneralJournalAccountEntry, VendInvoiceJour, CustInvoiceJour. Deep integration with Power Platform and Azure.    |

### Tier A4 — Emerging / Regional

| Provider                           | Source                                               | Adoption | Notes                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Tally** (Tally Solutions, India) | S4 — XML-based request/response over local HTTP port | A4       | Dominant in Indian SMB market (~7 M licenses claimed). No formal REST API — integration via TallyPrime's XML interface on localhost. |
| **MYOB** (Australia / New Zealand) | S2 — REST API with OAuth 2.0; limited sandbox        | A4       | Leading ANZ accounting platform. Entities mirror standard GL/AR/AP. Regional tax rules (GST/BAS) baked into API responses.           |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by accounting domain.

### General Ledger

| Entity                              | Description                                                                     | Observed In                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Account**                         | A node in the chart of accounts (asset, liability, equity, revenue, expense)    | All providers                                                              |
| **JournalEntry**                    | A balanced set of debit/credit lines posted to the GL                           | QBO, Sage, ERPNext, Odoo, NetSuite, Dynamics                               |
| **ManualJournal**                   | Xero-specific name for a user-created journal entry                             | Xero                                                                       |
| **FiscalPeriod**                    | A named accounting period (month, quarter, year) used for closing and reporting | Sage, NetSuite, Dynamics, ERPNext                                          |
| **BudgetEntry**                     | A planned amount for an account within a fiscal period                          | NetSuite, Dynamics, ERPNext                                                |
| **CostCentre / Class / Department** | Dimensional tag for segmenting transactions (profit centre, department, class)  | QBO (Class, Department), Xero (TrackingCategory), Sage, NetSuite, Dynamics |

### Accounts Receivable

| Entity                | Description                                        | Observed In                                            |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| **Invoice (AR)**      | A demand for payment issued to a customer          | All providers                                          |
| **CreditNote**        | A negative invoice reducing the customer's balance | QBO, Xero, Sage, Zoho Books, ERPNext                   |
| **Customer / Client** | The party who owes payment                         | All providers (name varies: Customer, Client, Contact) |

### Accounts Payable

| Entity                | Description                                          | Observed In                                                                                 |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Bill (AP)**         | A payable owed to a vendor/supplier                  | QBO, Xero, Zoho Books, Wave, Odoo, ERPNext                                                  |
| **DebitNote**         | A negative bill reducing the amount owed to a vendor | Xero, ERPNext, Zoho Books                                                                   |
| **Vendor / Supplier** | The party to whom payment is owed                    | QBO, Sage, ERPNext, GnuCash, NetSuite (name varies: Vendor, Supplier, Contact, res.partner) |

### Payments & Banking

| Entity              | Description                                                | Observed In           |
| ------------------- | ---------------------------------------------------------- | --------------------- |
| **Payment**         | A cash movement applied against one or more invoices/bills | All providers         |
| **BankTransaction** | A raw transaction imported from a bank feed                | QBO, Xero, Wave, Odoo |

### Tax & Currency

| Entity       | Description                                       | Observed In                                                   |
| ------------ | ------------------------------------------------- | ------------------------------------------------------------- |
| **TaxRate**  | A tax percentage and associated GL accounts       | QBO, Xero, FreshBooks, Zoho Books, ERPNext                    |
| **Currency** | ISO 4217 currency code and exchange rate metadata | All multi-currency providers (Xero, QBO, Sage, ERPNext, Odoo) |

---

## VAOP Canonical Mapping

| Universal Entity                | VAOP Canonical Object | Mapping Notes                                                                                                                                                      |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account                         | `Account`             | Direct mapping. VAOP Account covers GL accounts, bank accounts, and credit-card accounts. Type discriminator distinguishes asset/liability/equity/revenue/expense. |
| JournalEntry / ManualJournal    | `ExternalObjectRef`   | Journal entries are provider-specific in structure (line-level debits/credits). Stored as typed external references with full payload preserved.                   |
| Invoice (AR)                    | `Invoice`             | Direct mapping. `direction: receivable` flag distinguishes from bills.                                                                                             |
| Bill (AP)                       | `Invoice`             | Mapped to the same `Invoice` canonical with `direction: payable`. Allows unified invoice queries across AR and AP.                                                 |
| CreditNote                      | `Invoice`             | Mapped as `Invoice` with `type: credit`. Sign-inverted amount.                                                                                                     |
| DebitNote                       | `Invoice`             | Mapped as `Invoice` with `type: debit_note` and `direction: payable`.                                                                                              |
| Payment                         | `Payment`             | Direct mapping. Covers customer receipts and vendor payments.                                                                                                      |
| BankTransaction                 | `Payment`             | Mapped to `Payment` with `source: bank_feed`. Raw bank-feed transactions that may not yet be matched to an invoice.                                                |
| Customer / Client               | `Party`               | Mapped to `Party` with `role: customer`. Contact details normalised.                                                                                               |
| Vendor / Supplier               | `Party`               | Mapped to `Party` with `role: vendor`.                                                                                                                             |
| TaxRate                         | `ExternalObjectRef`   | Tax rates vary significantly by jurisdiction and provider; kept as external reference with structured metadata (rate, jurisdiction, components).                   |
| Currency                        | `ExternalObjectRef`   | ISO 4217 code stored as reference. Exchange rates are point-in-time and stored on the transaction, not the currency record.                                        |
| FiscalPeriod                    | `ExternalObjectRef`   | Provider-defined periods. Stored as external reference with start/end dates and status (open/closed).                                                              |
| CostCentre / Class / Department | `ExternalObjectRef`   | Dimensional tags. Stored as typed external references; VAOP does not enforce a single hierarchy.                                                                   |
| BudgetEntry                     | `ExternalObjectRef`   | Budget data is reporting-oriented and highly variable. External reference preserves provider schema.                                                               |

---

## Provider Authentication Summary

| Provider            | Auth Mechanism                       | Token Lifetime                        | Refresh                                   | Scopes                                                                                     |
| ------------------- | ------------------------------------ | ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| QuickBooks Online   | OAuth 2.0 (authorization code)       | Access: 1 hr, Refresh: 100 days       | Yes — automatic refresh supported         | `com.intuit.quickbooks.accounting`                                                         |
| Xero                | OAuth 2.0 (authorization code)       | Access: 30 min, Refresh: 60 days      | Yes — must refresh before expiry          | Per-tenant scopes: `accounting.transactions`, `accounting.settings`, `accounting.contacts` |
| Sage Intacct        | Session-based (sender ID + password) | Session: 5 min idle timeout           | N/A — new session per request recommended | Company-level access, role-based permissions                                               |
| Sage Business Cloud | OAuth 2.0                            | Access: 5 min, Refresh: 31 days       | Yes                                       | `full_access`, `readonly`                                                                  |
| FreshBooks          | OAuth 2.0 (authorization code)       | Access: variable, Refresh: long-lived | Yes                                       | Per-resource scopes                                                                        |
| Zoho Books          | OAuth 2.0 (authorization code)       | Access: 1 hr, Refresh: long-lived     | Yes                                       | `ZohoBooks.fullaccess.all` or granular                                                     |
| Wave                | OAuth 2.0                            | Access: standard                      | Yes                                       | `account:read`, `invoice:read`, `invoice:write`                                            |

---

## Notes

- **QuickBooks Online** and **Xero** together cover the vast majority of the SMB accounting market globally and should be the first two adapters implemented.
- **Sage Intacct** is the priority path for mid-market / enterprise customers given its strong US presence in the 50-500 employee segment.
- The `Invoice` canonical with a `direction` flag (receivable vs. payable) is a deliberate design choice to unify AR invoices and AP bills under one query surface, reflecting how unified accounting APIs (Merge, Rutter, Codat) model these entities.
- Journal entries are kept as `ExternalObjectRef` because the line-level debit/credit structure varies across providers (some use header + lines, some use a flat list of splits) and VAOP does not need to interpret GL mechanics — only route and store them.
- **Multi-currency handling** varies significantly: QBO uses a home currency with per-transaction exchange rates; Xero supports full multi-currency with automatic rate lookup; Sage Intacct supports inter-entity transactions across currencies. The adapter must normalise exchange rates to a consistent `amount` + `currency` + `exchange_rate` triple.
- **Rate limits** are an operational concern for bulk sync: QBO allows 500 requests per minute per realm; Xero enforces a 60-second sliding window of 60 calls; Sage Intacct varies by contract. Adapters must implement backoff and respect `Retry-After` headers.
- **Deleted records**: QBO exposes a `?minorversion=65` change-data-capture endpoint that returns deleted entity IDs; Xero returns deleted contacts and invoices via archived status; other providers require polling or full re-sync. Adapters should emit soft-delete events when a provider reports a deletion.

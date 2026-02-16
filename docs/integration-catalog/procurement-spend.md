# Port 3: Procurement & Spend — Integration Catalog

## Port Operations

| Operation              | Description                                                         | Idempotent |
| ---------------------- | ------------------------------------------------------------------- | ---------- |
| `createPurchaseOrder`  | Create a new purchase order with line items and submit for approval | No         |
| `getPurchaseOrder`     | Retrieve a purchase order by canonical ID or external ref           | Yes        |
| `approvePurchaseOrder` | Advance a PO through the approval workflow (approve or reject)      | No         |
| `listPurchaseOrders`   | Query POs by status, vendor, date range, or department              | Yes        |
| `createExpenseReport`  | Submit a new expense report with line items and receipt references  | No         |
| `getExpenseReport`     | Retrieve an expense report by ID, including line items and status   | Yes        |
| `approveExpenseReport` | Advance an expense report through the approval workflow             | No         |
| `listExpenseReports`   | List expense reports filtered by employee, status, or date range    | Yes        |
| `createVendor`         | Register a new vendor/supplier in the procurement system            | No         |
| `getVendor`            | Retrieve vendor details by ID                                       | Yes        |
| `listVendors`          | List vendors with filters (status, category, location)              | Yes        |
| `createRFQ`            | Create a request for quotation and distribute to selected vendors   | No         |
| `listContracts`        | List procurement contracts filtered by vendor, status, or expiry    | Yes        |
| `getContract`          | Retrieve a single contract by ID, including terms and line items    | Yes        |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30 % market share or >50 k customers)

| Provider      | Source                                                                                 | Adoption | Est. Customers                                                           | API Style                                                                   | Webhooks                                                                      | Key Entities                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **SAP Ariba** | S2 — SOAP and REST APIs; API gaps in sourcing modules; sandbox requires partner access | A1       | >5 M companies in the Ariba Network; ~2.5 k direct procurement customers | SOAP (cXML for network transactions), REST (JSON for newer APIs), OAuth 2.0 | Limited — asynchronous event polling via Ariba Network notifications          | PurchaseOrder, PurchaseRequisition, Supplier, Contract, Invoice, RFx, SourcingProject, SpendCategory, Receipt, Commodity                   |
| **Coupa**     | S1 — comprehensive REST API with OpenAPI spec, full sandbox environment                | A1       | >2 k enterprise customers managing >$6 T cumulative spend                | REST (JSON), OAuth 2.0 / API keys                                           | Yes — webhook-style business event notifications (Coupa Integration Platform) | PurchaseOrder, Requisition, Supplier, Invoice, Contract, ExpenseReport, Receipt, Budget, ApprovalChain, CommodityCode, Department, Account |

### Tier A2 — Strong Contenders (10-30 % share or >10 k customers)

| Provider       | Source                                                                                     | Adoption | Est. Customers                          | API Style                                                    | Webhooks                                               | Key Entities                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------ | -------- | --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **SAP Concur** | S1 — REST APIs (v3 and v4) with sandbox, OpenAPI specs                                     | A2       | >60 k customers (T&E management leader) | REST (JSON), OAuth 2.0 (company-level and user-level tokens) | Yes — event notifications via SAP Concur Event Service | ExpenseReport, ExpenseEntry, Receipt, ReceiptImage, TravelRequest, Vendor, Allocation, Attendee, CashAdvance, Policy |
| **Brex**       | S1 — REST API with sandbox, comprehensive docs                                             | A2       | >20 k business customers                | REST (JSON), API keys / OAuth 2.0                            | Yes — webhook events for transactions and expenses     | Card, Transaction, ExpensePolicy, Receipt, User, Department, Budget, Vendor, Reimbursement, Location                 |
| **Ramp**       | S1 — REST API with test environment                                                        | A2       | >25 k business customers                | REST (JSON), OAuth 2.0                                       | Yes — webhook notifications                            | Card, Transaction, Receipt, Reimbursement, User, Department, Vendor, Budget, Memo, SpendProgram, AccountingField     |
| **Expensify**  | S2 — REST API with functional gaps (reporting-focused); some operations require CSV import | A2       | >10 M users across organizations        | REST (JSON), partner credentials authentication              | Limited — polling-based integration for most workflows | Report, Expense, Receipt, Policy, Employee, Tag, Category, CorporateCard, Reimbursement                              |

### Best OSS for Domain Extraction

| Project                        | Source                               | API Style          | Key Entities                                                                                                                       | Notes                                                                                                                                                            |
| ------------------------------ | ------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ERPNext** (Frappe Framework) | S1 — self-hosted, full REST API      | REST (JSON-RPC)    | PurchaseOrder, PurchaseReceipt, PurchaseInvoice, Supplier, SupplierQuotation, RequestForQuotation, MaterialRequest, BuyingSettings | Complete procure-to-pay cycle including RFQ, PO, goods receipt, and three-way matching. ~15 k GitHub stars.                                                      |
| **Odoo** (Community Edition)   | S1 — self-hosted, XML-RPC & JSON-RPC | XML-RPC / JSON-RPC | purchase.order, purchase.order.line, res.partner (supplier flag), stock.picking, account.move, purchase.requisition                | Purchase module covers RFQ, PO, vendor bills, and receipt matching. Integrates with inventory (stock.picking) and accounting (account.move). ~35 k GitHub stars. |

### Tier A3 — Established Niche

| Provider         | Source                                                                     | Adoption | Notes                                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Procurify**    | S1 — REST API with sandbox, OAuth 2.0                                      | A3       | Cloud procurement for mid-market. Entities: PurchaseOrder, PurchaseRequest, Vendor, Budget, Account, Department, Location, Receiver, Expense. Strong approval-workflow engine.                                   |
| **Precoro**      | S1 — REST API with documentation, API key auth                             | A3       | SMB procurement platform. Entities: PurchaseOrder, PurchaseRequisition, Supplier, Budget, Invoice, Warehouse, Document, ApprovalFlow. Simple setup, quick time-to-value for smaller teams.                       |
| **Zip** (Zip HQ) | S2 — API available but documentation is partner-gated; intake-to-pay focus | A3       | Intake-to-procure orchestration layer. Entities: Request, Approval, Vendor, Contract, IntakeForm, Workflow. Often sits upstream of ERP procurement modules. API access typically requires partnership agreement. |

### Tier A4 — Emerging / Regional

| Provider                 | Source                                                                              | Adoption | Notes                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kissflow Procurement** | S2 — REST API exists but limited documentation; low-code platform with custom forms | A4       | Low-code procurement built on the Kissflow platform. Entities: PurchaseRequest, PurchaseOrder, Vendor, GoodsReceipt, Invoice. Highly configurable but non-standard entity schemas.        |
| **Tradogram**            | S2 — REST API with basic documentation; free tier available                         | A4       | Free-tier procurement tool for small organisations. Entities: PurchaseOrder, PurchaseRequest, Vendor, RFQ, Budget, Receipt. Limited API surface but good for evaluating the domain model. |

---

## Universal Entity Catalog

Every entity type observed across all providers in this domain, grouped by procurement lifecycle stage.

### Requisition & Sourcing

| Entity                  | Description                                                                                        | Observed In                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **PurchaseRequisition** | An internal request for goods or services before a PO is issued. Triggers approval workflow.       | SAP Ariba, Coupa (Requisition), ERPNext (MaterialRequest), Odoo, Procurify (PurchaseRequest), Precoro |
| **RFQ / RFx**           | A request for quotation (or broader request for proposal/information) sent to prospective vendors. | SAP Ariba (RFx), ERPNext (RequestForQuotation), Odoo (purchase.requisition), Tradogram                |
| **SourcingProject**     | A structured sourcing event grouping multiple RFx rounds and evaluations.                          | SAP Ariba                                                                                             |

### Purchase Orders & Contracts

| Entity                 | Description                                                                           | Observed In                                                |
| ---------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **PurchaseOrder**      | A formal order to a vendor specifying items, quantities, prices, and delivery terms.  | All procurement providers                                  |
| **PurchaseOrder Line** | An individual line item on a PO with quantity, unit price, and item reference.        | All providers (modelled as sub-resource or embedded array) |
| **Contract**           | A long-term agreement with a vendor governing pricing, volume commitments, and terms. | SAP Ariba, Coupa, Zip, Procurify                           |
| **ApprovalChain**      | The sequence of approvers and rules governing PO/requisition approval.                | Coupa, Procurify, Precoro, Kissflow                        |

### Vendor Management

| Entity                            | Description                                                                                                         | Observed In                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Supplier / Vendor**             | The external party providing goods or services. Includes onboarding status, payment terms, and risk classification. | All providers                                               |
| **SpendCategory / CommodityCode** | A classification taxonomy for spend analytics (e.g., UNSPSC codes).                                                 | SAP Ariba (SpendCategory, Commodity), Coupa (CommodityCode) |

### Expense Management

| Entity                  | Description                                                                                   | Observed In                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **ExpenseReport**       | A collection of expense entries submitted by an employee for reimbursement or reconciliation. | Coupa, SAP Concur, Expensify (Report), Procurify                                       |
| **ExpenseEntry / Line** | A single expense item within a report, including amount, category, date, and merchant.        | SAP Concur (ExpenseEntry), Expensify (Expense), Brex (Transaction), Ramp (Transaction) |
| **Receipt**             | An image or digital proof of purchase attached to an expense entry.                           | SAP Concur, Brex, Ramp, Expensify, Coupa, ERPNext                                      |
| **Reimbursement**       | A payment to an employee for approved out-of-pocket expenses.                                 | Ramp, Expensify, Brex                                                                  |

### Corporate Cards & Budgets

| Entity          | Description                                                                     | Observed In                                      |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Card**        | A physical or virtual corporate card issued to an employee with spend controls. | Brex, Ramp, Expensify (CorporateCard)            |
| **Transaction** | A card transaction or bank transaction associated with corporate spend.         | Brex, Ramp, Expensify                            |
| **Budget**      | An allocated spend limit by department, project, or vendor for a given period.  | Coupa, Brex, Ramp, Procurify, Precoro, Tradogram |

### Goods Receipt & Invoice

| Entity                    | Description                                                                                   | Observed In                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **GoodsReceipt**          | Confirmation that goods from a PO have been physically received, enabling three-way matching. | SAP Ariba (Receipt), ERPNext (PurchaseReceipt), Odoo (stock.picking), Kissflow |
| **Invoice (Procurement)** | A vendor invoice submitted against a PO, used in two-way or three-way matching.               | SAP Ariba, Coupa, ERPNext (PurchaseInvoice), Odoo (account.move), Precoro      |

---

## VAOP Canonical Mapping

| Universal Entity              | VAOP Canonical Object | Mapping Notes                                                                                                                                                                                            |
| ----------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PurchaseOrder                 | `Order`               | Mapped to `Order` with `type: purchase`. Line items preserved as embedded array. Status reflects approval lifecycle (draft, pending_approval, approved, sent, received, closed).                         |
| PurchaseOrder Line            | `Order` (embedded)    | Line items are embedded within the `Order` canonical, not standalone objects. Each line carries item reference, quantity, unit price, and tax.                                                           |
| PurchaseRequisition           | `Order`               | Mapped to `Order` with `type: requisition`. Represents the pre-PO request. Approval status tracked. Converts to a PO upon full approval.                                                                 |
| Supplier / Vendor             | `Party`               | Mapped to `Party` with `role: vendor`. Normalised fields include name, tax ID, payment terms, address, and onboarding status.                                                                            |
| Contract                      | `Subscription`        | Mapped to `Subscription` as a time-bound agreement with a vendor. Start/end dates, renewal terms, and value caps are preserved. Line-item schedules stored as embedded data.                             |
| ExpenseReport                 | `ExternalObjectRef`   | Expense reports are structurally unique to spend-management providers and include approval workflows, policy checks, and multi-line breakdowns. Stored as typed external reference with status metadata. |
| ExpenseEntry / Line           | `ExternalObjectRef`   | Individual expense lines are children of the report. Stored as external references linked to the parent report reference.                                                                                |
| Receipt                       | `Document`            | Mapped to `Document` with `type: receipt`. Stores the image/PDF reference, OCR-extracted metadata (merchant, amount, date), and link to the parent expense entry or PO.                                  |
| RFQ / RFx                     | `ExternalObjectRef`   | RFQ structures vary significantly (single-round vs. multi-round, sealed bid vs. open). Stored as external reference with status and vendor-response metadata.                                            |
| SourcingProject               | `ExternalObjectRef`   | Complex sourcing events are provider-specific. External reference preserves the full event structure.                                                                                                    |
| Budget                        | `ExternalObjectRef`   | Budget allocations are dimensional (by department, vendor, category, period) and enforcement rules vary by provider. External reference with structured metadata.                                        |
| ApprovalChain                 | `ExternalObjectRef`   | Approval workflows are deeply provider-specific (sequential, parallel, threshold-based, role-based). Stored as external reference. VAOP does not re-implement approval logic.                            |
| SpendCategory / CommodityCode | `ExternalObjectRef`   | Classification taxonomies (UNSPSC, custom) stored as external references. Used for analytics and routing, not core domain logic.                                                                         |
| Card                          | `ExternalObjectRef`   | Corporate cards are provider-managed instruments with spend controls. External reference stores masked card number, cardholder, and spend-limit metadata.                                                |
| Transaction                   | `Payment`             | Card/bank transactions map to `Payment`. `source: corporate_card` or `source: bank` distinguishes from customer-facing payments. Links to expense report if reconciled.                                  |
| GoodsReceipt                  | `ExternalObjectRef`   | Goods receipts are part of the three-way matching process (PO, receipt, invoice). Stored as external reference linked to the parent `Order`.                                                             |
| Invoice (Procurement)         | `Invoice`             | Mapped to `Invoice` with `direction: payable` and `source: procurement`. Links to the originating `Order` (PO) for matching. Same canonical as Port 1 AP bills.                                          |
| Reimbursement                 | `Payment`             | Mapped to `Payment` with `type: reimbursement`. Represents funds returned to an employee for approved expenses. Links to the parent expense report external reference.                                   |

---

## Notes

- **SAP Ariba** and **Coupa** dominate enterprise procurement and should be the first two adapters implemented. Ariba's cXML-based network transactions require a specialised parser distinct from its REST APIs.
- The **expense management** sub-domain (Concur, Brex, Ramp, Expensify) overlaps with procurement but has a distinct entity model centred on employee-submitted reports rather than PO-driven workflows. VAOP treats these as separate adapter families under the same port.
- **Three-way matching** (PO vs. goods receipt vs. vendor invoice) is a critical procurement workflow. VAOP does not implement matching logic but must preserve the linkages between `Order`, `ExternalObjectRef` (goods receipt), and `Invoice` so downstream systems can perform matching.
- **Contracts** are mapped to `Subscription` because they represent time-bound, recurring commercial relationships with vendors — analogous to how customer subscriptions work in Port 2. The `Subscription` canonical is extended with procurement-specific fields (value cap, renewal type, spend-to-date).
- Corporate card providers (Brex, Ramp) blur the line between payments and procurement. Their transactions appear in this port when they represent corporate spend, but the same providers could surface in Port 2 for their payment-processing capabilities. The VAOP adapter resolves this by routing based on the business context of the integration.

# Port 5: Payroll — Integration Catalog

> Payroll runs, tax calculations, pay stubs, deductions, earnings, and contractor payments.

---

## Port Operations

| Operation                  | Description                                                                          | Idempotent | Webhook-Eligible |
| -------------------------- | ------------------------------------------------------------------------------------ | ---------- | ---------------- |
| `runPayroll`               | Initiate a payroll run for a given pay period and pay group                          | No         | Yes              |
| `getPayrollRun`            | Retrieve the status and summary of a specific payroll run                            | Yes        | —                |
| `listPayrollRuns`          | Paginated list of payroll runs with optional filters (date range, status, pay group) | Yes        | —                |
| `getPayStub`               | Retrieve a single pay stub / pay statement for an employee and pay period            | Yes        | —                |
| `listPayStubs`             | List pay stubs for an employee or across the company for a pay period                | Yes        | —                |
| `calculateTax`             | Calculate federal, state, and local tax withholdings for a given compensation amount | Yes        | —                |
| `getPaySchedule`           | Retrieve the pay schedule (frequency, next run date, cut-off dates)                  | Yes        | —                |
| `listDeductions`           | List all deduction types and active deductions (pre-tax, post-tax, garnishments)     | Yes        | —                |
| `listEarnings`             | List all earning types and active earnings (regular, overtime, bonus, commission)    | Yes        | —                |
| `submitPayrollForApproval` | Submit a draft payroll run for manager/admin approval                                | No         | Yes              |
| `approvePayroll`           | Approve a submitted payroll run, triggering final processing                         | No         | Yes              |
| `listContractorPayments`   | List payments made to independent contractors / 1099 workers                         | Yes        | —                |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (MVP / P0)

| Provider  | Source | Adoption | Est. Customers                                               | API Style                                                                                                                                             | Webhooks                                                                                   | Key Entities                                                                                          |
| --------- | ------ | -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **ADP**   | S2     | A1       | ~1,000,000+ clients globally (RUN + Workforce Now + Vantage) | REST (ADP API Central). OAuth 2.0 with X.509 certificate auth. No official OpenAPI spec; Swagger-style docs on developer portal. Heavy rate-limiting. | Limited (ADP Marketplace event notifications — payroll completed, pay statement available) | PayStatement, PayPeriod, Earning, Deduction, Tax, Worker, PayrollRun, GarnishmentOrder, DirectDeposit |
| **Gusto** | S1     | A1       | ~300,000+ US businesses                                      | REST with OpenAPI spec. Full sandbox environment. Embedded payroll API for partners. Clean, well-documented endpoints.                                | Yes (payroll processed, pay period updated, employee tax setup changed)                    | Payroll, PayPeriod, Employee, Earning, Deduction, Tax, ContractorPayment, BankAccount                 |

### Tier A2 — Must-Support Providers (P1)

| Provider      | Source | Adoption | Est. Customers                                      | API Style                                                                                                                                         | Webhooks                                                    | Key Entities                                                           |
| ------------- | ------ | -------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Paychex**   | S2     | A2       | ~730,000+ clients (US)                              | REST (Paychex Flex API). Limited endpoint coverage — focuses on payroll reads; write operations require partner approval. No public OpenAPI spec. | No (polling required)                                       | Check, Earning, Deduction, Tax, Worker, Company, PayPeriod             |
| **Paylocity** | S2     | A2       | ~36,000+ clients (US mid-market / enterprise)       | REST (Paylocity API v2). Available through partner programme. Decent documentation but no public OpenAPI spec.                                    | Limited (custom integration events)                         | PayStatement, Earning, Deduction, Tax, Employee, PayGroup              |
| **Rippling**  | S1     | A2       | ~10,000+ businesses                                 | REST with published API docs. Unified platform — HRIS, IT, and Payroll share the same employee model. Sandbox available.                          | Yes (payroll run completed, pay statement generated)        | PayRun, PayStatement, Employee, Earning, Deduction, Tax                |
| **Deel**      | S1     | A2       | ~25,000+ businesses (global contractor / EOR focus) | REST with published OpenAPI spec. Sandbox environment available. Focuses on international contractor payments and employer-of-record payroll.     | Yes (payment completed, contract signed, invoice generated) | Contract, Invoice, Payment, Employee, Contractor, Milestone, TimeSheet |

### Best OSS for Domain Extraction

| Project             | Source | API Style                                                                          | Key Entities                                                                       | Notes                                                                                                                                                                                  |
| ------------------- | ------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ERPNext Payroll** | S1     | REST (Frappe API — full CRUD on all doctypes). Auto-generated API docs. Python/JS. | PayrollEntry, SalarySlip, SalaryComponent, SalaryStructure, Employee, PaymentEntry | Part of the ERPNext ecosystem. Comprehensive payroll module supporting multiple countries' tax rules. Excellent reference for entity modelling. Active open-source community.          |
| **Odoo Payroll**    | S1     | XML-RPC / JSON-RPC (Odoo external API). Models exposed as Python classes.          | hr.payslip, hr.payslip.run, hr.salary.rule, hr.contract, hr.employee               | Odoo 17+ includes a payroll module (previously Enterprise-only, now partially open). Rich entity model with salary rules engine. Useful for understanding European payroll structures. |

### Tier A3/A4 — Long-Tail Candidates

| Provider          | Source | Adoption | Notes                                                                                                                                                             |
| ----------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OnPay**         | S1     | A3       | US SMB payroll provider. Clean REST API with OpenAPI spec. ~10k+ clients. Good candidate for SMB-focused deployments. Simple entity model.                        |
| **Papaya Global** | S1     | A3       | Global payroll platform supporting 160+ countries. REST API with sandbox. Focuses on multi-country payroll consolidation. Growing enterprise adoption.            |
| **Remote.com**    | S1     | A3       | Employer-of-record (EOR) and global payroll. REST API with published docs. Competes with Deel in the global contractor/EOR space.                                 |
| **Sage Payroll**  | S2     | A4       | UK/EU-focused payroll. Sage Business Cloud Payroll API. REST but limited documentation. Strong presence in UK market (~400k+ UK businesses across Sage products). |
| **GreytHR**       | S3     | A4       | India-focused payroll and HRIS. Community SDK only. ~20k+ Indian businesses. Regional player with deep India payroll compliance (PF, ESI, TDS).                   |

---

## Universal Entity Catalog

Every entity type observed across all payroll providers, grouped by functional domain.

### Payroll Run & Processing

| Entity         | Also Known As                             | Observed In                         |
| -------------- | ----------------------------------------- | ----------------------------------- |
| **PayrollRun** | Payroll, PayRun, PayslipRun, PayrollBatch | ADP, Gusto, Rippling, ERPNext, Odoo |
| **PayPeriod**  | PaySchedule, PayCycle, PayFrequency       | All providers                       |
| **PayGroup**   | PayrollGroup, RunGroup, EmployeeGroup     | Paylocity, ADP, Paychex             |

### Pay Statements

| Entity               | Also Known As                                                  | Observed In             |
| -------------------- | -------------------------------------------------------------- | ----------------------- |
| **PayStatement**     | PayStub, PaySlip, SalarySlip, Check                            | All providers           |
| **Earning**          | EarningType, EarningLine, SalaryComponent (type:earning)       | All providers           |
| **Deduction**        | DeductionType, DeductionLine, SalaryComponent (type:deduction) | All providers           |
| **Tax**              | TaxFiling, TaxWithholding, TaxLine, W2, Form1099               | All providers           |
| **GarnishmentOrder** | CourtOrder, WageGarnishment, LevyOrder                         | ADP, Paychex, Paylocity |

### Compensation Structure

| Entity              | Also Known As                              | Observed In                                    |
| ------------------- | ------------------------------------------ | ---------------------------------------------- |
| **SalaryStructure** | CompensationPlan, PayStructure, SalaryRule | ERPNext, Odoo, ADP                             |
| **SalaryComponent** | EarningType, DeductionType, PayComponent   | ERPNext, Odoo                                  |
| **Benefit**         | BenefitDeduction, EmployerContribution     | Gusto, ADP, Paylocity (overlap with HRIS port) |

### Payment & Banking

| Entity                | Also Known As                                 | Observed In                    |
| --------------------- | --------------------------------------------- | ------------------------------ |
| **DirectDeposit**     | BankAccount, PaymentMethod, ACHInfo           | ADP, Gusto, Paychex, Paylocity |
| **ContractorPayment** | 1099Payment, FreelancerPayment, VendorPayment | Gusto, Deel, Remote.com        |
| **PaymentEntry**      | PaymentRecord, Disbursement                   | ERPNext, Deel                  |

### People & Time

| Entity        | Also Known As                       | Observed In            |
| ------------- | ----------------------------------- | ---------------------- |
| **Worker**    | Employee, Person, Staff             | All providers          |
| **TimeSheet** | TimeCard, HoursWorked, TimeEntry    | Deel, ERPNext, ADP     |
| **Contract**  | EmploymentContract, WorkerAgreement | Deel, Remote.com, Odoo |

---

## VAOP Canonical Mapping

Each universal entity is mapped to the VAOP canonical object that best captures its cross-system semantics. Entities too domain-specific for a canonical object are referenced via `ExternalObjectRef`.

| Universal Entity            | VAOP Canonical Object | Canonical Role / Type | Notes                                                                                                                             |
| --------------------------- | --------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Worker / Employee           | **Party**             | `role: employee`      | Shared identity with HRIS port (Port 4). Single Party record, multiple role tags.                                                 |
| PayrollRun                  | **ExternalObjectRef** | —                     | Payroll run is a domain-specific batch process. Deep-linked to SoR for audit trail.                                               |
| PayStatement / PayStub      | **ExternalObjectRef** | —                     | Pay statements are provider-specific documents. Preserved as opaque references with key metadata (net pay, pay period, employee). |
| PayPeriod / PaySchedule     | **ExternalObjectRef** | —                     | Pay frequency and schedule configuration.                                                                                         |
| Earning / EarningType       | **ExternalObjectRef** | —                     | Earning line items (regular, overtime, bonus, commission). Too granular for a canonical object.                                   |
| Deduction / DeductionType   | **ExternalObjectRef** | —                     | Deduction line items (health insurance, 401k, garnishment). Too granular for a canonical object.                                  |
| Tax / TaxFiling             | **ExternalObjectRef** | —                     | Tax withholding and filing records. Highly jurisdiction-specific.                                                                 |
| DirectDeposit / BankAccount | **ExternalObjectRef** | —                     | Sensitive banking information. Stored as reference only; actual account data stays in SoR.                                        |
| GarnishmentOrder            | **ExternalObjectRef** | —                     | Court-ordered wage garnishments. Legal compliance entity.                                                                         |
| ContractorPayment           | **Payment**           | —                     | Contractor payments map naturally to the Payment canonical object (amount, date, recipient, status).                              |
| SalaryStructure / Component | **ExternalObjectRef** | —                     | Compensation structure templates. Provider-specific configuration.                                                                |
| Benefit                     | **ExternalObjectRef** | —                     | Benefit deductions that overlap with HRIS port. Cross-referenced via ExternalObjectRef to avoid duplication.                      |
| TimeSheet                   | **ExternalObjectRef** | —                     | Time entries feeding into payroll calculations. May cross-reference projects port (Port 14).                                      |
| PayGroup                    | **ExternalObjectRef** | —                     | Grouping mechanism for payroll processing batches.                                                                                |
| Contract                    | **ExternalObjectRef** | —                     | Employment or contractor agreements. May overlap with documents port.                                                             |

---

## Sync Strategy Considerations

| Strategy                     | When to Use                                                                     | Providers                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Full sync (initial)**      | First-time connection; rebuilding after data loss                               | All providers — use bulk endpoints where available (ADP bulk worker read, Gusto company payrolls list)                            |
| **Incremental sync (delta)** | Ongoing synchronisation of pay runs and statements after each payroll cycle     | Gusto (processed_date filter), ADP (event queue polling), Rippling (cursor-based with updated_at), Paylocity (date-range queries) |
| **Webhook-driven**           | Real-time notification when a payroll run completes or a pay statement is ready | Gusto, Rippling, Deel — all emit payroll lifecycle webhooks                                                                       |
| **Polling fallback**         | Providers without webhooks or with unreliable webhook delivery                  | ADP (poll event notification API), Paychex (no webhooks — polling required), Paylocity (limited webhooks)                         |

### Recommended Sync Cadence

- **Payroll runs**: Event-driven (webhook on completion) with daily reconciliation poll
- **Pay statements**: Sync within 1 hour of payroll run completion
- **Deductions / earnings configuration**: Daily (changes are infrequent outside open enrolment)
- **Tax setup**: Daily (jurisdiction changes are rare but compliance-critical)
- **Contractor payments**: Event-driven or weekly batch sync depending on payment frequency

---

## Cross-Port References

| Related Port                 | Relationship                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Port 4: HRIS & HCM           | Employee/Worker identity is shared. Compensation, benefits, and time-off data originate in HRIS and flow into payroll. |
| Port 1: Finance & Accounting | Payroll journal entries post to the general ledger. PayrollRun completion may trigger GL postings.                     |
| Port 2: Payments & Billing   | ContractorPayments may flow through payment processing infrastructure.                                                 |
| Port 18: Compliance & GRC    | Tax filings, garnishment orders, and payroll compliance records feed into GRC reporting.                               |

---

## Implementation Notes

1. **ADP certificate management** — ADP's OAuth 2.0 flow requires X.509 certificates for two-legged authentication. The adapter must handle certificate storage, rotation, and renewal. Consider integrating with Port 10 (Secrets & Vaulting) for certificate lifecycle management.
2. **Payroll run idempotency** — `runPayroll` is inherently non-idempotent and has significant financial impact. The adapter must implement strong deduplication (idempotency keys) and require explicit confirmation before processing. A failed-then-retried payroll run must never result in duplicate payments.
3. **Tax jurisdiction complexity** — US payroll alone involves federal, state, and local tax calculations across 50+ jurisdictions. The `calculateTax` operation should delegate to the SoR's native tax engine rather than attempting to replicate tax logic in VAOP.
4. **Sensitive data handling** — Pay stubs, bank account details, and tax information are PII/sensitive. The adapter should minimise data retention, avoid logging sensitive fields, and ensure all canonical references strip or mask sensitive values (e.g., last-four of SSN/bank account only).
5. **Multi-country payroll** — Providers like Deel, Papaya Global, and Remote.com handle multi-country payroll with jurisdiction-specific entities (statutory deductions, social contributions, local tax codes). The adapter should preserve country-specific fields as opaque metadata within `ExternalObjectRef` payloads.
6. **Approval workflows** — `submitPayrollForApproval` and `approvePayroll` model a two-step approval flow. Not all providers expose this natively (some process payroll immediately on submission). The adapter should simulate approval semantics where the SoR lacks native support.
7. **Off-cycle payroll** — Some providers support off-cycle or supplemental payroll runs (e.g., bonus runs, correction runs). The `runPayroll` operation should accept a `type` parameter (regular, supplemental, correction) and map it to the provider's off-cycle mechanism. ADP and Gusto both support this natively; Paychex requires manual intervention.
8. **Payroll journal entries** — When a payroll run completes, the adapter should be capable of emitting a `PayrollCompleted` domain event containing summary totals (gross pay, net pay, employer taxes, deductions) that Port 1 (Finance & Accounting) can consume to create GL journal entries. The event should include enough detail for double-entry posting without exposing individual employee data.
9. **Retroactive adjustments** — Retroactive pay adjustments (back pay, correction of prior period errors) are handled differently across providers. ADP processes them as adjustments in the current period; Gusto supports explicit retro pay runs. The adapter must clearly tag retroactive items in the canonical payload to prevent double-counting in financial reporting.

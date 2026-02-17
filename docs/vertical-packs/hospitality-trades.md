# Hospitality & Trades Vertical Pack

> Pack IDs: `hospo-venues` (namespace: `hospo.*`), `trade-fieldservice` (namespace: `trade.*`) | Status: Design phase

This document is the comprehensive reference for the Portarium hospitality and trades/field service vertical packs. These two domains are documented together because they share operational patterns (shift-based work, mobile field operations, financial reconciliation) and common connectors (accounting, payroll), but ship as separate packs with independent versioning.

---

## Hospitality Domain

### POS Integration

Point-of-sale systems are the operational heart of hospitality venues. The `hospo-venues` pack integrates with major POS platforms for menu management, order tracking, and payment reconciliation.

#### Square (Orders + Catalog API)

- **Protocol**: REST API (Square Connect v2)
- **Auth**: OAuth 2.0 (authorization code flow)
- **Key endpoints**: Catalog API (items, modifiers, categories, taxes, discounts), Orders API (create/update/retrieve orders), Payments API (charges, refunds, tenders), Locations API
- **Webhook support**: Yes -- order events, payment events, catalog updates
- **Sandbox**: Yes (Square Sandbox environment)
- **API quality**: S1 -- OpenAPI spec, comprehensive sandbox, webhooks, idempotency keys

#### Toast (Orders API)

- **Protocol**: REST API with OpenAPI specification
- **Auth**: OAuth 2.0 (client credentials)
- **Key endpoints**: Orders API (orders, checks, selections, payments), Menu API (menus, groups, items, modifiers), Restaurant API (locations, revenue centres)
- **Webhook support**: Yes -- order lifecycle events
- **Sandbox**: Yes (Toast Developer Sandbox)
- **API quality**: S1 -- OpenAPI spec, sandbox, webhooks

#### Lightspeed K-Series (formerly Kounta)

- **Protocol**: REST API
- **Auth**: OAuth 2.0
- **Key endpoints**: Products, categories, orders, payments, locations, registers
- **Webhook support**: Limited
- **Sandbox**: Developer test accounts
- **API quality**: S2 -- REST API documented, limited webhook support

### Workforce Management

#### Deputy (Rosters, Timesheets, Payroll Integration)

- **Protocol**: REST API
- **Auth**: OAuth 2.0
- **Key endpoints**: Rosters/schedules, timesheets (clock in/out, breaks), leave management, employee profiles, locations
- **Webhook support**: Yes -- timesheet and roster events
- **Payroll export**: Integrates with payroll providers (Xero, MYOB, ADP)
- **API quality**: S1 -- REST API, OAuth, webhooks, well-documented

### Accounting

#### Xero (Payroll, Timesheets, Invoices)

- **Protocol**: REST API
- **Auth**: OAuth 2.0 (PKCE)
- **Key endpoints**: Payroll AU/NZ/UK (employees, pay runs, leave, timesheets), Invoices, Contacts, Accounts, Bank Transactions
- **Webhook support**: Yes -- invoice and contact events
- **Sandbox**: Demo company
- **API quality**: S1 -- OpenAPI spec, sandbox, webhooks, comprehensive documentation

---

## Trades / Field Service Domain

### ServiceM8

- **Protocol**: REST API
- **Auth**: OAuth 2.0 or API key (per-account)
- **Key endpoints**: Jobs (create, update, status), Clients, Quotes, Invoices, Job materials, Staff, Attachments (photos, signatures), Job queues, Forms
- **Webhook support**: Yes -- job status changes
- **Sandbox**: Test accounts
- **API quality**: S2 -- REST documented, some gaps in API coverage for newer features

### Jobber

- **Protocol**: GraphQL API
- **Auth**: OAuth 2.0
- **Key endpoints (GraphQL)**: Clients, Properties, Jobs (one-off, recurring), Visits, Quotes, Invoices, Payments, Line Items, Custom Fields, Time Tracking
- **Webhook support**: Yes -- via app webhooks
- **Sandbox**: Developer test accounts
- **API quality**: S1 -- GraphQL with introspection, OAuth, webhooks

### QuickBooks Online

- **Protocol**: REST API
- **Auth**: OAuth 2.0
- **Key endpoints**: Invoices, Payments, Customers, Items/Services, Estimates, Bills, Purchase Orders, Time Activities, Employees
- **Webhook support**: Yes -- entity change events
- **Sandbox**: Yes (Intuit Developer Sandbox)
- **API quality**: S1 -- OpenAPI spec, comprehensive sandbox, webhooks, idempotency

---

## Common Hospitality Entities

| Entity           | Description                                | Key Attributes                                                                 |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| Venue / Location | A physical hospitality premises            | Name, address, type (restaurant/bar/cafe), operating hours, POS system         |
| Menu Catalogue   | Hierarchical product structure             | Items, modifiers, categories, tax rates, pricing tiers, availability windows   |
| Menu Item        | A sellable product or service              | Name, SKU, price, modifiers, category, tax class, dietary flags, active status |
| Menu Modifier    | An add-on or customisation for a menu item | Name, price delta, modifier group, min/max selections                          |
| Order / Check    | A customer transaction at a venue          | Items ordered, modifiers applied, status, table/seat, server, timestamps       |
| Payment          | A financial settlement                     | Tender type (card/cash/voucher), amount, tip, surcharge, refund status         |
| Customer         | A venue patron (optional loyalty/profile)  | Name, contact, visit history, loyalty tier, dietary preferences                |
| Staff            | Venue personnel                            | Role (server/cook/manager), employment type, certifications (RSA, food safety) |
| Shift / Roster   | A scheduled work period                    | Staff member, start/end time, location, role, break entitlements               |
| Timesheet        | Actual hours worked                        | Clock in/out, breaks taken, approved status, pay rate, overtime                |
| Supplier         | Goods/services provider to the venue       | Contact details, payment terms, product categories                             |
| Purchase Order   | Order placed with a supplier               | Items, quantities, costs, delivery date, received status                       |
| Inventory        | Stock on hand                              | Item, quantity, location, reorder point, last count date                       |

---

## Common Trades / Field Service Entities

| Entity               | Description                                 | Key Attributes                                                                  |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Client               | A customer (residential or commercial)      | Name, contact, billing address, payment terms, notes                            |
| Property / Site      | A physical location where work is performed | Address, access instructions, site contacts, hazard notes                       |
| Job / Work Order     | A unit of work to be completed              | Client, property, description, status, priority, scheduled date, assigned staff |
| Visit                | A single attendance at a job site           | Job reference, staff, arrival/departure, work performed, status                 |
| Quote / Estimate     | A priced proposal for work                  | Client, line items (labour, materials), total, validity, acceptance status      |
| Invoice              | A bill for completed work                   | Client, job reference, line items, tax, total, due date, payment status         |
| Payment              | A financial settlement against an invoice   | Amount, method, date, reference, invoice link                                   |
| Materials / Parts    | Physical goods used in a job                | Item description, quantity, unit cost, supplier, job allocation                 |
| Time Spent           | Labour time recorded against a job          | Staff, job, hours, rate, billable flag, date                                    |
| Signature / Evidence | Digital capture of completion or approval   | Image data, signatory name, timestamp, GPS coordinates, job link                |

---

## Entity Mapping to Portarium Core Extension Points

### Hospitality Mappings

| Hospitality Entity | Core Extension Point         | Pack Extension         | Notes                                                                    |
| ------------------ | ---------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| Venue / Location   | `core.organisation`          | `hospo.venue`          | Extends Organisation with venue type, operating hours, POS config        |
| Menu Item          | `core.asset`                 | `hospo.menu_item`      | Extends Asset with pricing, modifiers, dietary flags, availability       |
| Menu Modifier      | `core.asset`                 | `hospo.modifier`       | Extends Asset with modifier group, price delta, selection rules          |
| Order / Check      | `core.transaction`           | `hospo.order`          | Extends Transaction with table, server, item lines, check status         |
| Payment            | `core.financial_transaction` | `hospo.payment`        | Extends FinancialTransaction with tender type, tip, surcharge            |
| Shift / Roster     | `core.event`                 | `hospo.shift`          | Extends Event with staff assignment, role, break entitlements            |
| Timesheet          | `core.record`                | `hospo.timesheet`      | Extends Record with clock times, breaks, approval status, pay rate       |
| Staff              | `core.person`                | `hospo.staff_profile`  | Extends Person with certifications (RSA, food safety), venue assignments |
| Supplier           | `core.person`                | `hospo.supplier`       | Extends Person (org role) with payment terms, product categories         |
| Customer           | `core.person`                | `hospo.customer`       | Extends Person with loyalty tier, dietary preferences, visit history     |
| Inventory          | `core.asset`                 | `hospo.inventory_item` | Extends Asset with stock quantity, reorder point, supplier link          |

### Trades / Field Service Mappings

| Trades Entity        | Core Extension Point         | Pack Extension          | Notes                                                                 |
| -------------------- | ---------------------------- | ----------------------- | --------------------------------------------------------------------- |
| Client               | `core.person`                | `trade.client`          | Extends Person with properties, payment terms, job history            |
| Property / Site      | `core.organisation_unit`     | `trade.property`        | Extends OrganisationUnit with access instructions, hazard notes       |
| Job / Work Order     | `core.record`                | `trade.job`             | Extends Record with status, priority, scheduling, assigned staff      |
| Visit                | `core.event`                 | `trade.visit`           | Extends Event with arrival/departure, work summary, GPS               |
| Quote / Estimate     | `core.record`                | `trade.quote`           | Extends Record with line items, validity, acceptance workflow         |
| Invoice              | `core.financial_transaction` | `trade.invoice`         | Extends FinancialTransaction with job link, line items, payment terms |
| Payment              | `core.financial_transaction` | `trade.payment`         | Extends FinancialTransaction with method, invoice link                |
| Materials / Parts    | `core.asset`                 | `trade.material`        | Extends Asset with supplier, job allocation, unit cost                |
| Signature / Evidence | `core.evidence_object`       | `trade.field_signature` | Extends EvidenceObject with image, signatory, GPS, timestamp          |

---

## Required Connectors

| Connector           | Protocol       | Auth Model                     | Key Operations                                            | Pack                 |
| ------------------- | -------------- | ------------------------------ | --------------------------------------------------------- | -------------------- |
| Square REST         | REST           | OAuth 2.0                      | Catalog CRUD, orders, payments, locations                 | `hospo-venues`       |
| Toast REST          | REST (OpenAPI) | OAuth 2.0 (client credentials) | Menu, orders, checks, payments, restaurants               | `hospo-venues`       |
| Lightspeed K-Series | REST           | OAuth 2.0                      | Products, orders, payments, locations                     | `hospo-venues`       |
| Deputy REST         | REST           | OAuth 2.0                      | Rosters, timesheets, leave, employees                     | `hospo-venues`       |
| ServiceM8 REST      | REST           | OAuth 2.0 / API key            | Jobs, clients, quotes, invoices, forms, attachments       | `trade-fieldservice` |
| Jobber GraphQL      | GraphQL        | OAuth 2.0                      | Clients, jobs, visits, quotes, invoices, payments         | `trade-fieldservice` |
| Xero REST           | REST           | OAuth 2.0 (PKCE)               | Payroll, timesheets, invoices, contacts, accounts         | Both                 |
| QuickBooks REST     | REST           | OAuth 2.0                      | Invoices, payments, customers, estimates, time activities | Both                 |

---

## Key Workflows

### 1. Menu Update Approval

Changes to menu items, pricing, or availability in the POS require governance in multi-venue operations.

- **Trigger**: Staff submits menu change via UI template or POS webhook detects change.
- **Steps**: Validate change against `hospo.menu_item` schema -> Policy gate (auto for price adjustments within threshold, human-approve for new items or large price changes) -> On approval: transform to POS format -> Sync to POS connector (Square/Toast/Lightspeed) -> Capture evidence (before/after menu state, approval record).
- **Multi-venue**: Changes can be scoped to a single venue or propagated across all venues with per-venue confirmation.

### 2. Daily Close / Reconciliation

End-of-day financial reconciliation across POS, payments, and accounting.

- **Trigger**: Scheduled (end of trading day) or manual (manager initiates close).
- **Steps**: Pull orders and payments from POS connector -> Aggregate by tender type, tax category, revenue centre -> Compare against expected totals -> Flag discrepancies above threshold -> Policy gate (human-approve if discrepancies exceed tolerance) -> On approval: post journal entries to accounting connector (Xero/QuickBooks) -> Capture evidence (reconciliation summary, discrepancy notes, POS totals, accounting postings).

### 3. Shift-to-Payroll

Approved timesheets flow from workforce management to payroll.

- **Trigger**: Timesheet approval event from Deputy or manual timesheet submission.
- **Steps**: Validate timesheet against `hospo.timesheet` schema -> Check shift roster for discrepancies (early/late, missed breaks) -> Policy gate (auto for clean timesheets, human-approve for overtime or discrepancies) -> Transform to payroll format -> Sync to payroll connector (Xero Payroll) -> Capture evidence (timesheet, approval, payroll submission confirmation).

### 4. Food Safety Incident Log

Mandatory incident recording for food safety compliance.

- **Trigger**: Manual (staff logs incident via mobile UI).
- **Steps**: Validate against `hospo.incident_record` schema -> Classify severity (minor/major/critical) -> If critical: immediate escalation to venue manager and food safety officer -> Record corrective actions -> If regulatory threshold met: generate regulatory notification draft -> Policy gate (human-approve for regulatory notifications) -> Capture evidence (incident details, corrective actions, temperature logs, photos).

### 5. Quote-to-Cash (Trades)

The full lifecycle from customer enquiry to paid invoice.

- **Trigger**: New job request (client call, online form, or field service app).
- **Steps**: Create client/property records (`trade.client`, `trade.property`) -> Generate quote (`trade.quote`) from job template with line items -> Send quote to client for acceptance -> On acceptance: create job (`trade.job`) and schedule visits -> Field staff complete visits (`trade.visit`) with time, materials, photos, signatures -> Generate invoice (`trade.invoice`) from job actuals -> Sync invoice to accounting connector (Xero/QuickBooks) -> Track payment -> Capture evidence at each stage.

### 6. Field Completion Pack

End-of-job documentation and sign-off for trades work.

- **Trigger**: Field staff marks job as complete in field service app.
- **Steps**: Validate completion: all visits closed, materials logged, time recorded -> Collect customer signature (`trade.field_signature`) -> Attach photos of completed work -> Generate completion certificate from UI template -> Policy gate (auto for standard jobs, human-approve for high-value or warranty work) -> Sync completion status to field service connector (ServiceM8/Jobber) -> Generate and sync invoice -> Capture evidence (signature, photos, completion certificate, invoice).

---

## Regulatory Constraints

### PCI DSS (Payment Card Industry Data Security Standard)

- **Scope**: Any system that stores, processes, or transmits cardholder data.
- **Portarium approach**: Portarium does **not** store, process, or transmit raw card data. All payment integrations use provider tokenisation (Square, Toast, Lightspeed handle card processing). Portarium stores only token references, transaction IDs, and settlement amounts.
- **Pack compliance profile**: `hospo.pci-boundary` -- documents the tokenisation boundary, prohibits raw card data in schema extensions, enforces that connector mappings never extract card numbers or CVVs.
- **Evidence**: Payment reconciliation workflows capture transaction references and amounts without card data, maintaining a clean PCI boundary.

### HACCP / Food Safety (ISO 22000)

- **Scope**: Food safety management in hospitality venues.
- **Portarium approach**: The food safety incident workflow and evidence capture support HACCP documentation requirements. Temperature logs, incident records, and corrective actions are stored as immutable evidence artefacts.
- **Pack compliance profile**: `hospo.food-safety` -- requires incident classification, mandates evidence capture for critical control point deviations, supports configurable regulatory notification thresholds per jurisdiction.

### Wage and Hour Compliance

- **Scope**: Labour law compliance for shift workers (minimum wage, overtime, break entitlements, penalty rates).
- **Portarium approach**: The shift-to-payroll workflow validates timesheets against configurable wage rules before payroll submission. Rules vary by jurisdiction (Fair Work Act in Australia, FLSA in the US, Working Time Regulations in the UK).
- **Pack compliance profile**: `hospo.wage-compliance` -- configurable per jurisdiction; validates break entitlements, overtime thresholds, and penalty rate conditions during timesheet approval.

---

## Vertical Prioritisation Matrix

The following matrix evaluates the three initial verticals across five criteria to determine build order. Scores are 1 (low) to 5 (high).

| Criterion                                                                      | Education (Schools)                               | Hospitality (Venues)                            | Trades (Field Service)                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| **Standards leverage** -- mature interop standards reduce schema design effort | 5 (OneRoster, LTI, Ed-Fi, SIF, CEDS)              | 2 (no dominant standard; vendor-specific APIs)  | 1-2 (no industry standards; vendor APIs only)    |
| **Workflow repeatability** -- common workflows across customers                | 4 (rostering, attendance, consent, behaviour)     | 5 (menu mgmt, daily close, shift-to-payroll)    | 4 (quote-to-cash, field completion, invoicing)   |
| **Integration availability** -- quality and accessibility of vendor APIs       | 4 (Canvas S1, Google S1, Moodle S2, OneRoster S1) | 4 (Square S1, Toast S1, Deputy S1, Xero S1)     | 3-4 (ServiceM8 S2, Jobber S1, QuickBooks S1)     |
| **Compliance complexity** -- regulatory burden and risk                        | 5 (child data, FERPA, GDPR, Privacy Acts)         | 3 (PCI boundary, food safety, wage/hour)        | 2-3 (standard business, WHS for some trades)     |
| **Support burden** -- operational effort to support the vertical               | 4 (school calendars, academic year cycles)        | 4 (high-volume real-time, daily reconciliation) | 4 (field operations, mobile, variable job types) |
| **Total**                                                                      | **22**                                            | **18**                                          | **14-17**                                        |

### Build Order Rationale

1. **Education (Schools) -- Strong first vertical**. Mature standards (OneRoster, LTI) provide schema design leverage and conformance test frameworks. High compliance requirements exercise the full governance stack (consent, audit, evidence, approval gates). School operations are seasonal and structured, allowing iterative development aligned to term boundaries.

2. **Hospitality (Venues) -- Strong second vertical**. Highly repeatable workflows (daily close, shift-to-payroll) demonstrate operational value quickly. Real-time POS integration exercises the connector runtime under volume. PCI boundary requirements validate the security architecture without requiring Portarium to handle card data directly.

3. **Trades (Field Service) -- Follow-on vertical**. Shares accounting connectors (Xero, QuickBooks) with hospitality, reducing incremental connector effort. Field operations exercise mobile UI templates and evidence capture (photos, signatures, GPS). Lower standards leverage means more proprietary schema design work, making it more efficient to build after the pack framework is proven.

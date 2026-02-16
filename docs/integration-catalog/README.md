# VAOP Integration Catalog

> Comprehensive registry of every System of Record (SoR) that VAOP orchestrates, organised by port family.

## Purpose

This catalog serves as the living reference for adapter development. Each file documents:

- The **port operations** that VAOP exposes for a business capability family
- Every known **provider** (commercial and OSS), ranked by source quality and adoption
- The **universal entity catalog** — every entity type observed across providers in that domain
- The **VAOP canonical mapping** — which entities map to VAOP canonical objects vs `ExternalObjectRef`

## Port Families

| #   | Port Family                | File                                                 | Business Capability                           |
| --- | -------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| 1   | Finance & Accounting       | [finance-accounting.md](./finance-accounting.md)     | General ledger, AP/AR, chart of accounts      |
| 2   | Payments & Billing         | [payments-billing.md](./payments-billing.md)         | Payment processing, subscriptions, invoicing  |
| 3   | Procurement & Spend        | [procurement-spend.md](./procurement-spend.md)       | Purchase orders, vendor management, expenses  |
| 4   | HRIS & HCM                 | [hris-hcm.md](./hris-hcm.md)                         | Employee records, benefits, time & attendance |
| 5   | Payroll                    | [payroll.md](./payroll.md)                           | Payroll runs, tax, pay stubs                  |
| 6   | CRM & Sales                | [crm-sales.md](./crm-sales.md)                       | Contacts, opportunities, pipelines            |
| 7   | Customer Support           | [customer-support.md](./customer-support.md)         | Tickets, knowledge base, SLAs                 |
| 8   | ITSM & IT Ops              | [itsm-it-ops.md](./itsm-it-ops.md)                   | Incidents, changes, CMDB, assets              |
| 9   | IAM & Directory            | [iam-directory.md](./iam-directory.md)               | Users, groups, roles, SSO                     |
| 10  | Secrets & Vaulting         | [secrets-vaulting.md](./secrets-vaulting.md)         | Secrets, certificates, key management         |
| 11  | Marketing Automation       | [marketing-automation.md](./marketing-automation.md) | Email campaigns, audiences, automation        |
| 12  | Ads Platforms              | [ads-platforms.md](./ads-platforms.md)               | Ad campaigns, creatives, analytics            |
| 13  | Comms & Collaboration      | [comms-collaboration.md](./comms-collaboration.md)   | Messaging, channels, meetings, email          |
| 14  | Projects & Work Management | [projects-work-mgmt.md](./projects-work-mgmt.md)     | Tasks, boards, sprints, milestones            |
| 15  | Documents & E-Signature    | [documents-esign.md](./documents-esign.md)           | Document storage, signing, templates          |
| 16  | Analytics & BI             | [analytics-bi.md](./analytics-bi.md)                 | Dashboards, reports, data warehousing         |
| 17  | Monitoring & Incident      | [monitoring-incident.md](./monitoring-incident.md)   | Alerts, on-call, status pages                 |
| 18  | Compliance & GRC           | [compliance-grc.md](./compliance-grc.md)             | Audit, risk, policy, compliance tracking      |

## Ranking System

### Source Ranking (S1 – S4)

Indicates the quality and reliability of integration surface available.

| Rank   | Meaning                                                                               | Implication for VAOP                                              |
| ------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **S1** | Official REST/GraphQL API with OpenAPI spec, webhook support, and sandbox environment | Adapter can be auto-scaffolded; contract tests trivially derived  |
| **S2** | Official API without OpenAPI spec, or API with significant gaps/rate limits           | Manual adapter authoring; extra defensive coding needed           |
| **S3** | Community-maintained SDK or unofficial API wrapper                                    | Higher maintenance burden; must pin versions and monitor upstream |
| **S4** | Screen-scraping, RPA, CSV/file-based, or no public API                                | Last resort; fragile; consider whether the port is viable         |

### Adoption Tier (A1 – A4)

Indicates market penetration and hence demand priority for VAOP adapters.

| Tier   | Meaning                                                      | VAOP Priority                     |
| ------ | ------------------------------------------------------------ | --------------------------------- |
| **A1** | Dominant market leader (>30% share or >50k paying customers) | Must-support in MVP or P0         |
| **A2** | Strong contender (10–30% share or >10k paying customers)     | Must-support in P1                |
| **A3** | Established niche (1–10% share or >1k paying customers)      | Community adapter candidate       |
| **A4** | Emerging / regional / vertical-specific                      | Long-tail; adapter only on demand |

## Canonical Object Set

The following canonical objects are used across all port families to normalise SoR entities into a shared VAOP vocabulary:

| Canonical Object      | Description                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| **Party**             | Unified person/organisation with role tags (customer, vendor, employee, lead) |
| **Ticket**            | Support ticket, service request, or incident                                  |
| **Invoice**           | Sales invoice or purchase bill                                                |
| **Payment**           | Payment record (charge, refund, transfer)                                     |
| **Task**              | Work item, project task, or to-do                                             |
| **Campaign**          | Marketing or advertising campaign                                             |
| **Asset**             | IT asset, fixed asset, or inventory item                                      |
| **Document**          | Document, file, or attachment                                                 |
| **Subscription**      | Subscription, contract, or agreement                                          |
| **Opportunity**       | Sales opportunity or deal                                                     |
| **Product**           | Product, service, or SKU                                                      |
| **Order**             | Sales order or purchase order                                                 |
| **Account**           | Financial account or GL account                                               |
| **ExternalObjectRef** | First-class deep link to any SoR entity not mapped to a canonical object      |

## Methodology

1. **Domain research** — For each port family, we surveyed the top commercial platforms and OSS alternatives, examining their API documentation, entity models, and webhook capabilities.
2. **Entity extraction** — We catalogued every entity type exposed by each provider's API, then grouped them into universal entity families.
3. **Canonical mapping** — Each universal entity was mapped to the VAOP canonical object that best represents its cross-system semantics. Entities too domain-specific to normalise are referenced via `ExternalObjectRef`.
4. **Provider ranking** — Each provider was assigned an S-rank (source quality) and A-tier (adoption) based on publicly available information about API maturity and market penetration.
5. **Cross-validation** — Mappings were validated against the VAOP glossary, ADRs, and the APQC-aligned port taxonomy to ensure consistency.

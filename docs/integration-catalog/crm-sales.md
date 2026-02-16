# Port 6: CRM & Sales — Integration Catalog

> Contacts, companies, leads, opportunities, pipelines, activities, and sales engagement.

---

## Port Operations

| Operation                | Description                                                                                         | Idempotent | Webhook-Eligible |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| `listContacts`           | Paginated list of contacts with optional filters (company, owner, tag, last modified)               | Yes        | —                |
| `getContact`             | Retrieve a single contact record by ID                                                              | Yes        | —                |
| `createContact`          | Create a new contact with name, email, phone, and company association                               | No         | Yes              |
| `updateContact`          | Update mutable fields on an existing contact                                                        | No         | Yes              |
| `listCompanies`          | Paginated list of companies / accounts with optional filters                                        | Yes        | —                |
| `getCompany`             | Retrieve a single company / account by ID                                                           | Yes        | —                |
| `createCompany`          | Create a new company / account record                                                               | No         | Yes              |
| `listOpportunities`      | List opportunities / deals with optional filters (stage, owner, pipeline, date range)               | Yes        | —                |
| `getOpportunity`         | Retrieve a single opportunity / deal by ID                                                          | Yes        | —                |
| `createOpportunity`      | Create a new opportunity / deal with amount, stage, and associated contacts                         | No         | Yes              |
| `updateOpportunityStage` | Move an opportunity to a different pipeline stage (e.g., qualification to proposal)                 | No         | Yes              |
| `listPipelines`          | List all sales pipelines and their stages                                                           | Yes        | —                |
| `listActivities`         | List activities (tasks, calls, meetings, emails) associated with a contact, company, or opportunity | Yes        | —                |
| `createActivity`         | Create a new activity (task, call, meeting, or email log)                                           | No         | Yes              |
| `listNotes`              | List notes attached to a contact, company, or opportunity                                           | Yes        | —                |
| `createNote`             | Create a new note on a contact, company, or opportunity                                             | No         | Yes              |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (MVP / P0)

| Provider        | Source | Adoption | Est. Customers                          | API Style                                                                                                                                                                                        | Webhooks                                                                                 | Key Entities                                                                                                                          |
| --------------- | ------ | -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Salesforce**  | S1     | A1       | ~150,000+ customers                     | REST (Salesforce REST API / Composite API) and SOAP (Enterprise WSDL). OpenAPI spec available via Salesforce CLI metadata. Full sandbox and scratch orgs. Bulk API for high-volume reads/writes. | Yes (Outbound Messages, Platform Events, Change Data Capture, Streaming API)             | Account, Contact, Lead, Opportunity, Campaign, Task, Event, Note, Case, Product, PriceBook, Quote, Order, Contract, Dashboard, Report |
| **HubSpot CRM** | S1     | A1       | ~200,000+ customers (free + paid tiers) | REST with published OpenAPI spec. Full sandbox (developer test accounts). Generous API rate limits on paid tiers. Batch and search endpoints for bulk operations.                                | Yes (contact, company, deal, ticket lifecycle webhooks; CRM event subscriptions via app) | Contact, Company, Deal, Ticket, Product, LineItem, Quote, Task, Note, Engagement, Pipeline, Owner, Meeting, Call, Email               |

### Tier A2 — Must-Support Providers (P1)

| Provider                         | Source | Adoption | Est. Customers                              | API Style                                                                                                                                                                | Webhooks                                                                | Key Entities                                                                                                          |
| -------------------------------- | ------ | -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Zoho CRM**                     | S1     | A2       | ~250,000+ businesses globally               | REST (Zoho CRM v6 API). OpenAPI spec available. Full sandbox via Zoho Developer Console. Supports bulk read/write and COQL (CRM Object Query Language).                  | Yes (notifications on record create/update/delete for any module)       | Lead, Contact, Account, Deal, Task, Event, Note, Product, Quote, SalesOrder, PurchaseOrder, Invoice, Campaign, Vendor |
| **Pipedrive**                    | S1     | A2       | ~100,000+ companies                         | REST with published OpenAPI spec. Sandbox via developer accounts. Simple, well-documented API. Focuses on sales pipeline management.                                     | Yes (deal, person, organization, activity change events)                | Person, Organization, Deal, Activity, Note, Product, Lead, Pipeline, Stage, Filter                                    |
| **Microsoft Dynamics 365 Sales** | S2     | A2       | ~100,000+ organisations (across D365 suite) | OData v4 REST (Dataverse Web API). No official standalone OpenAPI spec, but OData metadata document serves as schema definition. Sandbox environments available in D365. | Yes (Azure Service Bus / Event Grid integration; plugin-based webhooks) | Contact, Account, Lead, Opportunity, Quote, Order, Invoice, Activity, Campaign, Product, Territory                    |
| **Freshsales (Freshworks CRM)**  | S1     | A2       | ~60,000+ businesses                         | REST with published API docs. API available on all plans. Sandbox via Freshworks developer programme.                                                                    | Yes (record lifecycle webhooks; Freshworks Marketplace event model)     | Contact, Account, Deal, Task, Appointment, Note, Product, Territory, SalesSequence                                    |

### Best OSS for Domain Extraction

| Project         | Source | API Style                                                                          | Key Entities                                                                             | Notes                                                                                                                                                                                                    |
| --------------- | ------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SuiteCRM**    | S1     | REST (v8 API — JSON:API spec compliant). PHP-based. Published OpenAPI spec for v8. | Contact, Account, Lead, Opportunity, Case, Task, Note, Campaign, Quote, Product, Invoice | Fork of SugarCRM Community Edition. Most widely deployed open-source CRM. V8 API is modern and well-structured. Good reference for classic CRM entity models.                                            |
| **ERPNext CRM** | S1     | REST (Frappe API — auto-generated CRUD for all doctypes). Python-based.            | Lead, Opportunity, Customer, Contact, Address, Note, ToDo, Campaign                      | Lightweight CRM module within the ERPNext ecosystem. Entity model is simpler than dedicated CRM platforms but covers core sales workflows.                                                               |
| **Twenty**      | S1     | GraphQL (primary) with REST fallback. TypeScript/React. Modern architecture.       | Person, Company, Opportunity, Task, Note, Activity                                       | Modern open-source CRM built with a developer-first approach. GraphQL API with full schema introspection. Excellent reference for next-generation CRM entity modelling. Very active development (2023+). |

### Tier A3/A4 — Long-Tail Candidates

| Provider      | Source | Adoption | Notes                                                                                                                                                                                     |
| ------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Close**     | S1     | A3       | SMB inside sales CRM. Clean REST API with OpenAPI spec. ~5k+ customers. Strong focus on outbound calling and email sequences. Good for sales-heavy SMB integrations.                      |
| **Copper**    | S1     | A3       | Google Workspace-native CRM. REST API with published docs. ~30k+ users. Deep Gmail/Calendar integration. Entities map closely to Google contacts/calendar model.                          |
| **Insightly** | S2     | A3       | SMB CRM + project management hybrid. REST API available. ~25k+ businesses. Combines CRM entities with project/task management (unique cross-domain overlap).                              |
| **Vtiger**    | S2     | A4       | SMB CRM with open-source roots (Vtiger Open Source). REST API available. Smaller customer base but established in developing markets.                                                     |
| **Bitrix24**  | S2     | A4       | Freemium CRM + collaboration suite. REST API with webhook support. ~12M+ registered organisations (mostly free tier). High volume of users but low percentage of API-driven integrations. |

---

## Universal Entity Catalog

Every entity type observed across all CRM/Sales providers, grouped by functional domain.

### People & Organisations

| Entity        | Also Known As                              | Observed In                                                           |
| ------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| **Contact**   | Person, Individual, CustomerContact        | All providers                                                         |
| **Company**   | Account, Organization, Customer (type:org) | All providers                                                         |
| **Lead**      | Prospect, LeadContact, UnqualifiedContact  | Salesforce, HubSpot, Zoho, Pipedrive, Dynamics 365, SuiteCRM, ERPNext |
| **Owner**     | SalesRep, User, AssignedTo, Rep            | Salesforce, HubSpot, Zoho, Pipedrive, Dynamics 365                    |
| **Territory** | SalesTerritory, Region, SalesArea          | Salesforce, Dynamics 365, Freshsales, Zoho                            |
| **Vendor**    | Supplier, Partner                          | Zoho (CRM module includes procurement overlap)                        |

### Sales Pipeline

| Entity          | Also Known As                                   | Observed In                                         |
| --------------- | ----------------------------------------------- | --------------------------------------------------- |
| **Opportunity** | Deal, SalesOpportunity, Revenue                 | All providers                                       |
| **Pipeline**    | SalesPipeline, Funnel                           | HubSpot, Pipedrive, Salesforce, Freshsales, Close   |
| **Stage**       | PipelineStage, DealStage, OpportunityStage      | All providers (embedded in Pipeline or Opportunity) |
| **Quote**       | Proposal, Estimate, Quotation                   | Salesforce, HubSpot, Zoho, Dynamics 365, SuiteCRM   |
| **Order**       | SalesOrder, PurchaseOrder                       | Salesforce, Zoho, Dynamics 365                      |
| **Invoice**     | Bill, SalesInvoice                              | Zoho, Dynamics 365, SuiteCRM                        |
| **LineItem**    | OpportunityLineItem, QuoteLineItem, ProductItem | Salesforce, HubSpot, Zoho, Dynamics 365             |

### Products & Pricing

| Entity        | Also Known As                      | Observed In                                                  |
| ------------- | ---------------------------------- | ------------------------------------------------------------ |
| **Product**   | ProductCatalog, Item, SKU, Service | Salesforce, HubSpot, Zoho, Pipedrive, Dynamics 365, SuiteCRM |
| **PriceBook** | PriceList, Pricing, PricingTier    | Salesforce, Zoho, Dynamics 365                               |

### Activities & Engagement

| Entity            | Also Known As                         | Observed In                                                                            |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| **Task**          | ToDo, Action, ActionItem              | All providers                                                                          |
| **Event**         | Meeting, Appointment, CalendarEvent   | Salesforce, HubSpot, Zoho, Dynamics 365, Freshsales                                    |
| **Call**          | PhoneCall, CallLog, CallActivity      | HubSpot, Salesforce, Pipedrive, Close, Freshsales                                      |
| **Email**         | EmailLog, EmailActivity, EmailMessage | HubSpot, Salesforce, Close, Freshsales                                                 |
| **Note**          | Comment, NoteBody, Memo               | All providers                                                                          |
| **Engagement**    | Activity, Interaction, TouchPoint     | HubSpot (unified engagement model), Salesforce (ActivityHistory)                       |
| **SalesSequence** | Cadence, Sequence, Workflow, Outreach | Freshsales, HubSpot (sequences), Close (smart views), Salesforce (High Velocity Sales) |

### Marketing Overlap

| Entity          | Also Known As                                     | Observed In                                       |
| --------------- | ------------------------------------------------- | ------------------------------------------------- |
| **Campaign**    | MarketingCampaign, CampaignSource                 | Salesforce, Zoho, Dynamics 365, SuiteCRM, ERPNext |
| **CustomField** | UserDefinedField, CustomProperty, CustomAttribute | All providers (extensibility mechanism)           |

---

## VAOP Canonical Mapping

Each universal entity is mapped to the VAOP canonical object that best captures its cross-system semantics. Entities too domain-specific for a canonical object are referenced via `ExternalObjectRef`.

| Universal Entity                    | VAOP Canonical Object | Canonical Role / Type       | Notes                                                                                                                                                    |
| ----------------------------------- | --------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ----------------------------------------------------------------- |
| Contact / Person                    | **Party**             | `role: customer`            | Individuals who are contacts in the sales process. Merged with other Party roles across ports.                                                           |
| Company / Account                   | **Party**             | `role: customer, type: org` | Organisations that are customers or prospects.                                                                                                           |
| Lead                                | **Party**             | `role: lead`                | Pre-qualified contacts. Converted to `role: customer` upon qualification. Lead-to-contact conversion is modelled as a role transition on the same Party. |
| Owner / SalesRep                    | **Party**             | `role: employee`            | Sales team members. Cross-referenced with HRIS port (Port 4) employee records.                                                                           |
| Opportunity / Deal                  | **Opportunity**       | —                           | Maps directly to the VAOP Opportunity canonical object. Carries amount, stage, probability, and close date.                                              |
| Activity (Task)                     | **Task**              | —                           | CRM tasks map to the VAOP Task canonical object with activity-type metadata.                                                                             |
| Activity (Event/Call/Meeting/Email) | **Task**              | `subtype: event             | call                                                                                                                                                     | meeting | email` | Non-task activities modelled as Task with subtype discrimination. |
| Note                                | **Document**          | —                           | Notes modelled as lightweight documents attached to a Party or Opportunity.                                                                              |
| Product                             | **Product**           | —                           | CRM product catalog entries map directly to the VAOP Product canonical object.                                                                           |
| Quote / Proposal                    | **ExternalObjectRef** | —                           | Quotes are too provider-specific in structure (line items, terms, approval flows) to normalise fully. Deep-linked to SoR.                                |
| Order                               | **Order**             | —                           | Sales orders map to the VAOP Order canonical object when the CRM tracks fulfilment.                                                                      |
| Invoice                             | **Invoice**           | —                           | CRM-generated invoices map to the VAOP Invoice canonical object. Cross-referenced with finance port (Port 1).                                            |
| Campaign                            | **Campaign**          | —                           | Marketing campaigns originated or tracked in CRM. Cross-referenced with marketing automation port (Port 11).                                             |
| Pipeline / Stage                    | **ExternalObjectRef** | —                           | Pipeline configuration is provider-specific metadata. Referenced from Opportunity records.                                                               |
| Territory                           | **ExternalObjectRef** | —                           | Sales territory assignments. Provider-specific organisational construct.                                                                                 |
| LineItem                            | **ExternalObjectRef** | —                           | Line items on quotes, orders, or opportunities. Granularity varies significantly across providers.                                                       |
| Engagement / SalesSequence          | **ExternalObjectRef** | —                           | Sales engagement workflows and sequence definitions. Highly provider-specific.                                                                           |
| PriceBook                           | **ExternalObjectRef** | —                           | Pricing configuration. Provider-specific structure.                                                                                                      |
| Vendor                              | **Party**             | `role: vendor`              | Vendor/supplier records in CRMs that include procurement (e.g., Zoho). Cross-referenced with procurement port (Port 3).                                  |
| CustomField                         | **ExternalObjectRef** | —                           | Provider-specific custom fields preserved as opaque key-value pairs within the parent entity's canonical representation.                                 |

---

## Cross-Port References

| Related Port                     | Relationship                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Port 7: Customer Support         | Contact/Company records are shared. CRM Cases in Salesforce overlap with support tickets. Opportunity-to-ticket escalation is a common workflow. |
| Port 11: Marketing Automation    | Campaign entities originate in marketing tools and flow into CRM for attribution. Lead scoring and nurture sequences bridge both ports.          |
| Port 2: Payments & Billing       | Closed-won opportunities may trigger invoicing and payment collection via the payments port.                                                     |
| Port 1: Finance & Accounting     | CRM-generated invoices and orders post revenue entries to the general ledger.                                                                    |
| Port 4: HRIS & HCM               | Sales rep / owner records cross-reference employee records for territory assignment and commission calculations.                                 |
| Port 15: Documents & E-Signature | Quotes and proposals often require e-signature workflows before conversion to orders.                                                            |

---

## Implementation Notes

1. **Salesforce complexity** — Salesforce's API surface is vast (2,000+ standard objects, unlimited custom objects). The adapter should focus on the 15-20 core sales entities listed above and treat everything else as `ExternalObjectRef`. Use Composite API for efficient multi-object reads and Bulk API 2.0 for initial sync operations.
2. **HubSpot associations model** — HubSpot uses an explicit associations API to link records (contact-to-company, deal-to-contact, etc.). The adapter must handle association creation alongside record creation to maintain referential integrity. HubSpot v3 API uses a unified CRM objects endpoint pattern (`/crm/v3/objects/{objectType}`).
3. **Lead conversion** — The lead-to-contact conversion workflow varies significantly across providers. In Salesforce, it creates new Contact + Account + Opportunity records. In HubSpot, leads are a lightweight overlay on contacts. In Pipedrive, leads are a separate entity that converts to a deal. The adapter should emit a domain event (`LeadConverted`) and handle the provider-specific conversion mechanics internally.
4. **Pipeline stage mapping** — Each CRM uses different default pipeline stages (e.g., Salesforce: Prospecting / Qualification / Proposal / Negotiation / Closed Won / Closed Lost; HubSpot: Appointment Scheduled / Qualified to Buy / Presentation Scheduled / Decision Maker Bought-In / Contract Sent / Closed Won / Closed Lost). The `updateOpportunityStage` operation should accept VAOP-normalised stage identifiers and map them to provider-specific stages via adapter configuration.
5. **Custom objects and fields** — All major CRM providers support custom objects and fields extensively. The adapter should discover custom fields dynamically (via metadata API in Salesforce, property API in HubSpot) and preserve them as structured metadata within `ExternalObjectRef` payloads.
6. **Rate limiting strategies** — Salesforce enforces per-org daily API call limits (varies by edition: 15k-1M+ calls/day). HubSpot enforces per-app rate limits (100-120 calls/10 seconds on paid tiers). The adapter must implement token-bucket rate limiting, request coalescing, and graceful degradation when limits are approached.
7. **Webhook reliability** — CRM webhooks can be unreliable under high-volume conditions. The adapter should implement webhook verification (HMAC signatures), deduplication (idempotency on event IDs), and periodic reconciliation polling to catch missed events.

# Port 8: ITSM & IT Ops — Integration Catalog

## Port Operations

| Operation              | Description                                                                   | Idempotent |
| ---------------------- | ----------------------------------------------------------------------------- | ---------- |
| `listIncidents`        | Return incidents filtered by priority, state, assignment group, or date range | Yes        |
| `getIncident`          | Retrieve a single incident by canonical ID or external ref                    | Yes        |
| `createIncident`       | Open a new incident with short description, urgency, and impact               | No         |
| `updateIncident`       | Modify incident fields (priority, state, assignment, work notes)              | No         |
| `resolveIncident`      | Transition an incident to resolved state with resolution details              | No         |
| `listChangeRequests`   | Return change requests filtered by type, state, or approval status            | Yes        |
| `createChangeRequest`  | Submit a new change request with plan, risk assessment, and schedule          | No         |
| `approveChangeRequest` | Record an approval or rejection on a change request                           | No         |
| `listAssets`           | Return IT assets filtered by type, status, location, or owner                 | Yes        |
| `getAsset`             | Retrieve a single asset by canonical ID, asset tag, or serial number          | Yes        |
| `createAsset`          | Register a new IT asset in the inventory                                      | No         |
| `updateAsset`          | Modify asset fields (status, owner, location, custom attributes)              | No         |
| `listCMDBItems`        | Return configuration items filtered by class, status, or relationship         | Yes        |
| `getCMDBItem`          | Retrieve a single CI with its attributes and relationships                    | Yes        |
| `listProblems`         | Return problem records filtered by state, priority, or related incidents      | Yes        |
| `createProblem`        | Open a new problem record linked to one or more incidents                     | No         |
| `listServiceRequests`  | Return service requests filtered by catalog item, state, or requester         | Yes        |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30% market share or >50k customers)

| Provider                                | Source                                                                       | Adoption | Est. Customers                                          | API Style                             | Webhooks                                                    | Key Entities                                                                                                                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------- | -------- | ------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ServiceNow**                          | S1 — Table API with OpenAPI spec generation, full developer instances (PDIs) | A1       | ~8k+ enterprise customers (dominant in enterprise ITSM) | REST (Table API, Scripted REST), SOAP | Yes — business rules, Flow Designer webhooks, outbound REST | Incident, ChangeRequest, Problem, ServiceRequest, Asset (alm_asset), CI (cmdb_ci), CMDB, KnowledgeArticle, User (sys_user), Group (sys_user_group), SLA (task_sla), Task, Workflow, CatalogItem, BusinessService |
| **Jira Service Management** (Atlassian) | S1 — REST API v2/v3 with OpenAPI spec, cloud developer instances             | A1       | ~50k+ customers (strong in SMB and mid-market)          | REST (JSON), OAuth 2.0                | Yes — webhook subscriptions on issue events                 | Issue (subtypes: Incident, ServiceRequest, Change, Problem), Project, Customer, Queue, SLA, Asset/CMDB Object (via Assets/Insight), KnowledgeArticle (via Confluence), Approval, RequestType, Organization       |

### Tier A2 — Strong Contenders (10–30% share or >10k customers)

| Provider                             | Source                                                                      | Adoption | Est. Customers                                            | API Style                         | Webhooks                                                               | Key Entities                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------- | -------- | --------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Freshservice** (Freshworks)        | S1 — REST API with comprehensive docs, sandbox available                    | A2       | ~60k+ customers (across Freshworks ITSM product)          | REST (JSON), API key or OAuth 2.0 | Yes — webhook rules on ticket and asset events                         | Ticket (Incident/SR), Asset, Change, Problem, Release, Agent, Department, Group, Product, Vendor, Contract, Software, SLA, RequesterGroup |
| **BMC Helix ITSM** (formerly Remedy) | S2 — REST API (AR REST API) with gaps; sandbox by license only              | A2       | ~10k+ enterprise customers (legacy Remedy installed base) | REST (JSON), legacy mid-tier API  | Limited — polling recommended; AR System notifications for push        | Incident, ChangeRequest, Problem, Asset, CI, WorkOrder, KnowledgeArticle, SLA, Person, SupportGroup                                       |
| **ManageEngine ServiceDesk Plus**    | S2 — REST API with moderate coverage; some operations require v1 legacy API | A2       | ~100k+ customers (strong in mid-market, on-prem heavy)    | REST (JSON/XML)                   | Limited — email-based notifications; webhook support varies by edition | Request (Incident/SR), Asset, Change, Problem, CI, Purchase, Contract, Solution, Technician, Site, Department                             |

### Best OSS for Domain Extraction

| Project      | Source                                                         | API Style   | Key Entities                                                                                                          | Notes                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GLPI**     | S1 — self-hosted, REST API with full CRUD coverage             | REST (JSON) | Ticket, Computer, NetworkEquipment, Software, Change, Problem, User, Group, Entity, Contract, Supplier, KnowledgeBase | Mature PHP-based ITSM and asset management platform (~4k GitHub stars). ITIL-aligned with strong CMDB capabilities. Native inventory agent (GLPI Agent/FusionInventory) for automatic asset discovery. |
| **iTop**     | S2 — REST/JSON API with CRUD; limited filtering and pagination | REST (JSON) | Ticket (UserRequest/Incident), Server, Application, Change, Problem, CI, Person, Organization, Contract, SLA, Service | Combodo's open-source ITIL CMDB and ticketing (~1.5k GitHub stars). Strong data model with customisable CI classes and impact analysis. Good reference for CMDB relationship modelling.                |
| **Snipe-IT** | S1 — self-hosted, well-documented REST API with full CRUD      | REST (JSON) | Asset, Model, Category, Company, Location, User, License, Accessory, Component, Manufacturer                          | Focused exclusively on IT asset management (~11k GitHub stars). Clean API with strong audit trail. Excellent reference for asset lifecycle modelling (deploy, check-out, check-in, retire).            |

### Tier A3 — Established Niche

| Provider                    | Source                                                           | Adoption | Notes                                                                                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SolarWinds Service Desk** | S1 — REST API with good coverage, cloud-hosted                   | A3       | Cloud-native ITSM with integrated asset management. Entities: Incident, Problem, Change, Release, Solution, Hardware, Software, User. ITIL-certified. Popular with mid-market customers already using SolarWinds monitoring. |
| **Ivanti Neurons for ITSM** | S2 — REST API with gaps; legacy Ivanti Service Manager endpoints | A3       | Enterprise ITSM and unified endpoint management. Entities: Incident, Change, Problem, Request, CI, Asset, Knowledge, Workflow. Strong in organisations with heavy endpoint management needs.                                 |

### Tier A4 — Emerging / Regional

| Provider    | Source                                                                  | Adoption | Notes                                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TOPdesk** | S2 — REST API with partial coverage; strong in Benelux and DACH regions | A4       | EU-focused ITSM with service management and facilities management. Entities: Incident, Change, OperatorGroup, Asset, Location, KnowledgeItem. GDPR-aware data residency. Popular in education and government sectors. |
| **SysAid**  | S2 — REST API with moderate coverage; integrated RMM capabilities       | A4       | ITSM with built-in remote monitoring and management. Entities: ServiceRecord, Asset, User, CI, Change, Problem. Targets mid-market IT teams that want a single pane of glass for helpdesk and endpoint monitoring.    |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by ITSM domain.

### ITIL Process Records

| Entity                       | Description                                                      | Observed In                                                                                                |
| ---------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Incident**                 | An unplanned interruption to an IT service requiring restoration | All providers (Incident in ServiceNow/BMC/GLPI/iTop, Issue subtype in JSM, Ticket subtype in Freshservice) |
| **ChangeRequest**            | A formal request to add, modify, or remove a CI or service       | All providers (Change in Freshservice/GLPI/iTop, ChangeRequest in ServiceNow/BMC)                          |
| **Problem**                  | The underlying root cause of one or more incidents               | All providers (Problem record type across all ITSM platforms)                                              |
| **ServiceRequest / Request** | A user request for a standard service from the IT catalog        | ServiceNow, JSM, Freshservice, ManageEngine, GLPI (Ticket subtype), iTop (UserRequest)                     |
| **Release**                  | A collection of changes deployed together into production        | ServiceNow, Freshservice, SolarWinds                                                                       |
| **WorkOrder**                | A task assigned to a technician for fulfilment or remediation    | ServiceNow, BMC, ManageEngine                                                                              |

### Configuration Management

| Entity                             | Description                                                                 | Observed In                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Asset / CI / ConfigurationItem** | A managed IT resource tracked in inventory or the CMDB                      | All providers (Asset in Freshservice/Snipe-IT/ManageEngine, CI in ServiceNow/BMC/iTop, CMDB Object in JSM) |
| **CMDBRelationship**               | A typed relationship between two CIs (e.g., runs-on, depends-on, hosted-by) | ServiceNow, BMC, iTop, JSM (Assets), GLPI                                                                  |
| **BusinessService**                | A customer-facing IT service composed of underlying CIs                     | ServiceNow, BMC, iTop, SolarWinds                                                                          |
| **Software / License**             | A software installation or license entitlement tracked against assets       | ServiceNow, Freshservice, GLPI, Snipe-IT, ManageEngine, SolarWinds                                         |

### Asset Management

| Entity                | Description                                                 | Observed In                                                                |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Location / Site**   | A physical location where assets are deployed or stored     | All providers (Location in ServiceNow/Snipe-IT/GLPI, Site in ManageEngine) |
| **Vendor / Supplier** | A company that supplies hardware, software, or services     | ServiceNow, Freshservice, GLPI, ManageEngine, Snipe-IT (Manufacturer)      |
| **Contract**          | A support, warranty, or maintenance agreement with a vendor | ServiceNow, Freshservice, GLPI, iTop, ManageEngine                         |
| **Manufacturer**      | The original manufacturer of hardware or software           | Snipe-IT, GLPI, Freshservice (implicit in Product)                         |

### People & Groups

| Entity                        | Description                                                        | Observed In                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **User / Agent / Technician** | An IT staff member or end-user interacting with the ITSM system    | All providers (User in ServiceNow/GLPI, Agent in Freshservice, Technician in ManageEngine, Person in BMC/iTop) |
| **Group / Team**              | A logical grouping of agents for assignment and escalation routing | All providers (Group in ServiceNow/Freshservice/GLPI, SupportGroup in BMC, OperatorGroup in TOPdesk)           |
| **Organization**              | A company or department for multi-tenancy or request scoping       | JSM, iTop, GLPI (Entity), ManageEngine (Department)                                                            |

### Knowledge & SLA

| Entity                        | Description                                                        | Observed In                                                                                      |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **KnowledgeArticle**          | A solution or documentation article in the knowledge base          | ServiceNow, JSM (via Confluence), BMC, GLPI, iTop, ManageEngine (Solution), SolarWinds           |
| **SLA / SLATarget**           | A service level agreement defining response and resolution targets | All providers (SLA in ServiceNow/Freshservice/iTop, OLA/UC variants in ITIL-aligned platforms)   |
| **Approval**                  | An approval record on a change request or service request          | ServiceNow, JSM, Freshservice, BMC                                                               |
| **CatalogItem / RequestType** | A requestable item or service from the IT service catalog          | ServiceNow (CatalogItem), JSM (RequestType), Freshservice (ServiceItem), ManageEngine (Template) |

---

## VAOP Canonical Mapping

| Universal Entity          | VAOP Canonical Object       | Mapping Notes                                                                                                                                                                       |
| ------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incident                  | `Ticket` (type: `incident`) | Mapped to Ticket with type discriminator. Urgency, impact, and priority fields normalised. Resolution details stored as structured metadata.                                        |
| ChangeRequest             | `Ticket` (type: `change`)   | Mapped to Ticket with type discriminator. Change type (standard, normal, emergency), risk level, and implementation plan stored as metadata. Approval status tracked on the Ticket. |
| Problem                   | `Ticket` (type: `problem`)  | Mapped to Ticket with type discriminator. Root cause analysis and linked incidents stored as relationships and metadata.                                                            |
| ServiceRequest            | `Ticket` (type: `service`)  | Mapped to Ticket with type discriminator. Catalog item reference and fulfilment details stored as metadata.                                                                         |
| Asset                     | `Asset`                     | Direct mapping. VAOP Asset covers hardware, peripherals, and physical IT resources. Asset tag, serial number, status, and owner normalised.                                         |
| CI (ConfigurationItem)    | `Asset`                     | Mapped to Asset. CIs representing logical or virtual resources (VMs, network services) use the same Asset canonical with `class` metadata distinguishing them from physical assets. |
| Software                  | `Asset` (type: `software`)  | Mapped to Asset with software type discriminator. Version, vendor, and installation details stored as metadata.                                                                     |
| License                   | `Subscription`              | Mapped to Subscription. License seat count, expiration, and entitlement type normalised. Links to Software asset and Vendor party.                                                  |
| Contract                  | `Subscription`              | Mapped to Subscription. Contract terms (start, end, renewal), SLA references, and vendor party link normalised.                                                                     |
| KnowledgeArticle          | `Document`                  | Direct mapping. Article body, category, publish state, and version normalised. Supports cross-port document aggregation with Port 7 KB articles.                                    |
| User / Agent / Technician | `Party` (role: `employee`)  | Mapped to Party with employee role. ITSM-specific attributes (skills, shift, group membership) stored as metadata.                                                                  |
| Vendor / Supplier         | `Party` (role: `vendor`)    | Mapped to Party with vendor role. Vendor contact and contract references normalised.                                                                                                |
| Organization              | `Party` (role: `org`)       | Mapped to Party with organisation role. Used for multi-tenant scoping and department hierarchy.                                                                                     |
| CatalogItem / RequestType | `Product`                   | Mapped to Product. Service catalog items represent requestable offerings with defined fulfilment processes.                                                                         |
| Location / Site           | `ExternalObjectRef`         | Locations are ITSM-specific and structurally variable (building, floor, rack, region). Stored as typed external references with address and hierarchy metadata.                     |
| SLA / SLATarget           | `ExternalObjectRef`         | SLA definitions with response/resolution targets, business hours, and escalation rules. Too provider-specific to normalise; stored as external references.                          |
| Approval                  | `ExternalObjectRef`         | Approval records tied to change or service request workflows. Stored as external references with approver, decision, and timestamp.                                                 |
| CMDBRelationship          | `ExternalObjectRef`         | Typed relationships between CIs (depends-on, runs-on, hosted-by). Stored as external references preserving relationship type and directionality.                                    |
| BusinessService           | `ExternalObjectRef`         | Customer-facing service definitions. Stored as external references with SLA and CI dependency metadata.                                                                             |
| Release                   | `ExternalObjectRef`         | Release management records are deeply tied to deployment workflows. Stored as external references.                                                                                  |
| WorkOrder                 | `ExternalObjectRef`         | Task-level work items for fulfilment. Stored as external references linked to the parent Ticket.                                                                                    |
| Group / Team              | `ExternalObjectRef`         | Agent groupings for routing and escalation. Stored as external references with membership metadata.                                                                                 |
| Manufacturer              | `ExternalObjectRef`         | Hardware/software manufacturer records. Stored as external references; may correlate with Vendor Party in some contexts.                                                            |

---

## Notes

- **ServiceNow** and **Jira Service Management** together cover the majority of the ITSM market (enterprise and SMB respectively) and should be the first two adapters implemented for Port 8.
- The `Ticket` canonical with a `type` discriminator (incident, change, problem, service) is a deliberate design choice that mirrors how JSM models all ITIL record types as Issue subtypes. This enables unified ticket queries across ITSM process types.
- **Asset** and **CI** are mapped to the same `Asset` canonical because ITIL v4 has largely converged these concepts. A `class` attribute distinguishes hardware, software, virtual, and service CIs. The CMDB relationship graph is preserved through `ExternalObjectRef` edges.
- **Snipe-IT** is recommended as the reference implementation for asset lifecycle modelling due to its clean, focused API and strong audit trail.
- Contracts and licenses are mapped to `Subscription` rather than `ExternalObjectRef` because they have clear temporal boundaries (start, end, renewal) and commercial terms that align with the Subscription canonical.
- Cross-port opportunities: Incidents (Port 8) often reference the same customer contacts as support tickets (Port 7). The shared `Party` canonical enables correlation. Similarly, ITSM knowledge articles share the `Document` canonical with Port 7 KB content.

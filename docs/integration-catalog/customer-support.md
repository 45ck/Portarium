# Port 7: Customer Support — Integration Catalog

## Port Operations

| Operation                         | Description                                                           | Idempotent |
| --------------------------------- | --------------------------------------------------------------------- | ---------- |
| `listTickets`                     | Return support tickets filtered by status, priority, assignee, or tag | Yes        |
| `getTicket`                       | Retrieve a single ticket by canonical ID or external ref              | Yes        |
| `createTicket`                    | Open a new support ticket with subject, description, and requester    | No         |
| `updateTicket`                    | Modify ticket fields (priority, status, custom fields, subject)       | No         |
| `closeTicket`                     | Transition a ticket to closed/resolved status                         | No         |
| `listAgents`                      | Return support agents filtered by group, role, or availability        | Yes        |
| `assignTicket`                    | Assign or reassign a ticket to an agent or group                      | No         |
| `addComment`                      | Append a public reply or internal note to a ticket                    | No         |
| `listComments`                    | List all comments/replies on a ticket with pagination                 | Yes        |
| `listTags`                        | Return all tags available in the support workspace                    | Yes        |
| `createTag`                       | Create a new tag for ticket categorisation                            | No         |
| `getKnowledgeArticle`             | Retrieve a single knowledge base article by ID                        | Yes        |
| `listKnowledgeArticles`           | List knowledge base articles filtered by category or search term      | Yes        |
| `getSLA`                          | Retrieve an SLA policy and its target response/resolution times       | Yes        |
| `listCustomerSatisfactionRatings` | List CSAT ratings filtered by ticket, date range, or score            | Yes        |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30% market share or >50k customers)

| Provider                   | Source                                                     | Adoption | Est. Customers                    | API Style                         | Webhooks                                                | Key Entities                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------- | -------- | --------------------------------- | --------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zendesk**                | S1 — full REST API with OpenAPI spec, sandbox environments | A1       | ~170k+ paying customers worldwide | REST (JSON), OAuth 2.0            | Yes — trigger-based webhooks, real-time event streaming | Ticket, User, Organization, Group, Comment, Attachment, Tag, SLA, SatisfactionRating, CustomField, View, Macro, Trigger, Automation, Article, Section, Category |
| **Freshdesk** (Freshworks) | S1 — REST API with comprehensive docs, sandbox available   | A1       | ~60k+ paying customers            | REST (JSON), API key or OAuth 2.0 | Yes — webhook rules on ticket events                    | Ticket, Contact, Company, Agent, Group, Conversation, Note, Tag, SLA, SatisfactionSurvey, TimeEntry, Product, EmailConfig, CannedResponse, Solution (KB)        |

### Tier A2 — Strong Contenders (10–30% share or >10k customers)

| Provider                     | Source                                                    | Adoption | Est. Customers                           | API Style                                     | Webhooks                                                | Key Entities                                                                                                    |
| ---------------------------- | --------------------------------------------------------- | -------- | ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Intercom**                 | S1 — REST API with versioned endpoints, sandbox apps      | A2       | ~25k+ paying customers                   | REST (JSON), OAuth 2.0                        | Yes — per-topic webhooks with HMAC signing              | Contact, Conversation, Admin, Tag, Segment, Article, Collection, HelpCenter, Team, Note, Event, Company, SLA    |
| **ServiceNow CSM**           | S2 — REST (Table API) and legacy SOAP; sandbox by license | A2       | Part of ServiceNow's ~8k enterprise base | REST (Table API), SOAP/XML                    | Limited — business rules and scripted REST for push     | Case, Contact, Account, Interaction, SLA, KnowledgeArticle, Assignment, WorkNote                                |
| **HubSpot Service Hub**      | S1 — REST API with OpenAPI spec, developer sandbox        | A2       | Part of HubSpot's ~194k customer base    | REST (JSON), OAuth 2.0                        | Yes — webhook subscriptions via app                     | Ticket, Contact, Company, Conversation, KnowledgeArticle, Pipeline, SLA, Feedback                               |
| **Salesforce Service Cloud** | S1 — REST and SOAP APIs, full sandbox orgs                | A2       | Part of Salesforce's ~150k org base      | REST (JSON), SOAP/XML, Streaming API (CometD) | Yes — Platform Events, Streaming API, Outbound Messages | Case, Contact, Account, CaseComment, Solution, KnowledgeArticle, Entitlement, ServiceContract, LiveAgentSession |

### Best OSS for Domain Extraction

| Project       | Source                                                          | API Style                      | Key Entities                                                                   | Notes                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Zammad**    | S1 — self-hosted, full REST + GraphQL API                       | REST (JSON) / GraphQL          | Ticket, User, Organization, Group, Article (comment), Tag, Channel, SLA, Macro | Modern Ruby-on-Rails helpdesk with strong API coverage. ~4k GitHub stars. Excellent reference for ticket lifecycle modelling. Supports email, chat, phone, Twitter, and Telegram channels. |
| **osTicket**  | S2 — REST API with limited coverage; many ops require direct DB | REST (JSON), limited endpoints | Ticket, User, Department, SLA, HelpTopic, Thread, Staff                        | PHP-based, widely deployed open-source helpdesk (~3k GitHub stars). REST API covers basics but lacks webhook support and advanced query filters.                                           |
| **FreeScout** | S3 — community-maintained REST API, limited documentation       | REST (JSON)                    | Conversation, Customer, Mailbox, Thread, Tag, User                             | Laravel-based Help Scout clone (~3k GitHub stars). API mirrors Help Scout's structure. Mailbox-centric model. Plugin ecosystem extends functionality.                                      |

### Tier A3 — Established Niche

| Provider       | Source                                         | Adoption | Notes                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zoho Desk**  | S1 — REST API with OAuth 2.0, sandbox org      | A3       | SMB-focused support platform. Part of Zoho ecosystem (~100M+ users across products). Entities: Ticket, Contact, Account, Agent, Department, Channel, SLA, Article. Strong in price-sensitive markets. |
| **Help Scout** | S1 — REST API (Mailbox API 2.0) with OAuth 2.0 | A3       | Email-first helpdesk popular with SaaS companies. ~12k customers. Entities: Conversation, Customer, Mailbox, Thread, Tag, User, Workflow. Clean API with excellent documentation.                     |
| **Kayako**     | S2 — REST API with gaps in webhook coverage    | A3       | Conversation-based unified support. Entities: Conversation, User, Organization, Channel, SLA, View, Automation. Recently acquired and platform direction uncertain.                                   |

### Tier A4 — Emerging / Regional

| Provider      | Source                                                | Adoption | Notes                                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LiveAgent** | S2 — REST API with partial endpoint coverage          | A4       | Multi-channel support (email, chat, phone, social). ~150+ integrations. Strong in live-chat use cases. Entities: Ticket, Agent, Department, Tag, Filter, Predefined Answer.                                     |
| **Hiver**     | S3 — limited API, primarily operated through Gmail UI | A4       | Gmail-based helpdesk for teams that want to stay inside Google Workspace. Entities: Conversation, SharedMailbox, Tag, User, Note, Template. API surface is minimal; most automation is rule-based within Gmail. |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by support domain.

### Core Ticket Lifecycle

| Entity                               | Description                                                          | Observed In                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Ticket / Case / Conversation**     | The primary support record representing a customer issue or request  | All providers (Ticket in Zendesk/Freshdesk, Case in Salesforce/ServiceNow, Conversation in Intercom/Help Scout/FreeScout) |
| **Contact / Customer / Requester**   | The end-user or customer who raised the support request              | All providers (User in Zendesk/Zammad, Contact in Freshdesk/Intercom/Salesforce, Customer in Help Scout/FreeScout)        |
| **Agent / Admin / Staff**            | The support representative handling the ticket                       | All providers (Agent in Freshdesk, Admin in Intercom, Staff in osTicket, Technician in some ITSM hybrids)                 |
| **Organization / Company / Account** | The company or entity that a contact belongs to                      | Zendesk, Freshdesk, Intercom, Salesforce, ServiceNow, Zammad, HubSpot                                                     |
| **Group / Team / Department**        | A logical grouping of agents for ticket routing and assignment       | All providers (Group in Zendesk/Freshdesk/Zammad, Team in Intercom, Department in osTicket/Zoho Desk)                     |
| **Priority**                         | Urgency level assigned to a ticket (e.g., low, normal, high, urgent) | All providers                                                                                                             |
| **Status**                           | Current lifecycle state (e.g., new, open, pending, solved, closed)   | All providers                                                                                                             |

### Communication & Content

| Entity                                 | Description                                                                                | Observed In                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Comment / Reply / Thread / Article** | A message or note appended to a ticket (public or internal)                                | All providers (Comment in Zendesk, Conversation in Freshdesk, Thread in osTicket/FreeScout, Article in Zammad) |
| **Attachment**                         | A file uploaded to a ticket or comment                                                     | All providers                                                                                                  |
| **Tag**                                | A label for categorising and filtering tickets                                             | Zendesk, Freshdesk, Intercom, Zammad, FreeScout, Help Scout, LiveAgent                                         |
| **Channel / Mailbox**                  | The communication channel through which a ticket was received (email, chat, phone, social) | Zendesk, Zammad, Freshdesk, FreeScout, Kayako, Help Scout                                                      |

### Knowledge Management

| Entity                              | Description                                               | Observed In                                                                                                     |
| ----------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **KnowledgeArticle / Solution**     | A self-service help article published in a knowledge base | Zendesk (Article), Freshdesk (Solution), Salesforce (KnowledgeArticle), ServiceNow, HubSpot, Intercom (Article) |
| **Category / Section / Collection** | A grouping or hierarchy for organising knowledge articles | Zendesk (Category/Section), Freshdesk (Folder/Category), Intercom (Collection), Salesforce (DataCategory)       |

### SLA & Quality

| Entity                        | Description                                                             | Observed In                                                                          |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **SLA / SLAPolicy**           | A service-level agreement defining target response and resolution times | Zendesk, Freshdesk, ServiceNow, Salesforce (Entitlement), Zammad, osTicket, Intercom |
| **SatisfactionRating / CSAT** | A customer feedback score tied to a resolved ticket                     | Zendesk, Freshdesk, Salesforce, HubSpot                                              |
| **CustomField**               | A tenant-defined field extending the ticket or contact schema           | Zendesk, Freshdesk, Salesforce, HubSpot, Zoho Desk                                   |

### Automation & Productivity

| Entity                     | Description                                                     | Observed In                                                                               |
| -------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Macro / CannedResponse** | A saved reply template or set of predefined ticket actions      | Zendesk (Macro), Freshdesk (CannedResponse), Zammad (Macro), LiveAgent (PredefinedAnswer) |
| **Trigger / Automation**   | An event-driven or time-based rule that performs ticket actions | Zendesk (Trigger/Automation), Freshdesk (Dispatcher/Supervisor), Help Scout (Workflow)    |
| **View / Queue**           | A saved filter or sorted list of tickets for agent workspaces   | Zendesk, Freshdesk, Salesforce (ListView), Kayako, LiveAgent (Filter)                     |
| **TimeEntry**              | A record of time spent by an agent on a ticket                  | Freshdesk, Zendesk (via app), Zoho Desk                                                   |

---

## VAOP Canonical Mapping

| Universal Entity                 | VAOP Canonical Object      | Mapping Notes                                                                                                                                                                                                  |
| -------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket / Case / Conversation     | `Ticket`                   | Direct mapping. VAOP Ticket covers support tickets, cases, and conversations. A `channel` attribute records origin (email, chat, phone). Provider-specific statuses are normalised to a shared lifecycle enum. |
| Contact / Customer / Requester   | `Party` (role: `customer`) | Mapped to Party with customer role. Contact details (email, phone) normalised. The requester of a ticket links to this Party.                                                                                  |
| Agent / Admin / Staff            | `Party` (role: `employee`) | Mapped to Party with employee role. Agent availability and skills stored as provider-specific metadata.                                                                                                        |
| Organization / Company / Account | `Party` (role: `org`)      | Mapped to Party with organisation role. Customer contacts link to their parent org via Party relationships.                                                                                                    |
| Comment / Reply / Thread         | `ExternalObjectRef`        | Comments are ticket-scoped and structurally variable (public vs. internal, rich text vs. plain). Stored as typed external references linked to the parent Ticket.                                              |
| Attachment                       | `Document`                 | Direct mapping. File metadata (name, size, MIME type) normalised. Binary content referenced by URL or storage key.                                                                                             |
| Tag                              | `ExternalObjectRef`        | Tags are simple string labels. Stored as external references and applied to Tickets as a many-to-many relationship.                                                                                            |
| SLA / SLAPolicy                  | `ExternalObjectRef`        | SLA structures vary significantly (response time, resolution time, business hours, escalation rules). Stored as typed external references with structured metadata.                                            |
| SatisfactionRating / CSAT        | `ExternalObjectRef`        | CSAT scores (numeric or sentiment-based) stored as external references linked to the resolved Ticket.                                                                                                          |
| KnowledgeArticle / Solution      | `Document`                 | Mapped to Document with `type: knowledge_article`. Article body, locale, and publish status normalised. Category hierarchy preserved in metadata.                                                              |
| Category / Section / Collection  | `ExternalObjectRef`        | KB taxonomy structures vary by provider. Stored as external references with parent-child relationships preserved.                                                                                              |
| TimeEntry                        | `ExternalObjectRef`        | Time tracking data (duration, agent, billable flag) stored as external references linked to the parent Ticket.                                                                                                 |
| Macro / CannedResponse           | `ExternalObjectRef`        | Provider-specific automation templates. Stored as external references for audit and sync purposes.                                                                                                             |
| Trigger / Automation             | `ExternalObjectRef`        | Event-driven rules are deeply provider-specific. Stored as external references; VAOP does not execute them cross-platform.                                                                                     |
| View / Queue                     | `ExternalObjectRef`        | Saved filters and agent views. Stored as external references for workspace configuration sync.                                                                                                                 |
| Channel / Mailbox                | `ExternalObjectRef`        | Communication channel configuration. Stored as external references capturing channel type and routing metadata.                                                                                                |
| CustomField                      | `ExternalObjectRef`        | Tenant-defined schema extensions. Stored as typed external references preserving field name, type, and options.                                                                                                |
| Priority                         | `ExternalObjectRef`        | Priority levels vary across providers. Stored as external references with a normalised ordinal for cross-system comparison.                                                                                    |
| Status                           | `ExternalObjectRef`        | Ticket lifecycle states. Stored as external references mapped to a normalised status enum on the Ticket canonical.                                                                                             |
| Group / Team / Department        | `ExternalObjectRef`        | Agent groupings for routing. Stored as external references with membership metadata.                                                                                                                           |

---

## Notes

- **Zendesk** and **Freshdesk** together represent the majority of the cloud helpdesk market and should be the first two adapters implemented for Port 7.
- **Salesforce Service Cloud** and **HubSpot Service Hub** are high-value targets for customers already using those platforms for CRM (Port 6), enabling cross-port data correlation.
- The `Ticket` canonical deliberately unifies tickets, cases, and conversations under a single type. The `channel` attribute preserves the original communication medium.
- Knowledge articles are mapped to `Document` rather than `ExternalObjectRef` because they represent durable, content-rich records that benefit from full-text search and cross-port document aggregation.
- Comments are kept as `ExternalObjectRef` rather than `Document` because they are transactional, ticket-scoped, and lack standalone identity in most providers.

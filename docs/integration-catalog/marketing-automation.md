# Port 11: Marketing Automation — Integration Catalog

## Port Operations

| Operation               | Description                                                            | Idempotent |
| ----------------------- | ---------------------------------------------------------------------- | ---------- |
| `listContacts`          | List contacts/subscribers with filter by list, tag, segment, or status | Yes        |
| `getContact`            | Retrieve a single contact by canonical ID or email address             | Yes        |
| `createContact`         | Create a new contact with profile fields and list memberships          | No         |
| `updateContact`         | Update contact profile fields, tags, or subscription status            | No         |
| `listLists`             | List all audience lists / subscriber lists                             | Yes        |
| `getList`               | Retrieve a single list with member count and metadata                  | Yes        |
| `addContactToList`      | Subscribe a contact to a list                                          | No         |
| `removeContactFromList` | Unsubscribe a contact from a list                                      | No         |
| `listCampaigns`         | List campaigns with filter by status (draft, sent, scheduled) and type | Yes        |
| `getCampaign`           | Retrieve a single campaign with content and settings                   | Yes        |
| `createCampaign`        | Create a new campaign with audience, template, and schedule            | No         |
| `sendCampaign`          | Trigger immediate send or schedule a campaign for delivery             | No         |
| `getCampaignStats`      | Retrieve delivery, open, click, bounce, and unsubscribe statistics     | Yes        |
| `listAutomations`       | List automation workflows with filter by status                        | Yes        |
| `getAutomation`         | Retrieve an automation workflow with steps and trigger configuration   | Yes        |
| `triggerAutomation`     | Manually trigger an automation for a specific contact or event         | No         |
| `listForms`             | List signup forms and pop-ups                                          | Yes        |
| `getFormSubmissions`    | Retrieve form submission data with pagination                          | Yes        |
| `listTemplates`         | List email templates with filter by type or category                   | Yes        |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (>30 % market share or >50 k customers)

| Provider                  | Source                                                                         | Adoption | Est. Customers                                                           | API Style                             | Webhooks                                                                                 | Key Entities                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mailchimp** (Intuit)    | S1 — full REST API with OpenAPI spec, test API keys, extensive documentation   | A1       | ~12 M+ users; dominant in SMB email marketing                            | REST (JSON), OAuth 2.0 & API key auth | Yes — webhooks per list for subscribe, unsubscribe, profile update, campaign send events | List/Audience, Member/Contact, Campaign, Template, Automation, Segment, Tag, Report/Stats, Form (signup), LandingPage, Survey, Content (blocks) |
| **HubSpot Marketing Hub** | S1 — full REST API with OpenAPI spec, developer sandbox portal, extensive docs | A1       | ~200 k+ customers across HubSpot platform; Marketing Hub is core product | REST (JSON), OAuth 2.0                | Yes — webhook subscriptions via app-level webhook API with retry and batching            | Contact, List, Email, Campaign, Workflow (automation), Form, LandingPage, BlogPost, CTA, SocialMessage, File, Template, Analytics (reports)     |

### Tier A2 — Strong Contenders (10–30 % share or >10 k customers)

| Provider                        | Source                                                                         | Adoption | Est. Customers                                                         | API Style                                         | Webhooks                                                                   | Key Entities                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **ActiveCampaign**              | S1 — full REST API (v3) with OpenAPI spec, sandbox accounts available          | A2       | ~180 k+ customers; strong in SMB marketing + CRM                       | REST (JSON), API key auth                         | Yes — webhook actions configurable per automation or globally              | Contact, List, Campaign, Automation, Deal, Tag, CustomField, Form, Note, Task, Score, Segment, Event, SiteMessage    |
| **Brevo** (formerly Sendinblue) | S1 — full REST API (v3) with OpenAPI spec, test mode available                 | A2       | ~500 k+ business users; strong in European market                      | REST (JSON), API key auth                         | Yes — transactional and marketing webhooks (delivery, open, click, bounce) | Contact, List, Campaign, Template, Automation (Scenario), Sender, Webhook, Transactional (SMTP relay), SMS, WhatsApp |
| **Klaviyo**                     | S1 — REST API (v2024+) with OpenAPI spec, test API keys                        | A2       | ~100 k+ customers; dominant in eCommerce email/SMS (Shopify ecosystem) | REST (JSON), API key auth (private & public keys) | Yes — webhooks for flow, campaign, list, and profile events                | Profile, List, Segment, Campaign, Flow (automation), Template, Metric, Event, Catalog (product feed), Form           |
| **Marketo** (Adobe)             | S2 — REST API with documentation but no OpenAPI spec; sandbox requires license | A2       | ~5 k+ enterprise customers; dominant in B2B enterprise marketing       | REST (JSON), OAuth 2.0 (client credentials)       | Yes — webhook activities and Smart Campaign webhooks                       | Lead, List (static/smart), Program, Campaign, Email, SmartList, Token, Form, LandingPage, Activity, Snippet          |

### Best OSS for Domain Extraction

| Project      | Source                                                                | API Style                           | Key Entities                                                                                                        | Notes                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mautic**   | S1 — self-hosted, full REST API with Swagger docs, active community   | REST (JSON), OAuth 2.0 / basic auth | Contact, Segment, Campaign, Email, Form, Page (landing page), Point, Stage, Company, Asset, DynamicContent, Webhook | Full-featured open-source marketing automation. ~7 k GitHub stars. PHP-based (Symfony). Covers email, landing pages, forms, lead scoring, segmentation, and multi-channel campaigns. Good reference for entity modelling — entity schema closely mirrors commercial platforms. |
| **Listmonk** | S1 — self-hosted, clean REST API, Go-based, minimal but well-designed | REST (JSON), basic auth             | Subscriber, List, Campaign, Template, MediaFile                                                                     | Lightweight, high-performance mailing list and newsletter manager. ~15 k GitHub stars. Deliberately minimal entity model focused on core email workflows. PostgreSQL-backed. Excellent reference for the minimal viable entity set in this domain.                             |

### Tier A3 — Established Niche

| Provider             | Source                                                    | Adoption | Notes                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Constant Contact** | S1 — REST API (v3) with OpenAPI spec, sandbox environment | A3       | Long-established email marketing platform. Entities: Contact, List, Campaign, Template, Activity, CustomField. ~600 k customers. Strong with non-profits and small organisations. API is well-documented but feature set narrower than A1/A2 competitors. |
| **GetResponse**      | S1 — REST API (v3), API key auth, documentation available | A3       | Email marketing with landing pages and webinar features. Entities: Contact, Campaign, Newsletter, Autoresponder, LandingPage, Webinar, Form, Tag. ~350 k customers. Webinar integration is a differentiator not seen in other providers.                  |
| **Drip**             | S1 — REST API (v2), API key auth, well-documented         | A3       | eCommerce-focused marketing automation. Entities: Subscriber, Campaign, Workflow, Tag, Event, CustomField, Order, Product. ~30 k customers. Deep Shopify/WooCommerce integration. Event-driven automation model is distinctive.                           |

### Tier A4 — Emerging / Niche

| Provider               | Source                                            | Adoption | Notes                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Omnisend**           | S1 — REST API with documentation, API key auth    | A4       | eCommerce-focused email and SMS marketing. Entities: Contact, List, Campaign, Automation, Segment, Event, Order. Growing in Shopify ecosystem. SMS and push notification channels in addition to email. |
| **MailerLite**         | S1 — REST API (v2), well-documented, API key auth | A4       | Simple, affordable email marketing. Entities: Subscriber, Group, Campaign, Form, Automation, Segment, Webhook. ~1 M users but mostly on free tier. Clean API, good for small businesses.                |
| **Moosend** (Sitecore) | S1 — REST API, API key auth                       | A4       | Budget-friendly email marketing. Entities: Subscriber, List, Campaign, Segment, Automation. Acquired by Sitecore. Smaller ecosystem but competitive pricing. Limited API documentation quality.         |

---

## Universal Entity Catalog

Every entity type observed across the providers above, grouped by marketing-automation domain.

### Contact Management

| Entity                                             | Description                                                                              | Observed In                                                                                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Contact / Subscriber / Member / Lead / Profile** | A person in the marketing database with email, attributes, and engagement history        | All providers (name varies: Contact in HubSpot/ActiveCampaign/Brevo/Mautic, Subscriber in Listmonk/Drip, Member in Mailchimp, Lead in Marketo, Profile in Klaviyo) |
| **List / Audience**                                | A named collection of contacts for targeting campaigns                                   | All providers (Audience in Mailchimp, List elsewhere)                                                                                                              |
| **Segment**                                        | A dynamic, rule-based subset of contacts that auto-updates based on criteria             | Mailchimp, HubSpot, Klaviyo, ActiveCampaign, Mautic, Brevo                                                                                                         |
| **Tag**                                            | A label applied to contacts for flexible categorisation outside of lists                 | Mailchimp, ActiveCampaign, Klaviyo, Drip, GetResponse, Mautic                                                                                                      |
| **CustomField / Property**                         | A user-defined attribute on the contact record (e.g., company size, plan tier)           | ActiveCampaign, HubSpot, Constant Contact, Drip                                                                                                                    |
| **Score / Points**                                 | A numeric value representing lead engagement or qualification level                      | ActiveCampaign, Mautic (Points), Marketo (Lead Score)                                                                                                              |
| **Stage**                                          | A lifecycle stage in the lead-to-customer journey (subscriber, lead, MQL, SQL, customer) | Mautic, HubSpot (Lifecycle Stage), Marketo (Revenue Stage)                                                                                                         |
| **Company / Account**                              | An organisation associated with one or more contacts                                     | HubSpot, ActiveCampaign, Mautic, Marketo                                                                                                                           |

### Campaigns & Content

| Entity                           | Description                                                                     | Observed In                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Campaign / Email**             | A one-time or scheduled email send to a list or segment                         | All providers                                                                                                                                   |
| **Template**                     | A reusable email design (HTML/drag-and-drop) used in campaigns                  | All providers                                                                                                                                   |
| **Automation / Workflow / Flow** | A multi-step triggered sequence of actions (emails, delays, conditions, splits) | All providers (Automation in Mailchimp/ActiveCampaign/Brevo, Workflow in HubSpot/Drip, Flow in Klaviyo, Campaign in Mautic, Program in Marketo) |
| **DynamicContent**               | Personalised content blocks that change based on contact attributes or segments | Mautic, Marketo (Snippet), HubSpot (Smart Content)                                                                                              |
| **CTA** (Call-to-Action)         | A clickable button or banner embedded in content, tracked for conversions       | HubSpot                                                                                                                                         |
| **SocialMessage**                | A scheduled social media post managed alongside email campaigns                 | HubSpot                                                                                                                                         |

### Lead Capture

| Entity                 | Description                                                           | Observed In                                      |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| **Form**               | A web form for capturing leads (embedded, pop-up, or hosted)          | All providers                                    |
| **LandingPage / Page** | A standalone web page designed for conversion, hosted by the platform | Mailchimp, HubSpot, Marketo, Mautic, GetResponse |
| **Survey**             | A multi-question form for gathering feedback or research data         | Mailchimp                                        |

### Reporting & Analytics

| Entity                         | Description                                                                               | Observed In                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Report / Stats / Analytics** | Aggregate metrics for campaigns (delivered, opened, clicked, bounced, unsubscribed)       | All providers                                  |
| **Event / Activity**           | A timestamped record of a contact's action (email open, link click, page visit, purchase) | Klaviyo, ActiveCampaign, Drip, Marketo, Mautic |
| **Metric**                     | A named event type with aggregated statistics (e.g., "Placed Order", "Viewed Product")    | Klaviyo                                        |

### Multi-Channel

| Entity          | Description                                        | Observed In              |
| --------------- | -------------------------------------------------- | ------------------------ |
| **SMS**         | An SMS message sent to a contact's phone number    | Brevo, Klaviyo, Omnisend |
| **WhatsApp**    | A WhatsApp message sent via the platform           | Brevo                    |
| **SiteMessage** | An in-app or on-site message displayed to visitors | ActiveCampaign           |

### Configuration

| Entity                   | Description                                                                    | Observed In                                          |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **Sender / FromAddress** | A verified email address or domain used as the "From" address                  | Brevo, Mailchimp, Constant Contact                   |
| **Webhook**              | A configured HTTP callback for receiving real-time event notifications         | All providers with webhook support                   |
| **BlogPost**             | A blog article managed within the marketing platform's CMS                     | HubSpot                                              |
| **Asset / MediaFile**    | An uploaded file (image, PDF, document) available for use in emails and pages  | Mautic (Asset), Listmonk (MediaFile), HubSpot (File) |
| **Catalog**              | A product catalog feed used for personalised product recommendations in emails | Klaviyo                                              |

---

## VAOP Canonical Mapping

| Universal Entity                               | VAOP Canonical Object         | Mapping Notes                                                                                                                                                               |
| ---------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact / Subscriber / Member / Lead / Profile | `Party` (role: `lead`)        | Direct mapping. Marketing contacts are leads until they convert. Role tag distinguishes from customers, vendors, and employees. Email is the natural key for deduplication. |
| Company / Account                              | `Party` (role: `org`)         | Mapped to `Party` with organisation role. Linked to contact-level `Party` records via parent-child relationship.                                                            |
| List / Audience                                | `ExternalObjectRef`           | Lists are provider-specific grouping mechanisms. Stored as typed reference with member count metadata.                                                                      |
| Segment                                        | `ExternalObjectRef`           | Dynamic segments are defined by provider-specific query rules. Stored as reference with rule summary.                                                                       |
| Campaign / Email                               | `Campaign`                    | Direct mapping. VAOP `Campaign` captures name, status, type (email/SMS/multi-channel), schedule, and audience reference.                                                    |
| Template                                       | `Document` (type: `template`) | Mapped to `Document` with template type discriminator. Stores template name, subject line, and preview content. Actual HTML content kept as external reference.             |
| Automation / Workflow / Flow                   | `ExternalObjectRef`           | Automation structures are deeply provider-specific (step types, branching logic, triggers). Stored as typed reference with trigger description and status.                  |
| Form                                           | `ExternalObjectRef`           | Forms are provider-hosted UI components. Stored as reference with form name and submission count.                                                                           |
| LandingPage                                    | `ExternalObjectRef`           | Landing pages are provider-hosted. Stored as reference with URL and published status.                                                                                       |
| Tag                                            | `ExternalObjectRef`           | Tags are simple labels. Stored as reference with tag name. May be used for cross-system tag synchronisation.                                                                |
| Report / Stats / Analytics                     | `ExternalObjectRef`           | Reporting data is highly variable and provider-specific in granularity. Stored as reference with key metrics snapshot (sent, opened, clicked, bounced).                     |
| Event / Activity                               | `ExternalObjectRef`           | Behavioural events are high-volume and provider-specific. Stored as reference with event type and timestamp. Not ingested into VAOP's event store.                          |
| Score / Points                                 | `ExternalObjectRef`           | Lead scores are provider-computed values. Stored as reference with current score and last-updated timestamp.                                                                |
| CTA                                            | `ExternalObjectRef`           | Call-to-action elements are provider-hosted. Stored as reference with CTA name and click count.                                                                             |
| SocialMessage                                  | `ExternalObjectRef`           | Social posts are provider-managed. Stored as reference with platform (Facebook, LinkedIn, Twitter) and status.                                                              |
| SMS / WhatsApp                                 | `ExternalObjectRef`           | Multi-channel message records. Stored as reference with channel type, recipient, and delivery status.                                                                       |
| Sender / FromAddress                           | `ExternalObjectRef`           | Verified sender identities. Stored as reference with email address and verification status.                                                                                 |
| DynamicContent                                 | `ExternalObjectRef`           | Personalised content blocks. Stored as reference with content name and variant count.                                                                                       |
| Stage                                          | `ExternalObjectRef`           | Lifecycle stages vary by provider. Stored as reference with stage name and ordinal position.                                                                                |
| Webhook                                        | —                             | Internal configuration; not surfaced as a VAOP entity. Managed by the adapter connection layer.                                                                             |
| Asset / MediaFile                              | `Document` (type: `media`)    | Mapped to `Document` with media type discriminator. Stores filename, MIME type, and file size.                                                                              |
| Catalog                                        | `ExternalObjectRef`           | Product catalog feeds are eCommerce-specific. Stored as reference with product count and sync status.                                                                       |

---

## Notes

- **Mailchimp and HubSpot** together cover the majority of the SMB and mid-market marketing automation landscape and should be the first two adapters implemented.
- **Klaviyo** is the priority for eCommerce-focused customers given its dominance in the Shopify ecosystem and its rapidly growing market share.
- The `Contact` to `Party` mapping is the most critical canonical mapping in this port. VAOP must handle bidirectional sync carefully — marketing platforms are often the system of record for lead data, while CRM platforms (Port 6) are the system of record for converted customers. The `Party` canonical object with role tags (`lead`, `customer`) provides the unification layer.
- **Marketo** is classified as S2 despite having a REST API because it lacks a formal OpenAPI specification, requires a paid sandbox, and has notable API quirks (non-standard pagination, complex authentication flow, activity polling model).
- Automation/Workflow entities are deliberately kept as `ExternalObjectRef` because their internal structure (triggers, conditions, delays, splits, actions) is deeply provider-specific and not meaningfully normalisable across platforms. VAOP's value is in triggering and monitoring automations, not in translating their structure.

# Port 16: Analytics & BI — Integration Catalog

> Dashboards, reports, data visualisation, metrics, and business intelligence platforms.

---

## Port Operations

| Operation          | Description                                                                   | Idempotent | Webhook-Eligible |
| ------------------ | ----------------------------------------------------------------------------- | ---------- | ---------------- |
| `listDashboards`   | Paginated list of dashboards with optional filters (workspace, owner, tag)    | Yes        | —                |
| `getDashboard`     | Retrieve a single dashboard by ID, including layout and tile references       | Yes        | —                |
| `listReports`      | Paginated list of reports with optional filters (folder, type, modified date) | Yes        | —                |
| `getReport`        | Retrieve a single report by ID, including embedded query definitions          | Yes        | —                |
| `runQuery`         | Execute an ad-hoc or saved query against a connected data source              | No         | Yes              |
| `getQueryResults`  | Retrieve the results of a previously submitted query by job ID                | Yes        | —                |
| `listDataSources`  | List all configured data source connections                                   | Yes        | —                |
| `getDataSource`    | Retrieve connection details and status for a single data source               | Yes        | —                |
| `createDataSource` | Register a new data source connection (database, warehouse, API)              | No         | Yes              |
| `listDatasets`     | List datasets (tables, models, cubes) available within a workspace or project | Yes        | —                |
| `getDataset`       | Retrieve schema, refresh schedule, and metadata for a single dataset          | Yes        | —                |
| `refreshDataset`   | Trigger a manual refresh of a dataset's underlying data                       | No         | Yes              |
| `listMetrics`      | List defined metrics (KPIs, measures) across the BI platform                  | Yes        | —                |
| `exportReport`     | Export a report or dashboard to a file format (PDF, PNG, CSV, XLSX)           | No         | —                |
| `listUsers`        | List users with access to the analytics platform, including role assignments  | Yes        | —                |
| `shareReport`      | Grant or modify sharing permissions on a report or dashboard                  | No         | Yes              |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (MVP / P0)

| Provider                 | Source | Adoption | Est. Customers               | API Style                                                                                                                  | Webhooks                                                                                | Key Entities                                                                                                                       |
| ------------------------ | ------ | -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Tableau (Salesforce)** | S1     | A1       | ~100,000+ customers globally | REST (Tableau Server / Tableau Cloud REST API v3.x). OpenAPI spec available. Full sandbox via Tableau Developer Programme. | Yes (webhook subscriptions for datasource refresh, workbook update, extract operations) | Workbook, View, Dashboard, Datasource, Project, Site, User, Group, Schedule, Subscription, Metric, Flow, Job, Favorite, Permission |
| **Microsoft Power BI**   | S1     | A1       | ~300,000+ organisations      | REST (Power BI REST API v1.0). OpenAPI spec via Microsoft Graph. Sandbox via Power BI Embedded test environment.           | Yes (via Azure Event Grid — dataset refresh completed, report created, capacity events) | Dashboard, Report, Dataset, Dataflow, Workspace (Group), App, Tile, Capacity, Gateway, Refresh, User, Import, Table, Row, Measure  |

### Tier A2 — Must-Support Providers (P1)

| Provider                  | Source | Adoption | Est. Customers                                  | API Style                                                                               | Webhooks                                                                                                | Key Entities                                                                                                                |
| ------------------------- | ------ | -------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Looker (Google Cloud)** | S1     | A2       | ~10,000+ enterprise customers                   | REST (Looker API 4.0). OpenAPI 3.x spec published. Sandbox via Looker free trial.       | Limited (scheduled delivery only; no real-time webhooks — use Looker Actions or Dataflow triggers)      | Look, Dashboard, Query, Model, Explore, Connection, User, Group, Role, Folder, Schedule, Alert, Board, ContentMetadata      |
| **Google Analytics 4**    | S1     | A2       | Millions of properties (dominant web analytics) | REST (GA4 Data API v1, Admin API v1). Well-documented. OAuth 2.0.                       | No native webhooks (use BigQuery export streaming or Pub/Sub integration for near-real-time event data) | Property, DataStream, Event, Conversion, Audience, CustomDimension, CustomMetric, Account, UserLink, Report, RealtimeReport |
| **Metabase**              | S1     | A2       | ~50,000+ organisations (OSS + Cloud combined)   | REST (Metabase API). Auto-generated endpoint docs. Session-based auth and API keys.     | No native webhooks (use Pulse/Alert email subscriptions or poll for changes)                            | Card (Question), Dashboard, Collection, Database, Table, Field, Segment, Metric, Pulse, User, Group, Permission             |
| **Mixpanel**              | S1     | A2       | ~8,000+ customers                               | REST (Ingestion API, Query API, Management API). Well-documented with sandbox projects. | Limited (data pipelines can export to S3/GCS/webhook destinations)                                      | Event, UserProfile, Cohort, Funnel, Report, Insight, Board, Bookmark, DataPipeline                                          |
| **Amplitude**             | S1     | A2       | ~2,500+ enterprise customers                    | REST (HTTP API v2, Dashboard REST API, Taxonomy API). OAuth and API key auth.           | Limited (cohort syncing and data export via Amplitude Audiences webhooks)                               | Event, User, Cohort, Chart, Dashboard, Taxonomy, Release, DataPipeline                                                      |

### Best OSS for Domain Extraction

| Project             | Source | API Style                                                                                        | Key Entities                                                                                                    | Notes                                                                                                                                                             |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Metabase (OSS)**  | S1     | REST (full CRUD on all entities via same API as Cloud). Java-based. Docker deployment.           | Card (Question), Dashboard, Collection, Database, Table, Field, Segment, Metric, Pulse, User, Group, Permission | Most widely deployed OSS BI platform. API surface identical to hosted offering. Excellent reference implementation for entity extraction and adapter scaffolding. |
| **Apache Superset** | S1     | REST (Flask-based API with Swagger docs). Python-based. Full CRUD on all visualisation entities. | Dashboard, Chart, Dataset, Database, Slice, Table, Column, Metric, User, Role, Log, Query, SavedQuery           | ASF top-level project. Strong community. Superset API is well-structured and auto-documented. Good reference for dashboard/chart entity modelling.                |
| **Grafana**         | S1     | REST (Grafana HTTP API). Full CRUD. API key and OAuth auth. Comprehensive endpoint coverage.     | Dashboard, Panel, Datasource, Alert, Folder, User, Team, Organization, Annotation, Playlist, Snapshot           | Industry-standard for observability dashboards. API is mature and stable. Alert entity model is useful cross-reference with Port 17 (Monitoring).                 |
| **Redash**          | S1     | REST (Redash API). Python-based. Full CRUD on queries and dashboards. API key auth.              | Query, Visualization, Dashboard, DataSource, Alert, User, Group, QuerySnippet, Destination                      | Lightweight, query-first BI tool. Good reference for the Query/Visualization entity pattern. Project in maintenance mode but API is stable.                       |

### Tier A3/A4 — Long-Tail Candidates

| Provider                      | Source | Adoption | Notes                                                                                                                                                                                      |
| ----------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sisense**                   | S2     | A3       | Embedded analytics platform. REST API available but no public OpenAPI spec. ~2,000+ customers. Strong in embedded use cases; entity model centres on ElastiCube, Widget, Dashboard.        |
| **Domo**                      | S2     | A3       | Cloud-native BI. REST API with proprietary auth. ~2,500+ enterprise customers. Key entities: Page, Card, Dataset, DataFlow, User, Group. API coverage has gaps around governance features. |
| **Mode Analytics**            | S1     | A3       | Collaborative analytics for data teams. REST API with good documentation. ~1,500+ customers. Entities: Report, Query, Chart, Space, Collection. Strong SQL notebook model.                 |
| **Preset (managed Superset)** | S1     | A4       | Hosted Apache Superset with enterprise features. API mirrors Superset OSS. Growing adoption as commercial Superset offering. Adapter can share code with Superset OSS adapter.             |
| **Holistics**                 | S1     | A4       | Code-based BI platform. REST API with modelling layer (AML). Entities: Model, Dashboard, Report, DataSource, Transform. Emerging player in analytics-as-code space.                        |

---

## Universal Entity Catalog

Every entity type observed across all Analytics & BI providers, grouped by functional domain.

### Dashboards & Visualisations

| Entity        | Also Known As                                   | Observed In                                              |
| ------------- | ----------------------------------------------- | -------------------------------------------------------- |
| **Dashboard** | —                                               | All providers                                            |
| **Report**    | Look, Card, Question                            | Tableau, Power BI, Looker, Metabase, GA4, Mixpanel, Mode |
| **Chart**     | Visualization, View, Tile, Panel, Slice, Widget | Superset, Grafana, Amplitude, Redash, Sisense, Domo      |
| **Query**     | Question, SavedQuery, QuerySnippet              | Metabase, Redash, Superset, Mode, Looker                 |
| **Folder**    | Collection, Project, Workspace, Space           | Tableau, Looker, Metabase, Power BI, Mode                |

### Data Layer

| Entity         | Also Known As                    | Observed In                                  |
| -------------- | -------------------------------- | -------------------------------------------- |
| **Dataset**    | Datasource, Database, ElastiCube | Power BI, Metabase, Superset, Sisense, Domo  |
| **Table**      | Model, Explore                   | Power BI, Metabase, Superset, Looker         |
| **Column**     | Field, Dimension                 | Superset, Metabase, Looker                   |
| **Metric**     | Measure, KPI                     | All providers (as computed aggregation)      |
| **Connection** | Gateway, DataSource              | Tableau, Power BI, Looker, Redash, Grafana   |
| **Dataflow**   | Flow, DataPipeline, Transform    | Power BI, Tableau, Mixpanel, Amplitude, Domo |

### Scheduling & Distribution

| Entity       | Also Known As                | Observed In                         |
| ------------ | ---------------------------- | ----------------------------------- |
| **Schedule** | Refresh, Subscription, Pulse | Tableau, Power BI, Looker, Metabase |
| **Alert**    | Threshold                    | Metabase, Grafana, Redash, Looker   |
| **Import**   | Job, Extract                 | Tableau, Power BI                   |
| **Snapshot** | Export                       | Grafana                             |

### Access & Governance

| Entity         | Also Known As                           | Observed In                         |
| -------------- | --------------------------------------- | ----------------------------------- |
| **User**       | Viewer, Person                          | All providers                       |
| **Group**      | Team, Role                              | All providers                       |
| **Permission** | AccessControl, Sharing, ContentMetadata | Tableau, Power BI, Metabase, Looker |
| **Favorite**   | Bookmark, Star                          | Tableau, Mixpanel                   |
| **App**        | —                                       | Power BI                            |

### Product Analytics (GA4, Mixpanel, Amplitude)

| Entity              | Also Known As       | Observed In                        |
| ------------------- | ------------------- | ---------------------------------- |
| **Event**           | —                   | GA4, Mixpanel, Amplitude           |
| **UserProfile**     | User (analytics)    | Mixpanel, Amplitude                |
| **Cohort**          | Audience, Segment   | GA4, Mixpanel, Amplitude, Metabase |
| **Funnel**          | —                   | Mixpanel, Amplitude                |
| **Conversion**      | Goal                | GA4                                |
| **CustomDimension** | Taxonomy, Property  | GA4, Amplitude                     |
| **Property**        | DataStream, Account | GA4                                |
| **Annotation**      | —                   | Grafana, GA4                       |

---

## VAOP Canonical Mapping

Each universal entity is mapped to the VAOP canonical object that best captures its cross-system semantics. Analytics & BI entities are primarily read/display artefacts; VAOP orchestrates data refresh and access sharing rather than managing BI content directly.

| Universal Entity              | VAOP Canonical Object | Canonical Role / Type | Notes                                                                                     |
| ----------------------------- | --------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| Dashboard                     | **ExternalObjectRef** | —                     | Display artefact; deep-linked to SoR. VAOP can trigger refresh and manage sharing.        |
| Report / Look / Card          | **ExternalObjectRef** | —                     | Display artefact; varies too widely in structure across providers to normalise.           |
| Chart / Visualization         | **ExternalObjectRef** | —                     | Sub-component of dashboards/reports. Referenced for export operations.                    |
| Query / Question              | **ExternalObjectRef** | —                     | Query definitions are provider-specific (SQL, LookML, DAX, etc.).                         |
| Dataset / Datasource          | **ExternalObjectRef** | —                     | Data model definitions. VAOP triggers `refreshDataset` but does not own the schema.       |
| Metric / Measure              | **ExternalObjectRef** | —                     | Computed aggregation definitions. Too domain-specific to normalise across BI tools.       |
| User / Viewer                 | **Party**             | `role: user`          | BI platform user. Merged with Party records from other ports (HRIS, IAM).                 |
| Group / Team / Role           | **ExternalObjectRef** | —                     | Access control groupings within the BI platform.                                          |
| Folder / Collection / Project | **ExternalObjectRef** | —                     | Organisational container for BI content. Hierarchy varies per provider.                   |
| Schedule / Refresh            | **ExternalObjectRef** | —                     | Data refresh and report delivery schedules. VAOP can trigger but does not own.            |
| Alert / Threshold             | **ExternalObjectRef** | —                     | BI-level alerting (distinct from Port 17 operational alerts).                             |
| Connection / Gateway          | **ExternalObjectRef** | —                     | Data source connection configuration. Contains credentials managed via Port 10 (Secrets). |
| Import / DataPipeline         | **ExternalObjectRef** | —                     | ETL/ELT pipeline references. May cross-reference data integration tooling.                |
| Event (analytics)             | **ExternalObjectRef** | —                     | Product analytics event. High-volume; VAOP references but does not store event streams.   |
| UserProfile / Cohort          | **ExternalObjectRef** | —                     | Behavioural segments. May cross-reference CRM audiences.                                  |
| Funnel                        | **ExternalObjectRef** | —                     | Conversion analysis artefact. Provider-specific definition language.                      |
| Permission                    | **ExternalObjectRef** | —                     | BI-specific access rules. VAOP delegates to the SoR for enforcement.                      |
| Annotation                    | **ExternalObjectRef** | —                     | Contextual notes on dashboards or time-series data.                                       |

---

## Cross-Port References

| Related Port                   | Relationship                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Port 9: IAM & Directory        | BI platform users should be provisioned/deprovisioned via IAM lifecycle events. Group membership may sync.      |
| Port 10: Secrets & Vaulting    | Data source connection credentials (database passwords, OAuth tokens) are managed via the secrets port.         |
| Port 17: Monitoring & Incident | Grafana dashboards straddle both BI and monitoring. Alert entities in Grafana may trigger incidents in Port 17. |
| Port 13: Comms & Collaboration | Report sharing and scheduled delivery may route through Slack, Teams, or email channels.                        |
| Port 1: Finance & Accounting   | Financial dashboards and reports often connect to GL data, AP/AR summaries, and budget data sources.            |

---

## Implementation Notes

1. **Tableau authentication** — Tableau supports both personal access tokens (PAT) and username/password auth. The PAT approach is preferred for automated integrations. Tokens must be refreshed via the `signIn` endpoint to obtain a session token for subsequent API calls.
2. **Power BI capacity constraints** — Power BI REST API calls against shared capacity workspaces are subject to aggressive rate-limiting. For high-volume refresh orchestration, dedicated or Premium capacity is required. The adapter should implement retry with backoff and respect `Retry-After` headers.
3. **GA4 sampling** — Google Analytics 4 Data API responses may be sampled for large date ranges. The adapter should expose sampling metadata (e.g., `samplingSpaceSizes`) so consumers can assess data quality. Use the `keepEmptyRows` parameter for consistent row counts.
4. **Metabase session management** — Metabase API uses session tokens rather than API keys (though API keys were added in v0.47+). The adapter should handle session expiry and re-authentication transparently.
5. **Export format negotiation** — The `exportReport` operation must handle provider-specific format support. Tableau supports PDF, PNG, and CSV; Power BI supports PDF and PPTX; Metabase supports CSV, XLSX, and JSON. The adapter should validate requested format against provider capabilities.

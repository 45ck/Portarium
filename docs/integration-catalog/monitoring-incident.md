# Port 17: Monitoring & Incident Management — Integration Catalog

> Alerts, on-call scheduling, incident response, escalation policies, and status pages.

---

## Port Operations

| Operation                | Description                                                                               | Idempotent | Webhook-Eligible |
| ------------------------ | ----------------------------------------------------------------------------------------- | ---------- | ---------------- |
| `listAlerts`             | Paginated list of alerts with optional filters (status, severity, service, date range)    | Yes        | —                |
| `getAlert`               | Retrieve a single alert by ID, including trigger details and timeline                     | Yes        | —                |
| `acknowledgeAlert`       | Mark an alert as acknowledged by a responder                                              | No         | Yes              |
| `resolveAlert`           | Mark an alert as resolved with optional resolution notes                                  | No         | Yes              |
| `listIncidents`          | Paginated list of incidents with optional filters (status, priority, service)             | Yes        | —                |
| `getIncident`            | Retrieve a single incident by ID, including timeline, responders, and linked alerts       | Yes        | —                |
| `createIncident`         | Manually create a new incident with title, description, priority, and assigned service    | No         | Yes              |
| `updateIncident`         | Update mutable fields on an existing incident (status, priority, notes, responders)       | No         | Yes              |
| `listOnCallSchedules`    | List all on-call schedules with current and next on-call responder information            | Yes        | —                |
| `getOnCallSchedule`      | Retrieve a single on-call schedule, including rotation layers and overrides               | Yes        | —                |
| `createOnCallSchedule`   | Create a new on-call schedule with rotation rules and participants                        | No         | Yes              |
| `listEscalationPolicies` | List all escalation policies with their ordered escalation rules                          | Yes        | —                |
| `listServices`           | List all monitored services with status and integration details                           | Yes        | —                |
| `getService`             | Retrieve a single service, including integrations, dependencies, and current status       | Yes        | —                |
| `createStatusPage`       | Create a new public or private status page with component definitions                     | No         | Yes              |
| `updateStatusPage`       | Update the status of components, post an incident, or modify page content                 | No         | Yes              |
| `listMaintenanceWindows` | List scheduled maintenance windows with affected services and time ranges                 | Yes        | —                |
| `sendNotification`       | Dispatch a notification to specified users, teams, or channels about an incident or alert | No         | Yes              |

---

## Provider Catalog

### Tier A1 — Must-Support Providers (MVP / P0)

| Provider      | Source | Adoption | Est. Customers     | API Style                                                                                                                      | Webhooks                                                                                                                | Key Entities                                                                                                                                                          |
| ------------- | ------ | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PagerDuty** | S1     | A1       | ~28,000+ customers | REST (PagerDuty REST API v2). OpenAPI spec published. Full-featured sandbox via developer account. OAuth 2.0 and API key auth. | Yes (v3 webhooks — incident triggered, acknowledged, resolved, escalated, delegated, reopened; service created/updated) | Incident, Alert, Service, EscalationPolicy, Schedule, User, Team, Integration, Priority, MaintenanceWindow, StatusPage, ResponsePlay, Notification, Analytics, OnCall |
| **Datadog**   | S1     | A1       | ~28,000+ customers | REST (Datadog API v1/v2). OpenAPI spec available. Sandbox via free-tier account. API and Application key auth.                 | Yes (webhook integration — monitor alerts, incident state changes, event notifications; configurable payloads)          | Monitor, Event, Incident, Service, Dashboard, Metric, Log, Trace, SLO, Downtime, User, Role, SyntheticTest, Notebook, SecuritySignal                                  |

### Tier A2 — Must-Support Providers (P1)

| Provider                       | Source | Adoption | Est. Customers                                                      | API Style                                                                                                            | Webhooks                                                                                                                 | Key Entities                                                                                                                              |
| ------------------------------ | ------ | -------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Opsgenie (Atlassian)**       | S1     | A2       | ~10,000+ customers                                                  | REST (Opsgenie REST API v2). OpenAPI spec available. Sandbox via free plan. OAuth 2.0 and API key auth.              | Yes (webhook integrations and Opsgenie actions — alert created, acknowledged, closed, escalated; incident state changes) | Alert, Incident, Service, User, Team, Schedule, EscalationPolicy, Integration, Maintenance, Notification, Heartbeat, Policy               |
| **VictorOps / Splunk On-Call** | S1     | A2       | ~5,000+ customers (pre-Splunk acquisition)                          | REST (VictorOps Public API v1). API key auth. Documentation quality moderate.                                        | Yes (outgoing webhooks for incident lifecycle events)                                                                    | Incident, Alert, Team, User, EscalationPolicy, RoutingKey, OnCallSchedule, MaintenanceMode                                                |
| **New Relic**                  | S1     | A2       | ~16,000+ customers                                                  | REST and GraphQL (NerdGraph). OpenAPI spec for REST endpoints. GraphQL schema introspection available. API key auth. | Yes (webhook notification channel — alert condition violations, incident state changes)                                  | Alert (Condition, Policy, Channel), Incident, Application, Service, Dashboard, SyntheticMonitor, SLI/SLO, User, Account, Workload, Entity |
| **Statuspage (Atlassian)**     | S1     | A2       | ~50,000+ status pages hosted                                        | REST (Statuspage API v1). OpenAPI spec available. Free tier for testing. API key auth (page-scoped).                 | Yes (webhook subscribers — component status changes, incident updates, scheduled maintenance changes)                    | Page, Component, Incident, ScheduledMaintenance, Subscriber, Metric, ComponentGroup, PageAccessUser                                       |
| **Grafana OnCall**             | S1     | A2       | Growing adoption within Grafana Cloud (~20,000+ Grafana Cloud orgs) | REST (Grafana OnCall HTTP API). OpenAPI spec. Sandbox via Grafana Cloud free tier. Service account token auth.       | Yes (outgoing webhooks for alert group state changes, escalation events)                                                 | Alert, AlertGroup, Route, EscalationPolicy, Schedule, User, Team, Integration, OnCallShift                                                |

### Best OSS for Domain Extraction

| Project                       | Source | API Style                                                                                                                                   | Key Entities                                                                                                  | Notes                                                                                                                                                                                |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Prometheus + Alertmanager** | S1     | REST (Prometheus HTTP API for queries; Alertmanager API v2 for alert management). PromQL for metric queries. OpenAPI spec for Alertmanager. | Alert, Silence, Receiver, Route, InhibitRule, Target, Rule, RuleGroup                                         | Industry-standard metrics collection and alerting. De facto foundation for cloud-native monitoring. Alertmanager entity model is the reference for alert routing/silencing patterns. |
| **Zabbix**                    | S1     | REST/JSON-RPC (Zabbix API). Full CRUD on all entities. Comprehensive auto-generated documentation. Token-based auth.                        | Host, Trigger, Alert, Action, MediaType, User, UserGroup, Template, Item, Graph, Screen, Maintenance, Problem | Enterprise-grade infrastructure monitoring. One of the oldest and most complete monitoring APIs. Excellent reference for host/trigger/action entity modelling.                       |
| **Uptime Kuma**               | S1     | REST (limited — primary interface is Socket.IO). Community REST API wrappers available. Docker-first deployment.                            | Monitor, Heartbeat, Notification, StatusPage, Incident, MaintenanceWindow, Tag                                | Lightweight, self-hosted uptime monitoring. Simple entity model serves as a good baseline for status page and heartbeat patterns. API access requires community plugins.             |
| **Cachet**                    | S1     | REST (Cachet API v1). Full CRUD. API token auth. PHP/Laravel-based.                                                                         | Component, Incident, IncidentUpdate, Metric, MetricPoint, Subscriber, Schedule                                | Open-source status page system. Clean, well-defined entity model for status page domain. Good reference for Component/Incident/Subscriber patterns. Project in maintenance mode.     |

### Tier A3/A4 — Long-Tail Candidates

| Provider                                  | Source | Adoption | Notes                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Splunk ITSI**                           | S2     | A3       | Enterprise IT service intelligence. REST API available but requires Splunk Enterprise licence. Key entities: Service, KPI, GlassTable, Episode, NotableEvent. Complex deployment model limits adoption for pure incident management.                  |
| **xMatters**                              | S1     | A3       | Incident communication and response orchestration. REST API with good documentation. ~3,000+ customers. Entities: Event, Form, Group, Person, Plan, Scenario, Subscription. Strong in notification routing.                                           |
| **Better Stack (formerly Better Uptime)** | S1     | A3       | Modern uptime monitoring and status pages. REST API with OpenAPI spec. ~5,000+ customers. Entities: Monitor, Heartbeat, Incident, StatusPage, OnCallCalendar, EscalationPolicy. Clean API design.                                                     |
| **Squadcast**                             | S1     | A4       | Indian-origin incident management platform. REST API available. Growing in APAC region. Entities: Incident, Service, EscalationPolicy, Schedule, User, Team, Squad, Runbook. Competitive pricing for smaller teams.                                   |
| **incident.io**                           | S1     | A4       | Modern incident management with Slack-first workflow. REST API v2 with OpenAPI spec. ~1,000+ customers. Entities: Incident, IncidentRole, IncidentType, Severity, CustomField, Action, Follow-up, StatusPage. Strong focus on post-incident learning. |
| **FireHydrant**                           | S1     | A4       | Incident management with built-in runbooks. REST API available. ~500+ customers. Entities: Incident, Service, Environment, Functionality, Team, Runbook, RetrospectiveReport, StatusPage, ChangeEvent. Emphasis on reliability lifecycle.             |

---

## Universal Entity Catalog

Every entity type observed across all Monitoring & Incident Management providers, grouped by functional domain.

### Alerts & Incidents

| Entity           | Also Known As                               | Observed In                                                                              |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Alert**        | Alarm, Trigger, MonitorAlert, NotableEvent  | All providers                                                                            |
| **Incident**     | Problem, Episode, Event (context-dependent) | PagerDuty, Datadog, Opsgenie, VictorOps, New Relic, Statuspage, incident.io, FireHydrant |
| **Priority**     | Severity, Urgency                           | PagerDuty, Opsgenie, incident.io                                                         |
| **ResponsePlay** | Runbook, Scenario, Plan                     | PagerDuty, FireHydrant, xMatters                                                         |

### Services & Infrastructure

| Entity          | Also Known As                     | Observed In                                           |
| --------------- | --------------------------------- | ----------------------------------------------------- |
| **Service**     | Application, Host, Functionality  | PagerDuty, Datadog, Opsgenie, New Relic, FireHydrant  |
| **Monitor**     | Check, Probe, SyntheticTest, Item | Datadog, New Relic, Uptime Kuma, Zabbix, Better Stack |
| **Integration** | Receiver, Connection, Channel     | PagerDuty, Opsgenie, Grafana OnCall, Prometheus       |
| **Heartbeat**   | HealthCheck, Ping                 | Opsgenie, Uptime Kuma, Better Stack                   |

### On-Call & Escalation

| Entity               | Also Known As                            | Observed In                                                  |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| **Schedule**         | OnCallSchedule, Rotation, OnCallCalendar | PagerDuty, Opsgenie, VictorOps, Grafana OnCall, Better Stack |
| **EscalationPolicy** | EscalationChain, EscalationRule          | PagerDuty, Opsgenie, VictorOps, Grafana OnCall, Squadcast    |
| **OnCallShift**      | Override, Layer, RotationEntry           | PagerDuty, Grafana OnCall                                    |

### People & Teams

| Entity           | Also Known As                   | Observed In                                                     |
| ---------------- | ------------------------------- | --------------------------------------------------------------- |
| **User**         | Responder, Person, Contact      | All providers                                                   |
| **Team**         | Squad, Group, UserGroup         | PagerDuty, Datadog, Opsgenie, Grafana OnCall, Squadcast, Zabbix |
| **Notification** | Channel, MediaType, Destination | PagerDuty, Opsgenie, Zabbix, Uptime Kuma                        |

### Maintenance & Status

| Entity                | Also Known As                           | Observed In                                                                        |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| **MaintenanceWindow** | Downtime, Silence, ScheduledMaintenance | PagerDuty, Datadog, Zabbix, Statuspage, Uptime Kuma                                |
| **StatusPage**        | Page                                    | PagerDuty, Statuspage, Cachet, Uptime Kuma, incident.io, FireHydrant, Better Stack |
| **Component**         | ComponentGroup                          | Statuspage, Cachet                                                                 |
| **Subscriber**        | PageAccessUser                          | Statuspage, Cachet                                                                 |

### Observability & SLOs

| Entity        | Also Known As                   | Observed In                                           |
| ------------- | ------------------------------- | ----------------------------------------------------- |
| **SLO**       | SLI, SLA, ServiceLevelObjective | Datadog, New Relic                                    |
| **Dashboard** | GlassTable, Notebook            | Datadog, New Relic, Grafana (cross-reference Port 16) |
| **Metric**    | MetricPoint, KPI                | Datadog, New Relic, Statuspage, Cachet, Zabbix        |
| **Log**       | Event (observability), Trace    | Datadog, New Relic                                    |

### Rules & Configuration

| Entity          | Also Known As                                | Observed In                           |
| --------------- | -------------------------------------------- | ------------------------------------- |
| **Route**       | RoutingKey, RoutingRule                      | Grafana OnCall, Prometheus, VictorOps |
| **Rule**        | RuleGroup, AlertCondition, Policy (alerting) | Prometheus, New Relic, Zabbix         |
| **InhibitRule** | Suppression, MuteRule                        | Prometheus, Datadog                   |
| **Template**    | Action (Zabbix)                              | Zabbix                                |
| **Annotation**  | Note, Timeline entry                         | Grafana, Datadog                      |

---

## VAOP Canonical Mapping

Each universal entity is mapped to the VAOP canonical object that best captures its cross-system semantics. Incidents are the primary domain object that maps to a VAOP canonical type; most configuration entities remain as `ExternalObjectRef`.

| Universal Entity             | VAOP Canonical Object | Canonical Role / Type | Notes                                                                                                    |
| ---------------------------- | --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| Alert / Alarm / Trigger      | **ExternalObjectRef** | —                     | Alerts are transient signals. VAOP references them for correlation but does not own alert definitions.   |
| Incident / Problem           | **Ticket**            | `type: incident`      | Core operational entity. Maps to Ticket for cross-system incident tracking and lifecycle management.     |
| Service / Application / Host | **ExternalObjectRef** | —                     | Service topology is provider-specific. VAOP references services for routing and enrichment.              |
| Monitor / Check / Probe      | **ExternalObjectRef** | —                     | Monitoring configuration. VAOP orchestrates but does not own monitor definitions.                        |
| EscalationPolicy             | **ExternalObjectRef** | —                     | Escalation rules are tightly coupled to the alerting platform.                                           |
| Schedule / OnCallSchedule    | **ExternalObjectRef** | —                     | On-call rotation definitions. VAOP queries who-is-on-call but does not manage rotations.                 |
| User / Responder             | **Party**             | `role: employee`      | Responders are employees. Merged with Party records from HRIS (Port 4) and IAM (Port 9).                 |
| Team                         | **ExternalObjectRef** | —                     | Monitoring-specific team groupings. May cross-reference IAM groups.                                      |
| Notification / Channel       | **ExternalObjectRef** | —                     | Notification routing configuration. May cross-reference Comms (Port 13).                                 |
| MaintenanceWindow / Downtime | **ExternalObjectRef** | —                     | Scheduled suppression periods. VAOP can create/query but does not own.                                   |
| StatusPage / Component       | **ExternalObjectRef** | —                     | Public-facing status information. VAOP orchestrates updates via `createStatusPage` / `updateStatusPage`. |
| SLO / SLI / SLA              | **ExternalObjectRef** | —                     | Service level definitions. May cross-reference Customer Support SLAs (Port 7).                           |
| Dashboard                    | **ExternalObjectRef** | —                     | Monitoring dashboards. Cross-references Port 16 (Analytics & BI) for Grafana/Datadog dashboards.         |
| Metric / MetricPoint         | **ExternalObjectRef** | —                     | Time-series metric data. High-volume; VAOP references but does not store metric streams.                 |
| ResponsePlay / Runbook       | **ExternalObjectRef** | —                     | Automated response procedures. Provider-specific execution model.                                        |
| Heartbeat                    | **ExternalObjectRef** | —                     | Liveness check signals. Transient data referenced for health status.                                     |
| Subscriber                   | **Party**             | `role: contact`       | Status page subscribers. May be external stakeholders or customers.                                      |
| Route / Rule                 | **ExternalObjectRef** | —                     | Alert routing and rule configuration. Provider-specific DSL.                                             |

---

## Cross-Port References

| Related Port                   | Relationship                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Port 7: Customer Support       | Customer-facing incidents may trigger support tickets. SLA definitions may be shared or cross-referenced.                        |
| Port 8: ITSM & IT Ops          | ITSM incidents and monitoring incidents often overlap. Change management windows align with maintenance windows.                 |
| Port 9: IAM & Directory        | On-call responder identities should be synced from IAM. User provisioning/deprovisioning affects on-call schedules.              |
| Port 13: Comms & Collaboration | Incident notifications route through Slack, Teams, or PagerDuty-to-Slack integrations. Status page updates may post to channels. |
| Port 16: Analytics & BI        | Grafana and Datadog dashboards straddle monitoring and BI. Incident analytics feed into BI reporting.                            |
| Port 4: HRIS & HCM             | On-call responders are employees. Schedule management may need to respect PTO and leave data.                                    |

---

## Implementation Notes

1. **PagerDuty event routing** — PagerDuty distinguishes between the Events API v2 (for sending trigger/acknowledge/resolve events) and the REST API v2 (for managing resources). The adapter should use Events API for alert lifecycle and REST API for CRUD operations on services, schedules, and escalation policies.
2. **Datadog multi-site** — Datadog operates separate API endpoints for US (`api.datadoghq.com`), EU (`api.datadoghq.eu`), US3 (`us3.datadoghq.com`), US5 (`us5.datadoghq.com`), and AP1 (`ap1.datadoghq.com`). The adapter must be region-aware and route API calls to the correct site based on tenant configuration.
3. **Incident deduplication** — Multiple providers (PagerDuty, Opsgenie, Datadog) have built-in alert deduplication via dedup keys. The VAOP adapter should preserve and propagate dedup keys to prevent duplicate Ticket creation when the same underlying issue triggers alerts across multiple monitoring tools.
4. **Webhook signature verification** — PagerDuty (HMAC-SHA256), Datadog (HMAC-SHA256), and Opsgenie (proprietary) all sign outbound webhooks. The adapter must verify signatures before processing webhook payloads to prevent spoofing.
5. **On-call schedule complexity** — PagerDuty and Opsgenie support multi-layer schedules with overrides, restrictions, and handoff times. The adapter should expose the computed "who is on call now" result via `getOnCallSchedule` rather than attempting to replicate the scheduling engine.
6. **Status page incident vs. monitoring incident** — Statuspage incidents are public-facing communications; PagerDuty/Datadog incidents are internal operational records. The `createIncident` operation should clearly distinguish between these via a `visibility` or `type` parameter.

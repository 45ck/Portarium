# Privacy and Ethics: Purpose Limitation Policy

> **Bead:** bead-0811
> **Date:** 2026-02-23
> **Status:** Active
> **References:** ACM Code of Ethics, W3C Trace Context Privacy Considerations, GDPR Art. 5(1)(b)

## 1. Scope

This document defines the personal and sensitive data categories that Portarium
stores, their permitted purposes, retention expectations, and deletion procedures.
It applies to all Portarium components: control plane, execution plane, cockpit UI,
and observability pipeline.

## 2. Data categories and purpose constraints

### 2.1 User identity data

| Data element  | Domain type                   | Purpose                                          | Retention                        | Deletion                                                                        |
| ------------- | ----------------------------- | ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------- |
| User ID       | `UserId` (branded primitive)  | Authentication, authorisation, audit attribution | Lifetime of workspace membership | On user deactivation: pseudonymise in active records, purge from search indices |
| Email address | `WorkspaceUserV1.email`       | Login, notification delivery, display            | Lifetime of workspace membership | On user deactivation: remove from all stores                                    |
| Display name  | `WorkspaceUserV1.displayName` | UI display, audit trail readability              | Lifetime of workspace membership | On user deactivation: replace with pseudonym                                    |
| Roles         | `WorkspaceUserV1.roles`       | RBAC enforcement, SoD evaluation                 | Lifetime of workspace membership | On user deactivation: remove role bindings                                      |

**Prohibited uses:** User identity data must not be used for behavioural profiling,
performance scoring, or any purpose beyond authentication, authorisation, and audit
attribution.

### 2.2 Workforce and task assignment data

| Data element            | Domain type                            | Purpose                        | Retention                      | Deletion                                           |
| ----------------------- | -------------------------------------- | ------------------------------ | ------------------------------ | -------------------------------------------------- |
| Workforce member ID     | `WorkforceMemberId`                    | Task routing, queue membership | Lifetime of membership         | On removal: pseudonymise in completed task records |
| Availability status     | `WorkforceMemberV1.availabilityStatus` | Real-time task routing         | Transient (current state only) | Overwritten on each status change                  |
| Capabilities            | `WorkforceMemberV1.capabilities`       | Skill-based routing            | Lifetime of membership         | On removal: remove from routing tables             |
| Task assignment history | `HumanTaskV1` records                  | Audit trail, workload analysis | Per workspace retention policy | Per retention schedule                             |

**Prohibited uses:** Availability and task assignment data must not be used for
individual productivity monitoring, time tracking, or disciplinary purposes.

### 2.3 Location and telemetry data

| Data element           | Domain type                           | Purpose                                     | Retention                                     | Deletion                               |
| ---------------------- | ------------------------------------- | ------------------------------------------- | --------------------------------------------- | -------------------------------------- |
| Robot/machine position | `LocationEventV1`                     | Operational awareness, geofence enforcement | Configurable per workspace (default: 30 days) | Automated purge after retention window |
| Location trails        | Derived from `LocationEventV1` stream | Historical replay, incident investigation   | Same as position data                         | Same as position data                  |
| Heartbeat metrics      | Machine/agent heartbeat payloads      | Health monitoring, connectivity status      | Rolling window (default: 7 days)              | Automated purge                        |

**Prohibited uses:** Location data must not be used to track individual human
movements. Robot and machine location data is operational telemetry, not personal
data, unless a machine is directly operated by an identifiable human (in which case,
the same protections as workforce data apply).

### 2.4 Approval and evidence data

| Data element       | Domain type             | Purpose                                        | Retention                                                                 | Deletion                                                                 |
| ------------------ | ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Approval decisions | Approval domain model   | Governance audit trail, compliance             | Per regulatory requirement (minimum: 7 years for financial; configurable) | Only via formal retention policy expiry                                  |
| Decision rationale | Approval rationale text | Audit explainability                           | Same as approval decisions                                                | Same as approval decisions                                               |
| Evidence entries   | Evidence chain records  | Immutable audit trail, compliance verification | Per `RetentionScheduleV1` policy                                          | Automated purge after retention window; cryptographic tombstone retained |

**Prohibited uses:** Approval decisions must not be used to evaluate individual
approver performance or to penalise approvers for rejection patterns. Evidence
entries are immutable audit records and must not be modified post-creation.

### 2.5 Observability data (traces, logs, metrics)

| Data element       | Source              | Purpose                                                 | Retention        | Deletion                         |
| ------------------ | ------------------- | ------------------------------------------------------- | ---------------- | -------------------------------- |
| Distributed traces | OpenTelemetry SDK   | Debugging, performance analysis, incident investigation | Default: 14 days | Automated purge by Tempo/backend |
| Structured logs    | Pino logger         | Operational monitoring, error diagnosis                 | Default: 30 days | Automated purge by log backend   |
| Metrics            | Prometheus registry | SLO tracking, capacity planning                         | Default: 90 days | Automated rollup and purge       |

**Prohibited uses:** Traces and logs must never contain unredacted personal data.
The OTel redaction pipeline must strip user emails, bearer tokens, and request
bodies from span attributes. Correlation IDs (trace IDs, span IDs) must not be
used to correlate individual user activity across sessions unless required for
incident investigation.

## 3. Privacy engineering controls

### 3.1 Data minimisation

- Collect only what is needed for the stated purpose.
- API responses must not return fields beyond what the requesting role requires.
- Location events must not include precision beyond operational needs.

### 3.2 Pseudonymisation

- When users are deactivated, replace identity fields with pseudonyms in active
  records while preserving audit trail integrity.
- Use `UserId` branded primitives (not email) as the primary key in all internal
  stores, enabling clean pseudonymisation.

### 3.3 Redaction pipeline

- The OTel collector must redact sensitive attributes before export.
- Structured logs must never include: email addresses, bearer tokens, request
  bodies containing personal data, or full IP addresses.
- Evidence payloads must be sanitised before storage (see content sanitisation
  domain model).

### 3.4 Tenant isolation

- All data is scoped by `TenantId`. Cross-tenant data access is forbidden.
- Row-level security (when enabled in PostgreSQL) enforces isolation at the
  storage layer.
- API authorisation checks workspace membership on every request.

### 3.5 Dev-token environment gate

- The dev-token authentication bypass is enforced to only activate in
  `NODE_ENV=development` or `NODE_ENV=test` environments.
- A fatal startup error prevents accidental activation in staging or production.
- See: `src/infrastructure/auth/dev-token-env-gate.ts`.

## 4. Incident response for data exposure

If personal data is inadvertently exposed (log leak, trace leak, API over-sharing):

1. **Contain**: Identify the data scope (which tenants, which data categories).
2. **Notify**: Inform the affected workspace administrators within 72 hours.
3. **Remediate**: Patch the exposure vector, purge leaked data from caches and logs.
4. **Document**: Record the incident in the evidence store with a post-mortem.
5. **Review**: Update redaction rules and add regression tests to prevent recurrence.

## 5. Ethical commitments

Following the ACM Code of Ethics:

- **Avoid harm** (1.2): Portarium must not enable surveillance of individuals.
  Workforce routing is for operational efficiency, not monitoring.
- **Be honest and trustworthy** (1.3): The system must be transparent about what
  data it collects and why. No hidden data collection.
- **Respect privacy** (1.6): Purpose limitation is enforced at the data model
  level. Data collected for one purpose must not be repurposed without explicit
  consent.
- **Maintain competence** (2.6): Privacy controls must be tested and verified as
  part of the CI pipeline, not left to manual review.

## 6. Regulatory alignment

| Regulation        | Key requirement                            | Portarium alignment                                            |
| ----------------- | ------------------------------------------ | -------------------------------------------------------------- |
| GDPR Art. 5(1)(b) | Purpose limitation                         | This document defines permitted purposes per data category     |
| GDPR Art. 5(1)(c) | Data minimisation                          | API responses scoped by role; telemetry precision limited      |
| GDPR Art. 5(1)(e) | Storage limitation                         | Retention schedules defined per data category                  |
| GDPR Art. 17      | Right to erasure                           | User deactivation triggers pseudonymisation/deletion workflow  |
| GDPR Art. 25      | Data protection by design                  | Branded primitives, tenant isolation, redaction pipeline       |
| W3C Trace Context | Privacy considerations for correlation IDs | OTel redaction pipeline; trace IDs not used for user profiling |

## 7. Review schedule

This document must be reviewed:

- When new personal data categories are added to the domain model.
- When retention policies change.
- When new regulatory requirements are identified.
- At minimum annually.

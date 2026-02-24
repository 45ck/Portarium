# Weekly PE Audit: Orphaned Beads And Dependency Deadlocks

Generated: 2026-02-21T18:56:45.118Z
Week of: 2026-02-16
Source: `.beads/issues.jsonl`

## Snapshot

- Open beads: 135
- Open dependency edges: 187
- Open beads blocked by open prerequisites: 72
- Orphaned beads: 38
- Deadlock cycles: 0
- Beads participating in deadlocks: 0

## Orphaned Beads

| Bead      | Priority | Phase          | Title                                                                                                                                                                                       |
| --------- | -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bead-0165 | --       | unspecified    | Phase gate: Presentation complete — requires OpenAPI route parity, middleware, authN/RBAC, and envelope mapping beads are closed                                                            |
| bead-0167 | --       | unspecified    | Phase gate: Security complete — requires vulnerability, secret hygiene, tenant isolation, SoD, and sandboxing beads are closed                                                              |
| bead-0168 | --       | unspecified    | Phase gate: Release complete — requires ci:pr, quality gates, review audit, and QA evidence are closed                                                                                      |
| bead-0169 | --       | unspecified    | Release freeze: block new families while release closure bead is unresolved                                                                                                                 |
| bead-0298 | --       | unspecified    | Implement concrete infrastructure execution baseline (Terraform and deploy automation)                                                                                                      |
| bead-0315 | --       | unspecified    | Application query read-model projection strategy (denormalized read tables or materialized views) with cache + invalidation                                                                 |
| bead-0317 | --       | unspecified    | Application-level rate limiting and anti-abuse guard (tenant/user/action quotas, 429 semantics, retry-after policy)                                                                         |
| bead-0322 | --       | unspecified    | Provision and document Terraform remote state + locking for all infra stacks                                                                                                                |
| bead-0323 | --       | unspecified    | Code review: application-layer completion: acceptance evidence, test coverage, architecture-guard evidence, and rollback plan                                                               |
| bead-0324 | --       | unspecified    | Add Terraform state validation matrix in CI (format/init/validate + cost/security lint) across AWS/Azure/GCP stacks                                                                         |
| bead-0325 | --       | unspecified    | Build and validate AWS control-plane bootstrap script (EKS/VPC/RDS/S3/KMS) + one-click dev/staging/prod apply pattern                                                                       |
| bead-0327 | --       | unspecified    | Hardening pass: enforce egress allowlist, namespace isolation, and Vault workload auth in Kubernetes execution plane                                                                        |
| bead-0330 | --       | unspecified    | Draft Azure and GCP Terraform baselines to match AWS control-plane contract and evidence immutability assumptions                                                                           |
| bead-0381 | --       | unspecified    | App: load and stress testing (rate-limit validation under synthetic load, 429/Retry-After correctness, graceful shedding)                                                                   |
| bead-0383 | --       | unspecified    | App: event schema versioning governance (CloudEvents type versioning rules, schema registry pattern, consumer resilience)                                                                   |
| bead-0387 | --       | unspecified    | Infra: environment model and artefact promotion pipeline (dev/staging/prod definitions, config-per-env, artefact-based promotion)                                                           |
| bead-0388 | --       | unspecified    | Infra: Temporal workflow runtime deployment (Helm chart, persistence stores, HA configuration, visibility backend)                                                                          |
| bead-0392 | --       | unspecified    | Infra: multi-tenant storage tier automation (schema-per-tenant provisioning, DB-per-tenant lifecycle, backup/restore per tier)                                                              |
| bead-0393 | --       | unspecified    | Infra: SLO definitions, dashboards, and alerting (API latency/error, workflow completion, worker actions, evidence integrity)                                                               |
| bead-0394 | --       | unspecified    | Infra: progressive delivery pipeline (canary or blue-green deployment, traffic shifting, automated rollback on SLO breach)                                                                  |
| bead-0395 | --       | unspecified    | Infra: CI OIDC federation for cloud access (GitHub Actions OIDC to cloud providers, no long-lived credentials)                                                                              |
| bead-0396 | --       | unspecified    | Infra: Kubernetes health probes and PodDisruptionBudgets for all control-plane and worker services                                                                                          |
| bead-0397 | --       | unspecified    | Infra: DR drills and automated recovery validation (DB restore, cluster recreation from IaC, evidence store replication verification)                                                       |
| bead-0398 | --       | unspecified    | Infra: FinOps tagging and cost governance (resource tagging, environment budgets, right-sizing, autoscaling strategy)                                                                       |
| bead-0421 | --       | unspecified    | Infra: Mautic reference adapter for MarketingAutomation port family (campaign CRUD, contact segmentation, workflow trigger integration)                                                     |
| bead-0423 | --       | unspecified    | Infra: Zammad reference adapter for CustomerSupport port family (ticket intake, triage, SLA tracking, knowledge base integration)                                                           |
| bead-0424 | --       | unspecified    | Infra: GitHub reference adapter for software development operations (PR lifecycle, deployment events, DORA metrics collection - lead time, deployment frequency, change failure rate, MTTR) |
| bead-0428 | --       | unspecified    | Infra: OTel Collector production pipeline - add OTLP trace/metrics/logs backend, alerting, and cross-signal correlation beyond current logging-only config                                  |
| bead-0518 | P2       | infrastructure | Infra: OPC UA connector prototype using node-opcua for industrial PLC actuation                                                                                                             |
| bead-0595 | P2       | presentation   | Cockpit: Users/RBAC management page (/config/users)                                                                                                                                         |
| bead-0750 | P1       | governance     | Licensing gate: third-party workflow UI/components compliance checklist                                                                                                                     |
| bead-0751 | P1       | presentation   | Cockpit IA baseline: work-item hub, approvals, evidence, correlation                                                                                                                        |
| bead-0752 | P1       | integration    | API contract alignment: cockpit-to-control-plane compatibility layer                                                                                                                        |
| bead-0753 | P2       | governance     | Evaluate n8n Embed path vs native cockpit workflow editor                                                                                                                                   |
| bead-0754 | P1       | security       | Credential boundary model for agentic workflows                                                                                                                                             |
| bead-0755 | P1       | security       | Supply-chain guardrails for cockpit and connector dependencies                                                                                                                              |
| bead-0756 | P1       | integration    | Execution durability decision: Temporal/LangGraph integration blueprint                                                                                                                     |
| bead-0757 | P1       | release        | Cockpit MVP plan with milestone estimates and decision gates                                                                                                                                |

## Dependency Deadlocks

No dependency deadlocks detected.

## Rules

- Orphaned bead: open bead with no open blockers and no open dependents.
- Dependency deadlock: strongly-connected component in the open-bead dependency graph (including self-loop).

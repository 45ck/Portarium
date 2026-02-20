# Weekly PE Audit: Orphaned Beads And Dependency Deadlocks

Generated: 2026-02-20T02:38:44.034Z
Week of: 2026-02-16
Source: `.beads/issues.jsonl`

## Snapshot

- Open beads: 171
- Open dependency edges: 25
- Open beads blocked by open prerequisites: 20
- Orphaned beads: 142
- Deadlock cycles: 0
- Beads participating in deadlocks: 0

## Orphaned Beads

| Bead | Priority | Phase | Title |
| --- | --- | --- | --- |
| bead-0162 | -- | unspecified | Phase gate: Domain complete — requires aggregate invariants, parser coverage, domain factory, and ADR traceability beads are closed |
| bead-0163 | -- | unspecified | Phase gate: Application complete — requires DTOs, use-cases, orchestration tests, and approval/run policy mapping are closed |
| bead-0164 | -- | unspecified | Phase gate: Infrastructure complete — requires persistence, outbox, migration, observability, and security containment beads are closed |
| bead-0165 | -- | unspecified | Phase gate: Presentation complete — requires OpenAPI route parity, middleware, authN/RBAC, and envelope mapping beads are closed |
| bead-0166 | -- | unspecified | Phase gate: Integration complete — requires per-family readiness, contract fixtures, and end-to-end smoke beads are closed |
| bead-0167 | -- | unspecified | Phase gate: Security complete — requires vulnerability, secret hygiene, tenant isolation, SoD, and sandboxing beads are closed |
| bead-0168 | -- | unspecified | Phase gate: Release complete — requires ci:pr, quality gates, review audit, and QA evidence are closed |
| bead-0169 | -- | unspecified | Release freeze: block new families while release closure bead is unresolved |
| bead-0170 | -- | unspecified | Per-ADR closure: ADR-001 through ADR-0040 must each have implementation, review, and verification evidence before any dependent Bead close |
| bead-0171 | -- | unspecified | Per-ADR closure: ADR-0041 through ADR-0043 must be promoted from proposed/accepted states before GA release |
| bead-0172 | -- | unspecified | Per-ADR closure: ADR-0048 to ADR-0138 legacy gaps from research pipeline must be mapped to implementation and review Beads |
| bead-0174 | -- | unspecified | Review: verify no adapter work starts without canonical-to-provider mapping evidence and operation matrix completeness |
| bead-0178 | -- | unspecified | Code review: validate architecture boundaries for every new scaffold file before code merge |
| bead-0179 | -- | unspecified | CI gate: require architecture-guard, gate-baseline, and npm audit before each merge |
| bead-0180 | -- | unspecified | CI gate: require OpenAPI parser/golden fixture parity on every push and PR for all operationIds |
| bead-0181 | -- | unspecified | Test evidence: require coverage thresholds on all newly added domain/application/infrastructure code |
| bead-0182 | -- | unspecified | Test evidence: require mutation-test or targeted fault-injection tests for policy and SoD logic before closure |
| bead-0183 | -- | unspecified | Review: tie each spec in .specify/specs to at least one implementation and one test bead |
| bead-0184 | -- | unspecified | Review: tie each open implementation bead to at least one test evidence bead and one code-review bead before transition |
| bead-0189 | -- | unspecified | Runbook: rollback plan for failing cycle (what to freeze, rollback scope, and communication template) |
| bead-0190 | -- | unspecified | Runbook review: validate rollback plan includes data, evidence, and credential cleanup actions |
| bead-0191 | -- | unspecified | PE quality: define acceptance scorecard for each Bead (spec alignment, tests, review, docs, security, performance) |
| bead-0192 | -- | unspecified | PE quality: define stop-loss thresholds (risk score, failed gates, unresolved open decisions) that force cycle halt |
| bead-0193 | -- | unspecified | E2E data-model: define canonical seeds for workspace, policy, run, evidence, and work-item across all tests |
| bead-0194 | -- | unspecified | E2E data-model: define synthetic evidence and retention fixtures for proof-of-retention and legal-hold workflows |
| bead-0195 | -- | unspecified | Generate tenant-isolated fixture factories for every aggregate and port operation |
| bead-0196 | -- | unspecified | Review: verify tenant-isolated fixtures block cross-tenant leakage in tests and docs |
| bead-0207 | -- | unspecified | Closeout review: Scaffold domain model structure (aggregates, ports, events, canonical objects) |
| bead-0208 | -- | unspecified | Closeout review: IAM MVP: workspace users + RBAC roles + auth integration |
| bead-0209 | -- | unspecified | Closeout review: Control plane API v1: approvals/workflows/runs OpenAPI |
| bead-0210 | -- | unspecified | Closeout review: ADR-029: Implement tamper-evident hash chain + signature hooks on EvidenceEntry and Artifact lineage |
| bead-0211 | -- | unspecified | Closeout review: ADR-030: Implement quota-aware execution primitives in orchestration scheduling and adapter call wrapper |
| bead-0212 | -- | unspecified | Closeout review: ADR-031: Implement SoD model evaluation, incompatible role graph, and threshold counters on approval routing |
| bead-0213 | -- | unspecified | Closeout review: ADR-032: Implement CloudEvents envelope for all event emission points and subscription contracts |
| bead-0214 | -- | unspecified | Closeout review: ADR-033: Implement OTel context propagation in request, workflow, adapter, and machine call stacks |
| bead-0215 | -- | unspecified | Closeout review: ADR-034: Enforce containment and least-privilege assumptions in machine and adapter execution environments |
| bead-0216 | -- | unspecified | Closeout review: ADR-035: Finalize domain-atlas pipeline stages into reproducible CI job and artifact validation stage |
| bead-0217 | -- | unspecified | Closeout review: ADR-036: Implement product identity labels and telemetry metadata using Portarium naming across docs/spec/error envelopes |
| bead-0218 | -- | unspecified | Closeout review: ADR-037: Model git-backed definitions and runtime truth divergence handling in services and reconciliation flows |
| bead-0219 | -- | unspecified | Closeout review: ADR-038: Implement Work Item universal binding domain + query surfaces with evidence/run/workflow linkages |
| bead-0220 | -- | unspecified | Closeout review: ADR-039 reference-vertical package: Add software-change-management reference pack with evidence and policy semantics |
| bead-0221 | -- | unspecified | Closeout review: Port-family integration candidate matrix: assign owners and blockers for all 18 families with required artifact dependencies |
| bead-0222 | -- | unspecified | Closeout review: Per-family operation contract stubs from integration-catalog tables into testable machine-readable fixtures |
| bead-0223 | -- | unspecified | Closeout review: FinanceAccounting port adapter foundation |
| bead-0224 | -- | unspecified | Closeout review: FinanceAccounting port adapter integration tests |
| bead-0225 | -- | unspecified | Closeout review: PaymentsBilling port adapter foundation |
| bead-0226 | -- | unspecified | Closeout review: PaymentsBilling port adapter integration tests |
| bead-0227 | -- | unspecified | Closeout review: ProcurementSpend port adapter foundation |
| bead-0228 | -- | unspecified | Closeout review: ProcurementSpend port adapter integration tests |
| bead-0229 | -- | unspecified | Closeout review: HrisHcm port adapter foundation |
| bead-0230 | -- | unspecified | Closeout review: HrisHcm port adapter integration tests |
| bead-0231 | -- | unspecified | Closeout review: Payroll port adapter foundation |
| bead-0232 | -- | unspecified | Closeout review: Payroll port adapter integration tests |
| bead-0233 | -- | unspecified | Closeout review: CrmSales port adapter foundation |
| bead-0234 | -- | unspecified | Closeout review: CrmSales port adapter integration tests |
| bead-0235 | -- | unspecified | Closeout review: CustomerSupport port adapter foundation |
| bead-0236 | -- | unspecified | Closeout review: CustomerSupport port adapter integration tests |
| bead-0237 | -- | unspecified | Closeout review: ItsmItOps port adapter foundation |
| bead-0238 | -- | unspecified | Closeout review: ItsmItOps port adapter integration tests |
| bead-0239 | -- | unspecified | Closeout review: IamDirectory port adapter foundation |
| bead-0240 | -- | unspecified | Closeout review: IamDirectory port adapter integration tests |
| bead-0241 | -- | unspecified | Closeout review: SecretsVaulting port adapter foundation |
| bead-0242 | -- | unspecified | Closeout review: SecretsVaulting port adapter integration tests |
| bead-0243 | -- | unspecified | Closeout review: MarketingAutomation port adapter foundation |
| bead-0244 | -- | unspecified | Closeout review: MarketingAutomation port adapter integration tests |
| bead-0245 | -- | unspecified | Closeout review: AdsPlatforms port adapter foundation |
| bead-0246 | -- | unspecified | Closeout review: AdsPlatforms port adapter integration tests |
| bead-0247 | -- | unspecified | Closeout review: CommsCollaboration port adapter foundation |
| bead-0248 | -- | unspecified | Closeout review: CommsCollaboration port adapter integration tests |
| bead-0249 | -- | unspecified | Closeout review: ProjectsWorkMgmt port adapter foundation |
| bead-0250 | -- | unspecified | Closeout review: ProjectsWorkMgmt port adapter integration tests |
| bead-0251 | -- | unspecified | Closeout review: DocumentsEsign port adapter foundation |
| bead-0252 | -- | unspecified | Closeout review: DocumentsEsign port adapter integration tests |
| bead-0253 | -- | unspecified | Closeout review: AnalyticsBi port adapter foundation |
| bead-0254 | -- | unspecified | Closeout review: AnalyticsBi port adapter integration tests |
| bead-0255 | -- | unspecified | Closeout review: MonitoringIncident port adapter foundation |
| bead-0256 | -- | unspecified | Closeout review: MonitoringIncident port adapter integration tests |
| bead-0257 | -- | unspecified | Closeout review: ComplianceGrc port adapter foundation |
| bead-0258 | -- | unspecified | Closeout review: ComplianceGrc port adapter integration tests |
| bead-0259 | -- | unspecified | Closeout review: PE: master execution DAG — encode open beads by phase, dependency, and evidence |
| bead-0260 | -- | unspecified | Closeout review: Phase gate: Foundation complete — requires gate, security baseline, and API contract beads are closed |
| bead-0261 | -- | unspecified | Closeout review: Phase gate: Domain complete — requires aggregate invariants, parser coverage, domain factory, and ADR traceability beads are closed |
| bead-0262 | -- | unspecified | Closeout review: Phase gate: Application complete — requires DTOs, use-cases, orchestration tests, and approval/run policy mapping are closed |
| bead-0263 | -- | unspecified | Closeout review: Phase gate: Infrastructure complete — requires persistence, outbox, migration, observability, and security containment beads are closed |
| bead-0264 | -- | unspecified | Closeout review: Phase gate: Presentation complete — requires OpenAPI route parity, middleware, authN/RBAC, and envelope mapping beads are closed |
| bead-0298 | -- | unspecified | Implement concrete infrastructure execution baseline (Terraform and deploy automation) |
| bead-0299 | -- | unspecified | AuthZ: application-layer authorization actions and forbidden-action typing contract |
| bead-0311 | -- | unspecified | Closeout review: Domain hardening release gate must confirm all new domain-beads above are merged, tested, and owner-signed |
| bead-0312 | -- | unspecified | Application-layer implementation roadmap: scope and acceptance criteria for register-workspace/start-workflow/submit-approval + remaining core use-cases |
| bead-0313 | -- | unspecified | Application-level observability: traces/logs/metrics correlation (traceparent, OTel spans, security-safe attributes) |
| bead-0315 | -- | unspecified | Application query read-model projection strategy (denormalized read tables or materialized views) with cache + invalidation |
| bead-0317 | -- | unspecified | Application-level rate limiting and anti-abuse guard (tenant/user/action quotas, 429 semantics, retry-after policy) |
| bead-0318 | -- | unspecified | Implement and wire policy/authorization matrix for all app commands and queries (APP_ACTIONS coverage + tenant-aware checks) |
| bead-0321 | -- | unspecified | Add end-to-end integration tests for application-layer idempotency, replay safety, outbox dispatch ordering, and failure injections |
| bead-0322 | -- | unspecified | Provision and document Terraform remote state + locking for all infra stacks |
| bead-0323 | -- | unspecified | Code review: application-layer completion: acceptance evidence, test coverage, architecture-guard evidence, and rollback plan |
| bead-0324 | -- | unspecified | Add Terraform state validation matrix in CI (format/init/validate + cost/security lint) across AWS/Azure/GCP stacks |
| bead-0325 | -- | unspecified | Build and validate AWS control-plane bootstrap script (EKS/VPC/RDS/S3/KMS) + one-click dev/staging/prod apply pattern |
| bead-0327 | -- | unspecified | Hardening pass: enforce egress allowlist, namespace isolation, and Vault workload auth in Kubernetes execution plane |
| bead-0328 | -- | unspecified | AuthN/AuthZ production hardening (OIDC validation claims, tenancy checks, role scoping, token refresh and rotation strategy) |
| bead-0329 | -- | unspecified | Implement CI/CD provenance and image signing for control-plane/execution-plane containers (SBOM + attestation) |
| bead-0330 | -- | unspecified | Draft Azure and GCP Terraform baselines to match AWS control-plane contract and evidence immutability assumptions |
| bead-0378 | -- | unspecified | App: API backward compatibility and versioning strategy (versioned paths, additive-only field rules, deprecation policy, content negotiation) |
| bead-0379 | -- | unspecified | App: input validation framework at command/query boundary (schema validation, allow-lists, RFC 9457 rejection for invalid inputs) |
| bead-0380 | -- | unspecified | CI: security gates (OpenAPI breaking-change diff checks, dependency vulnerability scanning, secret scanning) |
| bead-0381 | -- | unspecified | App: load and stress testing (rate-limit validation under synthetic load, 429/Retry-After correctness, graceful shedding) |
| bead-0383 | -- | unspecified | App: event schema versioning governance (CloudEvents type versioning rules, schema registry pattern, consumer resilience) |
| bead-0384 | -- | unspecified | App: HTTP precondition support for optimistic concurrency (ETag, If-Match, 412 Precondition Failed) |
| bead-0387 | -- | unspecified | Infra: environment model and artefact promotion pipeline (dev/staging/prod definitions, config-per-env, artefact-based promotion) |
| bead-0388 | -- | unspecified | Infra: Temporal workflow runtime deployment (Helm chart, persistence stores, HA configuration, visibility backend) |
| bead-0390 | -- | unspecified | Infra: OTel Collector deployment and observability backend wiring (Collector Helm chart, OTLP pipelines, metrics/traces/logs backend integration) |
| bead-0392 | -- | unspecified | Infra: multi-tenant storage tier automation (schema-per-tenant provisioning, DB-per-tenant lifecycle, backup/restore per tier) |
| bead-0393 | -- | unspecified | Infra: SLO definitions, dashboards, and alerting (API latency/error, workflow completion, worker actions, evidence integrity) |
| bead-0394 | -- | unspecified | Infra: progressive delivery pipeline (canary or blue-green deployment, traffic shifting, automated rollback on SLO breach) |
| bead-0395 | -- | unspecified | Infra: CI OIDC federation for cloud access (GitHub Actions OIDC to cloud providers, no long-lived credentials) |
| bead-0396 | -- | unspecified | Infra: Kubernetes health probes and PodDisruptionBudgets for all control-plane and worker services |
| bead-0397 | -- | unspecified | Infra: DR drills and automated recovery validation (DB restore, cluster recreation from IaC, evidence store replication verification) |
| bead-0398 | -- | unspecified | Infra: FinOps tagging and cost governance (resource tagging, environment budgets, right-sizing, autoscaling strategy) |
| bead-0399 | -- | unspecified | Infra: workflow durability fault-injection testing (pod kill, DB failover, network partition, verify workflow resume) |
| bead-0403 | P1 | infrastructure | Spike: evaluate Activepieces piece coverage for the 18 port adapter families |
| bead-0406 | -- | unspecified | Infra: DomainEvent trigger routing to Activepieces webhook endpoint with tenantId and correlationId headers |
| bead-0410 | -- | unspecified | Infra: Activepieces custom piece TypeScript npm package pattern for Portarium port adapter families |
| bead-0411 | -- | unspecified | App: trigger-to-execution-plane routing - route TriggerKind to correct execution plane adapter at workflow start |
| bead-0412 | -- | unspecified | Spike: evaluate Kestra for CloudEvents-triggered ops and pipeline workloads (OTel integration, scalable execution) |
| bead-0413 | -- | unspecified | Spike: evaluate StackStorm for event-driven IT ops automation (sensors, rules, workflows pattern for ITSM and monitoring families) |
| bead-0414 | -- | unspecified | Governance: licence compliance audit for adopted execution platforms (Activepieces MIT EE carve-outs, Kestra Apache 2.0 EE features) |
| bead-0420 | -- | unspecified | Domain: add consent and privacy policy canonical objects for marketing operations (opt-in status, suppression lists, consent audit trail) |
| bead-0421 | -- | unspecified | Infra: Mautic reference adapter for MarketingAutomation port family (campaign CRUD, contact segmentation, workflow trigger integration) |
| bead-0422 | -- | unspecified | Infra: Odoo or ERPNext reference adapter for FinanceAccounting port family (GL, AR/AP, invoice lifecycle, period close hooks) |
| bead-0423 | -- | unspecified | Infra: Zammad reference adapter for CustomerSupport port family (ticket intake, triage, SLA tracking, knowledge base integration) |
| bead-0424 | -- | unspecified | Infra: GitHub reference adapter for software development operations (PR lifecycle, deployment events, DORA metrics collection - lead time, deployment frequency, change failure rate, MTTR) |
| bead-0428 | -- | unspecified | Infra: OTel Collector production pipeline - add OTLP trace/metrics/logs backend, alerting, and cross-signal correlation beyond current logging-only config |
| bead-0429 | -- | unspecified | Governance: domain coverage matrix - map Portarium port families and canonical objects against operational domain requirements (marketing, finance, accounting, IT support, software delivery) with gap tracking |
| bead-0433 | P1 | application | App: Agent Task action execution path in workflow runner - dispatch to MachineInvokerPort, policy tier gating (Auto/Assisted pass-through, HumanApprove pauses run), status transitions |
| bead-0434 | -- | unspecified | App: Machine/agent registration command handlers - RegisterMachine, CreateAgent, UpdateAgentCapabilities with tenancy enforcement and evidence emission |
| bead-0441 | -- | unspecified | Testing: Contract tests for machine/agent OpenAPI endpoints - schema validation, RBAC role gating, Problem Details error shapes, multi-tenant scoping assertions |
| bead-0442 | -- | unspecified | Testing: Integration tests for OpenClaw Gateway adapter with stub HTTP server - deterministic fixtures, 429/Retry-After backoff, policy-blocked tool scenarios, agent output capture |
| bead-0444 | -- | unspecified | Governance: OpenClaw tool blast-radius policy - map Gateway tools/skills to Portarium capability tiers; dangerous tools default to HumanApprove; policy violations surface as Policy blocked run state |
| bead-0445 | -- | unspecified | Governance: OpenClaw multi-tenant isolation strategy - per-workspace or per-security-domain Gateway deployment model; credential scoping; network isolation requirements; documented decision record |
| bead-0448 | P1 | domain | Spec: Policy evaluation rule language — decide and document condition grammar for PolicyInlineRuleV1.condition (CEL, OPA/Rego, or constrained DSL) and implement evaluator; current bare-string condition is ambiguous, unevaluable, and a security risk |
| bead-0518 | P2 | infrastructure | Infra: OPC UA connector prototype using node-opcua for industrial PLC actuation |
| bead-0586 | P1 | presentation | Cockpit assets: domain icon gap expansion + transparent icon pipeline |

## Dependency Deadlocks

No dependency deadlocks detected.

## Rules

- Orphaned bead: open bead with no open blockers and no open dependents.
- Dependency deadlock: strongly-connected component in the open-bead dependency graph (including self-loop).

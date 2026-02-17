# Infrastructure Layer Work Backlog

## Backlog ordering

Priority is sorted by dependency order and delivery risk:

1. Foundations (architecture defaults, IaC structure, environment model)
2. Developer parity (Docker Compose stack, containerisation, local OTel)
3. First cloud environment (cluster, DB, object store, vault, Temporal)
4. Production readiness (WORM evidence, egress hardening, worker isolation)
5. Observability and reliability (OTel backend, SLOs, alerting)
6. CI/CD hardening (OIDC federation, provenance, progressive delivery)
7. Operational maturity (DR drills, FinOps, fault-injection testing)
8. Release and gates

## Epics and stories

### EPIC-I01 — IaC foundations and environment model

Goal: repeatable, auditable infrastructure provisioning across all environments.

- STORY-I01.1 — bead-0298
  - Implement concrete infrastructure execution baseline (Terraform and deploy automation).
  - AC: Terraform modules for core resources; remote state configured.
- STORY-I01.2 — bead-0322
  - Provision and document Terraform remote state + locking for all infra stacks.
  - AC: state locking verified; documentation covers workspace layout.
- STORY-I01.3 — bead-0324
  - Add Terraform state validation matrix in CI (format/init/validate + cost/security lint) across stacks.
  - AC: CI gate blocks invalid plans.
- STORY-I01.4 — bead-0325
  - Build and validate AWS control-plane bootstrap script (EKS/VPC/RDS/S3/KMS) + one-click apply pattern.
  - AC: dev environment provisionable from single command.
- STORY-I01.5 — bead-0330
  - Draft Azure and GCP Terraform baselines to match AWS control-plane contract and evidence immutability assumptions.
  - AC: parity matrix documented; known gaps flagged.
- STORY-I01.6 — bead-0387
  - Environment model and artefact promotion pipeline (dev/staging/prod definitions, config-per-env, artefact-based promotion).
  - AC: same image promoted through environments; no rebuilds; environment-specific config injected at deploy time.

### EPIC-I02 — Developer parity (local infrastructure)

Goal: one-command local development environment that mirrors production dependencies.

- STORY-I02.1 — bead-0385
  - Docker Compose local development stack (DB, Temporal dev, vault dev, object store, OTel Collector).
  - AC: `docker compose up` starts all dependencies; API server connects to local Temporal + DB + object store; OTel traces visible locally.
- STORY-I02.2 — bead-0386
  - OCI container images for API server and worker runtime (Dockerfiles, multi-stage builds, image build CI pipeline).
  - AC: images build in CI; multi-stage Dockerfiles; images runnable locally and in Kubernetes.

### EPIC-I03 — Temporal workflow runtime

Goal: durable workflow orchestration with HA and properly provisioned persistence.

- STORY-I03.1 — bead-0388
  - Temporal workflow runtime deployment (Helm chart, persistence stores, HA configuration, visibility backend).
  - AC: Temporal deployed via Helm; default store and visibility store provisioned; HA mode for staging/prod.
- STORY-I03.2 — bead-0399
  - Workflow durability fault-injection testing (pod kill, DB failover, network partition, verify workflow resume).
  - AC: workflows resume after infrastructure failure; no data loss; test results documented.

### EPIC-I04 — Storage and data management

Goal: multi-tenant storage with migration safety and evidence immutability.

- STORY-I04.1 — bead-0335
  - Wire infrastructure layer adapters: implement PostgreSQL stores, event publisher, and ID generator behind application ports.
  - AC: all application ports have working infrastructure adapters; integration tests pass.
- STORY-I04.2 — bead-0391
  - Database schema migration framework (versioned migrations, expand/contract pattern, rollback safety, tenant-aware migrations).
  - AC: migration tooling runs in CI and deployment; backward-compatible migrations enforced; rollback tested.
- STORY-I04.3 — bead-0392
  - Multi-tenant storage tier automation (schema-per-tenant provisioning, DB-per-tenant lifecycle, backup/restore per tier).
  - AC: tier A/B/C operational automation; tenant provisioning/deprovisioning; per-tier backup/restore tested.
- STORY-I04.4 — bead-0389
  - Evidence payload WORM storage controls (S3 Object Lock or equivalent, retention periods, legal holds, compliance mode).
  - AC: evidence payloads immutable during retention; legal hold blocks deletion; compliance mode tested.

### EPIC-I05 — Networking and security hardening

Goal: controlled egress, tenant isolation, and least-privilege at infrastructure boundary.

- STORY-I05.1 — bead-0327
  - Hardening pass: enforce egress allowlist, namespace isolation, and Vault workload auth in Kubernetes execution plane.
  - AC: NetworkPolicies enforced; egress blocked for non-declared endpoints; Vault tokens issued via K8s SA.
- STORY-I05.2 — bead-0396
  - Kubernetes health probes and PodDisruptionBudgets for all control-plane and worker services.
  - AC: readiness/liveness/startup probes configured; PDBs prevent cascading outages during voluntary disruptions.
- STORY-I05.3 — bead-0045
  - Enforce containment and least-privilege assumptions in machine and adapter execution environments.
  - AC: per-tenant worker isolation validated; runtime policy enforcement in place.

### EPIC-I06 — Observability infrastructure

Goal: end-to-end telemetry correlation from API through workflows to workers.

- STORY-I06.1 — bead-0390
  - OTel Collector deployment and observability backend wiring (Collector Helm chart, OTLP pipelines, metrics/traces/logs backend integration).
  - AC: OTel Collector deployed; OTLP export to metrics/traces/logs backends; cross-signal correlation verified.
- STORY-I06.2 — bead-0393
  - SLO definitions, dashboards, and alerting (API latency/error, workflow completion, worker actions, evidence integrity).
  - AC: SLOs documented; dashboards deployed; alerts fire on breach; runbooks linked.
- STORY-I06.3 — bead-0043
  - OTel context propagation in request, workflow, adapter, and machine call stacks (code-level).
  - AC: W3C Trace Context propagated end-to-end; spans correlated across services.
- STORY-I06.4 — bead-0313
  - Application-level observability: traces/logs/metrics correlation (traceparent, OTel spans, security-safe attributes).
  - AC: each command starts a span; metrics emitted; no secrets logged.

### EPIC-I07 — CI/CD hardening

Goal: secure, reproducible build and deploy pipeline with supply-chain assurances.

- STORY-I07.1 — bead-0395
  - CI OIDC federation for cloud access (GitHub Actions OIDC to cloud providers, no long-lived credentials).
  - AC: all CI cloud access uses OIDC; no static credentials; token issuance restricted by environment/branch.
- STORY-I07.2 — bead-0329
  - CI/CD provenance and image signing for control-plane/execution-plane containers (SBOM + attestation).
  - AC: every release artefact has SBOM (CycloneDX or SPDX) + provenance; images signed via Sigstore/Cosign.
- STORY-I07.3 — bead-0380
  - CI security gates: OpenAPI breaking-change diff checks, dependency vulnerability scanning, secret scanning.
  - AC: breaking API changes fail CI; known vulnerabilities flagged; no secrets in source.
- STORY-I07.4 — bead-0394
  - Progressive delivery pipeline (canary or blue-green deployment, traffic shifting, automated rollback on SLO breach).
  - AC: deployment strategy documented; traffic shifting validated; automated rollback on SLO breach tested.

### EPIC-I08 — Operational maturity

Goal: validated disaster recovery, cost governance, and continuous reliability assurance.

- STORY-I08.1 — bead-0397
  - DR drills and automated recovery validation (DB restore, cluster recreation from IaC, evidence store replication verification).
  - AC: RPO/RTO targets defined; DR drill run and documented; restore times meet targets.
- STORY-I08.2 — bead-0398
  - FinOps tagging and cost governance (resource tagging, environment budgets, right-sizing, autoscaling strategy).
  - AC: all resources tagged by environment/service/tenant; budget alerts configured; autoscaling policies documented.
- STORY-I08.3 — bead-0188
  - Runbook: start-to-finish execution order with owner assignments.
- STORY-I08.4 — bead-0189
  - Runbook: rollback plan for failing cycle (freeze scope, rollback scope, communication template).
- STORY-I08.5 — bead-0190
  - Review: validate rollback plan includes data, evidence, and credential cleanup actions.

### EPIC-I09 — Release gates

Goal: infrastructure layer completion evidence.

- STORY-I09.1 — bead-0164
  - Phase transition gate: Infrastructure complete only when persistence, outbox, migration, observability, and security containment beads are closed.
- STORY-I09.2 — bead-0167
  - Phase transition gate: Security complete only when vulnerability, secret hygiene, tenant isolation, SoD, and sandboxing beads are closed.

## Pre-existing beads (cross-reference)

| Bead | Status | Relevance |
|---|---|---|
| bead-0035 | open | Tamper-evident hash chain + signature hooks on EvidenceEntry |
| bead-0036 | open | Verify hash chain continuity under retention/disposition events |
| bead-0043 | open | OTel context propagation in request/workflow/adapter stacks |
| bead-0045 | open | Containment and least-privilege in execution environments |
| bead-0046 | open | Verify sandbox/egress/isolation in runtime integration tests |
| bead-0116 | open | SecretsVaulting port adapter implementation |
| bead-0164 | open | Phase transition: Infrastructure complete |
| bead-0167 | open | Phase transition: Security complete |
| bead-0181 | open | Coverage thresholds on infrastructure code |
| bead-0188 | open | Runbook: execution order |
| bead-0189 | open | Runbook: rollback plan |
| bead-0190 | open | Review: rollback plan validation |
| bead-0194 | open | Synthetic evidence and retention fixtures |
| bead-0298 | open | Infrastructure execution baseline (Terraform) |
| bead-0313 | open | Application-level observability |
| bead-0322 | open | Terraform remote state + locking |
| bead-0324 | open | Terraform validation matrix in CI |
| bead-0325 | open | AWS control-plane bootstrap script |
| bead-0327 | open | Egress allowlist + namespace isolation + Vault auth |
| bead-0329 | open | CI/CD provenance and image signing (SBOM + attestation) |
| bead-0330 | open | Azure/GCP Terraform baselines |
| bead-0335 | open | Wire infrastructure adapters (PostgreSQL, event publisher, ID gen) |
| bead-0380 | open | CI security gates (OpenAPI diff, vuln scan, secret scan) |

## New beads created for this backlog

| Bead | Title |
|---|---|
| bead-0385 | Infra: Docker Compose local development stack (DB, Temporal dev, vault dev, object store, OTel Collector) |
| bead-0386 | Infra: OCI container images for API server and worker runtime (Dockerfiles, multi-stage builds, image build CI pipeline) |
| bead-0387 | Infra: environment model and artefact promotion pipeline (dev/staging/prod definitions, config-per-env, artefact-based promotion) |
| bead-0388 | Infra: Temporal workflow runtime deployment (Helm chart, persistence stores, HA configuration, visibility backend) |
| bead-0389 | Infra: evidence payload WORM storage controls (S3 Object Lock or equivalent, retention periods, legal holds, compliance mode) |
| bead-0390 | Infra: OTel Collector deployment and observability backend wiring (Collector Helm chart, OTLP pipelines, metrics/traces/logs backend integration) |
| bead-0391 | Infra: database schema migration framework (versioned migrations, expand/contract pattern, rollback safety, tenant-aware migrations) |
| bead-0392 | Infra: multi-tenant storage tier automation (schema-per-tenant provisioning, DB-per-tenant lifecycle, backup/restore per tier) |
| bead-0393 | Infra: SLO definitions, dashboards, and alerting (API latency/error, workflow completion, worker actions, evidence integrity) |
| bead-0394 | Infra: progressive delivery pipeline (canary or blue-green deployment, traffic shifting, automated rollback on SLO breach) |
| bead-0395 | Infra: CI OIDC federation for cloud access (GitHub Actions OIDC to cloud providers, no long-lived credentials) |
| bead-0396 | Infra: Kubernetes health probes and PodDisruptionBudgets for all control-plane and worker services |
| bead-0397 | Infra: DR drills and automated recovery validation (DB restore, cluster recreation from IaC, evidence store replication verification) |
| bead-0398 | Infra: FinOps tagging and cost governance (resource tagging, environment budgets, right-sizing, autoscaling strategy) |
| bead-0399 | Infra: workflow durability fault-injection testing (pod kill, DB failover, network partition, verify workflow resume) |

## Delivery notes

- No production deployment artefacts exist yet (no Dockerfiles, no Compose, no IaC, no environment definitions).
- Priority order: local dev parity (Compose + containers) -> first cloud env (IaC + Temporal + DB) -> evidence WORM -> hardening -> observability -> CI/CD supply chain -> operational maturity.
- Evidence immutability is currently "tamper-evident in code" only; anchoring to WORM storage (bead-0389) is required for real compliance posture.
- Temporal is a first-class infrastructure dependency, not a library; treat its deployment (bead-0388) and fault-injection (bead-0399) as critical path.
- Multi-tenant tier automation (bead-0392) depends on the migration framework (bead-0391) and the infrastructure adapters (bead-0335).
- CI OIDC federation (bead-0395) should be established before any cloud deployment pipeline to avoid long-lived credentials from day one.

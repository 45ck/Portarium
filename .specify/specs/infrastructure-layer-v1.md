# Infrastructure Layer v1 (Environment, Runtime, Deployment)

## Purpose

Define the minimum infrastructure capabilities Portarium must provide to satisfy
ADR-0056 and existing domain invariants:

- evidence integrity,
- untrusted execution containment,
- tenant isolation tiers,
- durable workflow execution,
- OpenTelemetry and CloudEvents observability.

## Scope

- This specification covers local, dev, staging, and prod environments.
- It includes dependency topology, deployment primitives, and operational constraints.
- It does not define implementation code for adapters or machines.

## Core Definitions (Ubiquitous Language)

- **Control Plane**: API server, workflow coordination, policy evaluation, approval
  surfaces, evidence metadata capture.
- **Execution Plane**: adapters and machines that perform externally-effectful
  **Action**s.
- **Evidence Artifact**: immutable files stored separately from the
  **Evidence Log** metadata.
- **Workspace**: tenant isolation boundary and tenancy policy holder.

## Requirements

### 1) Local parity

- A one-command local stack must include:
  - PostgreSQL for runtime state,
  - Temporal for durable workflow execution,
  - credential vault,
  - evidence artifact store,
  - OpenTelemetry collector.
- `docker compose up` from repo root must start that baseline.
- App services can be added via override file, but baseline dependencies must remain.

### 2) Environment model

- Environments required: `local`, `dev`, `staging`, `prod`.
- Promotion path must use immutable artefacts (same container image tag across envs).
- `staging` must mirror `prod` topology to support reliability and DR rehearsal.

### 3) Infrastructure primitives

- **Durability**
  - Temporal persistence must be stateful and protected by backups.
- **Tenant isolation**
  - Tier A/B/C policy from ADR-0049 must be enforceable in data layout and
    access patterns.
- **Evidence immutability**
  - Evidence Artifacts must be written to an immutable or retention-governed store.
  - In production, the evidence object store must support WORM-style controls:
    - Object Lock (or equivalent) with **COMPLIANCE** mode for regulated retention classes.
    - Retention windows (retain-until timestamps) enforced by the storage backend.
    - Legal holds that block deletion regardless of retention expiry.
  - Hash chain and metadata integrity checks remain authoritative.
- **Execution containment**
  - Workers execute outside direct control-plane privileges.
  - Egress must be deny-by-default and allowlist-driven in future production tiers.

### 4) Observability contract

- OpenTelemetry must be available at control-plane ingress, workflow execution,
  and execution-plane boundaries.
- Event surfaces should use CloudEvents envelopes consistently for correlation.
- Kubernetes baseline manifests must include an OpenTelemetry Collector deployment
  plus trace, log, and metrics backends wired for local `dev|staging|prod` overlay
  validation.
- Critical SLOs to expose:
  - API latency and error rates,
  - workflow completion rate and retry/replay health,
  - Action execution success/failure by Workspace,
  - evidence ingestion and verification failures.

### 5) Delivery and security controls

- CI must include at least:
  - compose manifest validation,
  - image policy and secret hygiene checks when artifacts are added,
  - infrastructure baseline gates (format/lint/validation).
  - Kubernetes overlay validation for `dev|staging|prod`.
  - schema migration validation and dry-run execution for the expand phase.

### 6) Database schema migration contract

- Runtime schema changes must use versioned migrations.
- Migrations must declare an explicit phase:
  - **Expand** for backward-compatible additive changes.
  - **Contract** for removal or incompatible cleanup.
- Contract migrations must not run by default in CI/deploy automation.
- Contract migrations require explicit opt-in and rollback SQL.
- Tenant-aware migrations must execute per tenant target, with migration journal
  tracking per target.
- Deploy automation must run migration tooling before workload rollout.

### 7) Application port persistence adapters

- Store/query ports are implemented in infrastructure adapters backed by PostgreSQL.
- Adapter wiring must preserve application-layer boundaries:
  - application code imports only port interfaces,
  - PostgreSQL-specific code lives under `src/infrastructure/`.
- Evidence log append operations must preserve hash-chain continuity when persisted.
- Event publication infrastructure includes an outbox-backed publisher adapter.
- ID generation infrastructure provides collision-resistant IDs suitable for distributed writes.

- Container images for the Control Plane and Execution Plane are built by
  `.github/workflows/ci-images.yml` and promoted through environment overlays.
- CI/CD must avoid long-lived cloud credentials; OIDC federation is preferred.

## Acceptance Criteria

- `docker-compose.yml` exists and documents local dependencies.
- Infrastructure ADR and this specification are linked from `README.md`.
- A baseline evidence and control-plane topology is reproducible from this repo.
- AWS Terraform modules are now implemented under `infra/terraform/aws` with local
  validation and environment examples. Azure/GCP provider directories are tracked
  as planned follow-up milestones.
- Migration tooling is executable via repository scripts and runs in CI and CD
  workflows.

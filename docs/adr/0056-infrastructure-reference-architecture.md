# ADR-0056: Infrastructure Layer Baseline and Reference Architecture

## Status

Accepted

## Context

Portarium is intended to be deployable as a production control plane with durable workflows, tenant isolation, and tamper-evident Evidence.

Quality gates are mature for code and domain behaviour, but operational infrastructure still needs explicit treatment as first-class source artifacts.

- multi-environment provisioning is tracked but not yet complete,
- the initial compose/runtime baseline in this repository is now explicit and usable,
- CI/CD for images, deployment overlays, and infra validation is now present in the repo baseline,
- evidence payload immutability is modelled in domain/contracts, with storage-control enforcement now represented as an infrastructure contract and rollout task.

The architecture is therefore incomplete until infrastructure is implemented as a separate, versioned layer with the same standards used for ADRs and specs.

## Decision

Adopt a reference baseline that is intentionally cloud-neutral while still concrete enough to deploy on any major provider.

1. **Infrastructure shape**

- Separate **Control Plane** and **Execution Plane** for isolation:
  - Control Plane: API, workflow coordination, evidence metadata, credential orchestration.
  - Execution Plane: adapter wrappers and machine execution surfaces with strict network and workload policy.
- Use a control/data split:
  - PostgreSQL for runtime data with explicit tiered tenancy controls (ADR-0049),
  - Object store for Evidence Artifacts (payloads) with immutable/retention controls (ADR-0029),
  - Vault-backed credential vaulting (ADR-010/ADR-049 intent).
- Standardise telemetry at boundaries: OpenTelemetry on API + workflows + execution, with CloudEvents in event outputs.

2. **Deployment and environment model**

- Environments: `local`, `dev`, `staging`, `prod`.
- Local:
  - Docker Compose includes stateful dependencies required for local parity.
  - App services can be attached through override files and container images once Docker artifacts exist.
- `dev`/`staging`/`prod`:
  - Kubernetes cluster-based platform.
- Promote the same image artifacts through all environments.

3. **IaC and automation**

- Use Terraform as default for network, cluster, storage, and policy primitives.
- Keep provider-neutral references in this repository; provider modules are added as explicit submodules per provider.
- Add infrastructure validation gates in CI before app changes can merge:
  - Docker Compose manifest validation,
  - Terraform format/validation where manifests exist,
  - image policy checks and secret-safety gates.

4. **Security and containment**

- Workers execute as untrusted:
  - network egress allowlisting at runtime boundary,
  - least-privilege service accounts,
  - no shared credentials with control plane.
- Evidence payload retention + legal holds must be representable through object-store controls and periodic verification jobs.

## Consequences

- Infrastructure can be reviewed and evolved via the same review/release process as product code.
- Tenant isolation tiers become operationally feasible and testable in non-production environments.
- Untrusted execution can be hardened independently of application code.
- Deployment reliability improves by making build/provenance/deploy flow an architecture dependency.
- A minimum viable reference implementation is now explicit, even if not yet complete in every environment.

## Alternatives Considered

- **No local compose baseline**
  - Rejected: weak developer onboarding and no reproducible control-plane dependency parity.
- **Single-node non-Kubernetes production topology**
  - Rejected for v1 due lack of policy enforcement primitives needed for egress control, RBAC boundaries, and horizontal worker isolation.
- **Cloud-specific IaC only**
  - Rejected to preserve migration paths and avoid early lock-in in the repository's design stage.

# Infrastructure Layer Reference Implementation Notes

This folder stores the infrastructure baseline for Portarium and follows ADR-0056.

## Current Baseline (implemented in this repo)

- `docker-compose.yml` at repository root defines local shared dependencies for:
  - PostgreSQL runtime database (`evidence-db`),
  - Temporal runtime (`temporal`),
  - MinIO evidence object store (`evidence-store`),
  - Vault dev instance (`vault`),
  - OpenTelemetry collector (`otel-collector`).
- `docker-compose.local.yml` adds placeholder Control Plane and Execution Plane services built from
  `infra/docker/*` for infrastructure parity during local development.
- `.specify/specs/infrastructure-layer-v1.md` defines the infra contract for v1.
- `docs/adr/0056-infrastructure-reference-architecture.md` stores the architectural decision.
- `infra/kubernetes` provides a reference base and `dev|staging|prod` overlays.
- `infra/terraform` contains provider entry points with a concrete AWS baseline.

## Execution model

- The Control Plane remains the canonical boundary for workflow scheduling, approval,
  and evidence metadata.
- Workers are deployed in a separate runtime boundary in later milestones
  (untrusted execution containment).
- Current container artifacts are platform-neutral runnable scaffolds that expose
  health probes for k8s and compose parity validation.

## Reference structure

- `infra/` currently stores infrastructure documentation and
  observability runtime config, plus Terraform and Kubernetes module catalogs.
- `infra/docker/` stores container image scaffolds for Control Plane / Execution Plane.
- `infra/kubernetes/` stores reference Kubernetes manifests using Kustomize.
- `infra/terraform/` tracks provider-specific IaC entry points (`aws` implemented,
  `azure`/`gcp` planned).

## Workstreams and owners

- Specification and design: ADR-0056 and
  `.specify/specs/infrastructure-layer-v1.md`.
- Local dependency parity: maintain `docker-compose.yml`.
- Security posture: harden worker isolation, secret delivery, and egress controls.

## Current CI/CD references

- `.github/workflows/ci-infra.yml` validates compose, Terraform formatting,
  and Kubernetes overlay builds.
- `.github/workflows/ci-images.yml` builds Control Plane and Execution Plane images.
- `.github/workflows/cd-k8s-deploy.yml` is a gated manual deployment workflow
  for environment overlays.

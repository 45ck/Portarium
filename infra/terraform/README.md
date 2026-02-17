# Infrastructure as Code Baseline (Phase 1)

Terraform is the baseline Infrastructure as Code strategy.

## Scope

- Keep this folder provider-neutral and publish policy-first modules.
- Define network, cluster, database, object store, and secret integration in
  separate provider-specific module sets.
- Enforce immutable records of infrastructure intent in version control.

## Current status

This section is a scaffold:

- No provider-specific resources are committed yet.
- ADR-0056 and `.specify/specs/infrastructure-layer-v1.md` define required
  modules and acceptance criteria before implementation.
- The first implementation can use `main` entry points per provider (for example,
  AWS, Azure, GCP) without changing application code.

## Planned module set

- `core-network`: VPC/VNet + subnet segmentation + service endpoints.
- `control-plane-cluster`: Kubernetes cluster + API server IAM/policy.
- `control-plane-services`: Postgres, Vault integration, object store interface.
- `temporal-stack`: Durable workflow platform persistence and worker ingress points.
- `observability-stack`: OTel collector plus metrics/trace/log backends.
- `policy-engine`: Cloud-native policy controls (egress allowlists, network policies).

## Validation

- `terraform fmt -recursive` in CI for all checked-in Terraform files.
- `terraform validate` in provider-specific modules.
- Review gates requiring explicit owner signoff before environment rollout.


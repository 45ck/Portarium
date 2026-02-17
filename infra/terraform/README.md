# Infrastructure as Code Baseline (Phase 1)

Terraform is the baseline Infrastructure as Code strategy for ADR-0056.

## Scope

- Keep this folder provider-neutral at the repository level while shipping explicit
  provider entry points for portability.
- Define network, cluster, database, object store, and secret integration in
  provider-specific implementations.
- Track all intent (environment defaults, state names, and rollout assumptions) in
  version control through Terraform code and examples.

## Current status

- Provider baseline status:
  - ✅ `aws/` has a concrete reference implementation for network, control plane,
    data persistence, and evidence storage.
  - ⏳ `azure/` and `gcp/` are planned as parity implementations.
- ADR-0056 and `.specify/specs/infrastructure-layer-v1.md` define required
  capabilities and acceptance criteria.
- The provider entry points are intentionally aligned to the same operational
  contract (control-plane cluster + runtime storage + evidence store + policy
  controls).

## Planned module set

- `core-network`: VPC/VNet + subnet segmentation + service endpoints.
- `control-plane-cluster`: Kubernetes cluster + API server IAM/policy.
- `control-plane-services`: Postgres, Vault integration, object store interface.
- `temporal-stack`: Durable workflow platform persistence and worker ingress points.
- `observability-stack`: OTel collector plus metrics/trace/log backends.
- `policy-engine`: Cloud-native policy controls (egress allowlists, network policies).

## Validation

- `terraform fmt -recursive` in CI for all checked-in Terraform files.
- `terraform init -backend=false` and `terraform validate` in provider-specific
  stacks.
- Review gates requiring explicit owner signoff before environment rollout.

## AWS usage example

```bash
cd infra/terraform/aws
terraform init
terraform validate
terraform plan -var-file=examples/dev.tfvars
```

For production-like use, use `staging.tfvars`/`prod.tfvars` and a remote state
backend (`S3` + DynamoDB lock table, or managed equivalent) before applying.

## Acceptance check for this layer

- `terraform init` / `terraform validate` are green for all checked-in provider stacks.
- Outputs are stable and include control-plane endpoint, DB endpoint, and evidence store identifiers.
- Secrets/credentials are injected through run-time secret managers, not committed state.

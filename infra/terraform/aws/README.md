# AWS baseline Terraform reference

This folder is the first concrete provider implementation for ADR-0056. It is a
reference stack intended for development, staging, and production planning with
separate `environment` values.

## What this stack provisions

- Network topology:
  - VPC with public/private subnets
  - Internet gateway and optional NAT path for private subnets
  - Route tables for baseline reachability
- Control plane:
  - EKS cluster (control plane + execution-plane worker node group)
  - IAM roles for cluster and nodes
- Runtime persistence:
  - PostgreSQL instance for runtime state
  - VPC-scoped security group controls
- Evidence storage:
  - S3 bucket with versioning
  - optional Object Lock (`GOVERNANCE`/`COMPLIANCE`) and key rotation
  - KMS encryption on bucket and database

## Notes

- The DB password defaults to a generated value when `postgres_password` is not set.
- The stack is opinionated for portability and does not aim to replace managed
  secrets/Vault integrations yet.
- The resource map can be replaced over time with provider alternatives while
  keeping the same variable interface.

## One-click apply (recommended)

Use `scripts/infra/bootstrap-aws.sh` for a fully automated bootstrap:

```bash
# Dry-run (plan only, no changes)
./scripts/infra/bootstrap-aws.sh dev --dry-run

# Apply dev environment
./scripts/infra/bootstrap-aws.sh dev

# Apply staging environment
./scripts/infra/bootstrap-aws.sh staging

# Apply prod environment (interactive confirmation required)
./scripts/infra/bootstrap-aws.sh prod
```

The script:
1. Validates prerequisites (terraform ≥ 1.8, aws CLI, valid IAM identity)
2. Provisions the S3 + DynamoDB remote state backend (idempotent — skipped if already exists)
3. Writes `backend.tf` with the correct bucket/table names and runs `terraform init -migrate-state`
4. Applies the main stack with the environment-specific tfvars

To skip the backend provisioning step (e.g., re-running after a partial apply):

```bash
./scripts/infra/bootstrap-aws.sh staging --skip-backend
```

## Manual usage

```bash
cd infra/terraform/aws
terraform init
terraform fmt -recursive
terraform validate
terraform plan -var-file=./examples/dev.tfvars
```

`examples/*.tfvars` are intentionally untracked templates; keep secrets out of VCS.

## Environment comparison

| Setting | dev | staging | prod |
|---------|-----|---------|------|
| EKS nodes (desired/max) | 2/3 | 3/5 | 4/8 |
| Node instance type | t3.medium | t3.medium | t3.large |
| RDS instance class | db.t4g.medium | db.t4g.large | db.t4g.large |
| RDS Multi-AZ | false | true | true |
| Postgres backup retention | 7d | 14d | 30d |
| Evidence object lock | disabled | enabled (365d) | enabled (1095d) |
| Deletion protection | false | false | true |

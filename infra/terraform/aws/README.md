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

## Local usage

```bash
cd infra/terraform/aws
terraform init
terraform fmt -recursive
terraform validate
terraform plan -var-file=./examples/dev.tfvars
```

`examples/*.tfvars` are intentionally untracked templates; keep secrets out of VCS.

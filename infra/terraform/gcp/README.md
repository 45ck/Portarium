# GCP Terraform baseline

Parity implementation with `infra/terraform/aws/` for the Google Cloud provider.

## What this stack provisions

- **Network:** VPC + platform subnet + secondary ranges for GKE pods/services
- **Control plane:** GKE cluster (autoscaling node pool, Workload Identity enabled)
- **Runtime persistence:** Cloud SQL PostgreSQL (private IP, automated backups)
- **Evidence store:** GCS bucket (versioning, KMS encryption, optional retention policy)
- **Encryption:** Cloud KMS key ring + crypto key with 90-day rotation

## Usage

```bash
cd infra/terraform/gcp

# First-time: provision remote state backend
cd ../gcp-backend-bootstrap
terraform init && terraform apply -var="gcp_project_id=your-project"
# Then activate backend.tf (see infra/terraform/README.md)

# Apply
terraform init
terraform plan  -var-file=examples/dev.tfvars -var="gcp_project_id=your-project"
terraform apply -var-file=examples/dev.tfvars -var="gcp_project_id=your-project"
```

`gcp_project_id` is required and must be passed explicitly.

## Authentication

Uses Application Default Credentials (ADC). For CI, bind a Workload Identity
service account with the following roles:
- `roles/container.admin` (GKE)
- `roles/cloudsql.admin` (Cloud SQL)
- `roles/storage.admin` (GCS)
- `roles/cloudkms.admin` (KMS)
- `roles/compute.networkAdmin` (VPC)

## Environment comparison

| Setting | dev | staging | prod |
|---------|-----|---------|------|
| GKE nodes (per zone / max) | 1/3 | 2/5 | 3/8 |
| Machine type | n2-standard-2 | n2-standard-4 | n2-standard-8 |
| Cloud SQL tier | db-g1-small | db-custom-4-15360 | db-custom-8-30720 |
| Cloud SQL HA | false | true | true |
| Evidence retention | disabled | 365d | 3 years |

# Azure Terraform baseline

Parity implementation with `infra/terraform/aws/` for the Azure cloud provider.

## What this stack provisions

- **Network:** VNet + public/private subnets + service endpoints
- **Control plane:** AKS cluster (autoscaling node pool, Azure CNI + NetworkPolicy)
- **Runtime persistence:** Azure Database for PostgreSQL Flexible Server (private DNS zone)
- **Evidence store:** Azure Blob Storage (ZRS, versioning, optional lifecycle immutability)
- **Encryption:** Azure Key Vault + RSA-4096 platform key

## Usage

```bash
cd infra/terraform/azure

# First-time: provision remote state backend
cd ../azure-backend-bootstrap
terraform init && terraform apply -var="environment=dev"
# Then activate backend.tf (see infra/terraform/README.md)

# Apply
terraform init
terraform plan  -var-file=examples/dev.tfvars -var="postgres_admin_password=SECRET"
terraform apply -var-file=examples/dev.tfvars -var="postgres_admin_password=SECRET"
```

Pass `postgres_admin_password` via the `TF_VAR_postgres_admin_password` environment
variable or a CI secret — never commit passwords to VCS.

## Environment comparison

| Setting | dev | staging | prod |
|---------|-----|---------|------|
| AKS nodes (desired/max) | 2/3 | 3/5 | 4/8 |
| VM size | Standard_D2s_v3 | Standard_D4s_v3 | Standard_D8s_v3 |
| PostgreSQL SKU | GP_Standard_D2s_v3 | GP_Standard_D4s_v3 | GP_Standard_D8s_v3 |
| PostgreSQL HA | false | true | true |
| Backup retention | 7d | 14d | 30d |
| Evidence immutability | disabled | enabled (365d) | enabled (1095d) |

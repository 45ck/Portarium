# ---------------------------------------------------------------------------
# Terraform remote state — Azure Blob Storage (native locking via blob lease)
#
# BEFORE USE:
#   1. Run infra/terraform/azure-backend-bootstrap/ once with local state to
#      provision the Storage Account and container.
#   2. Copy the `backend_config_snippet` output, paste it here, and uncomment.
#   3. Run `terraform init -migrate-state` to move local state into Azure.
#
# AUTHENTICATION:
#   The backend uses OIDC (use_oidc = true) for keyless auth in CI.
#   Locally, `az login` or ARM_* env vars are supported.
# ---------------------------------------------------------------------------

# Uncomment and fill in values produced by azure-backend-bootstrap:
#
# terraform {
#   backend "azurerm" {
#     resource_group_name  = "<namespace>-<environment>-tfstate-rg"
#     storage_account_name = "<namespace><environment>tfstate<suffix>"
#     container_name       = "tfstate"
#     key                  = "portarium/azure/platform/terraform.tfstate"
#     use_oidc             = true
#   }
# }

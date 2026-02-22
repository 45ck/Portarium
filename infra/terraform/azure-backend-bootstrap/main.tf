locals {
  prefix = "${var.namespace}-${var.environment}"
  # Storage account names: 3-24 chars, lowercase alphanumeric only
  storage_account_name = replace("${var.namespace}${var.environment}tfstate", "-", "")
}

resource "random_id" "suffix" {
  byte_length = 3
}

# ---------------------------------------------------------------------------
# Resource group — container for all state bootstrap resources
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "tfstate" {
  name     = "${local.prefix}-tfstate-rg"
  location = var.location

  tags = merge(var.tags, {
    ManagedBy = "terraform-backend-bootstrap"
  })
}

# ---------------------------------------------------------------------------
# Storage account — Terraform remote state storage
# ---------------------------------------------------------------------------

resource "azurerm_storage_account" "tfstate" {
  name                     = "${local.storage_account_name}${random_id.suffix.hex}"
  resource_group_name      = azurerm_resource_group.tfstate.name
  location                 = azurerm_resource_group.tfstate.location
  account_tier             = "Standard"
  account_replication_type = "ZRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }

  tags = merge(var.tags, {
    ManagedBy = "terraform-backend-bootstrap"
  })
}

# ---------------------------------------------------------------------------
# Blob container — holds the .tfstate file
# ---------------------------------------------------------------------------

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_name  = azurerm_storage_account.tfstate.name
  container_access_type = "private"
}

locals {
  prefix = "${var.namespace}-${var.environment}"
  common_tags = merge(var.tags, {
    Namespace   = var.namespace
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# ---------------------------------------------------------------------------
# Resource group
# ---------------------------------------------------------------------------

resource "azurerm_resource_group" "platform" {
  name     = "${local.prefix}-rg"
  location = var.location
  tags     = local.common_tags
}

# ---------------------------------------------------------------------------
# Key Vault — platform encryption keys
# ---------------------------------------------------------------------------

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "platform" {
  name                        = "${local.prefix}-kv"
  location                    = azurerm_resource_group.platform.location
  resource_group_name         = azurerm_resource_group.platform.name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  soft_delete_retention_days  = 7
  purge_protection_enabled    = true

  tags = local.common_tags
}

resource "azurerm_key_vault_key" "platform" {
  name         = "${local.prefix}-platform-key"
  key_vault_id = azurerm_key_vault.platform.id
  key_type     = "RSA"
  key_size     = 4096

  key_opts = ["decrypt", "encrypt", "sign", "unwrapKey", "verify", "wrapKey"]
}

# ---------------------------------------------------------------------------
# Network — VNet, subnets
# ---------------------------------------------------------------------------

resource "azurerm_virtual_network" "main" {
  name                = "${local.prefix}-vnet"
  address_space       = [var.vnet_cidr]
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  tags                = local.common_tags
}

resource "azurerm_subnet" "public" {
  name                 = "${local.prefix}-public-sn"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.public_subnet_cidr]
}

resource "azurerm_subnet" "private" {
  name                 = "${local.prefix}-private-sn"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.private_subnet_cidr]

  service_endpoints = ["Microsoft.Storage", "Microsoft.Sql"]
}

# ---------------------------------------------------------------------------
# AKS — control-plane cluster + execution-plane node pool
# ---------------------------------------------------------------------------

resource "azurerm_kubernetes_cluster" "platform" {
  name                = "${local.prefix}-aks"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  dns_prefix          = "${local.prefix}-aks"
  kubernetes_version  = var.aks_kubernetes_version

  default_node_pool {
    name                = "system"
    vm_size             = var.aks_node_vm_size
    node_count          = var.aks_node_count
    min_count           = var.aks_node_min_count
    max_count           = var.aks_node_max_count
    enable_auto_scaling = true
    vnet_subnet_id      = azurerm_subnet.private.id
    os_disk_size_gb     = 128
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
    network_policy = "azure"
    service_cidr   = "10.32.0.0/16"
    dns_service_ip = "10.32.0.10"
  }

  tags = local.common_tags
}

# ---------------------------------------------------------------------------
# PostgreSQL Flexible Server — runtime persistence
# ---------------------------------------------------------------------------

resource "azurerm_private_dns_zone" "postgres" {
  name                = "${local.prefix}.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.platform.name
  tags                = local.common_tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "${local.prefix}-postgres-dns-link"
  resource_group_name   = azurerm_resource_group.platform.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.main.id
}

resource "azurerm_postgresql_flexible_server" "runtime" {
  name                   = "${local.prefix}-postgres"
  location               = azurerm_resource_group.platform.location
  resource_group_name    = azurerm_resource_group.platform.name
  version                = var.postgres_version
  administrator_login    = var.postgres_admin_username
  administrator_password = var.postgres_admin_password
  sku_name               = var.postgres_sku
  storage_mb             = var.postgres_storage_mb
  backup_retention_days  = var.postgres_backup_retention_days
  delegated_subnet_id    = azurerm_subnet.private.id
  private_dns_zone_id    = azurerm_private_dns_zone.postgres.id

  high_availability {
    mode = var.postgres_high_availability ? "ZoneRedundant" : "Disabled"
  }

  tags = local.common_tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]
}

resource "azurerm_postgresql_flexible_server_database" "portarium" {
  name      = "portarium"
  server_id = azurerm_postgresql_flexible_server.runtime.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# ---------------------------------------------------------------------------
# Storage Account + evidence container — evidence immutability
# ---------------------------------------------------------------------------

resource "random_id" "storage_suffix" {
  byte_length = 3
}

resource "azurerm_storage_account" "evidence" {
  name                     = "${replace(local.prefix, "-", "")}ev${random_id.storage_suffix.hex}"
  resource_group_name      = azurerm_resource_group.platform.name
  location                 = azurerm_resource_group.platform.location
  account_tier             = "Standard"
  account_replication_type = "ZRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }
  }

  tags = local.common_tags
}

resource "azurerm_storage_container" "evidence" {
  name                  = var.evidence_bucket_name
  storage_account_name  = azurerm_storage_account.evidence.name
  container_access_type = "private"
}

resource "azurerm_storage_management_policy" "evidence" {
  count              = var.enable_evidence_immutability ? 1 : 0
  storage_account_id = azurerm_storage_account.evidence.id

  rule {
    name    = "evidence-immutability"
    enabled = true

    filters {
      prefix_match = ["${var.evidence_bucket_name}/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = var.evidence_immutability_days
      }
    }
  }
}

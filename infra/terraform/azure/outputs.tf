output "resource_group_name" {
  description = "Platform resource group name."
  value       = azurerm_resource_group.platform.name
}

output "vnet_id" {
  description = "Platform VNet ID."
  value       = azurerm_virtual_network.main.id
}

output "aks_cluster_name" {
  description = "AKS cluster name."
  value       = azurerm_kubernetes_cluster.platform.name
}

output "aks_kube_config" {
  description = "AKS raw kubeconfig (sensitive)."
  value       = azurerm_kubernetes_cluster.platform.kube_config_raw
  sensitive   = true
}

output "postgres_fqdn" {
  description = "PostgreSQL Flexible Server FQDN."
  value       = azurerm_postgresql_flexible_server.runtime.fqdn
}

output "postgres_db_name" {
  description = "Portarium database name."
  value       = azurerm_postgresql_flexible_server_database.portarium.name
}

output "evidence_storage_account" {
  description = "Evidence storage account name."
  value       = azurerm_storage_account.evidence.name
}

output "evidence_container" {
  description = "Evidence blob container name."
  value       = azurerm_storage_container.evidence.name
}

output "key_vault_id" {
  description = "Platform Key Vault ID."
  value       = azurerm_key_vault.platform.id
}

output "location" {
  description = "Azure region."
  value       = var.location
}

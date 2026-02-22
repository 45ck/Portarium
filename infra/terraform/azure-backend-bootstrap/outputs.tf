output "resource_group_name" {
  description = "Resource group containing state storage resources."
  value       = azurerm_resource_group.tfstate.name
}

output "storage_account_name" {
  description = "Storage account name for Terraform remote state."
  value       = azurerm_storage_account.tfstate.name
}

output "container_name" {
  description = "Blob container name for Terraform state."
  value       = azurerm_storage_container.tfstate.name
}

output "backend_config_snippet" {
  description = "Copy-paste-ready backend block for infra/terraform/azure/backend.tf."
  value       = <<-EOT
    terraform {
      backend "azurerm" {
        resource_group_name  = "${azurerm_resource_group.tfstate.name}"
        storage_account_name = "${azurerm_storage_account.tfstate.name}"
        container_name       = "${azurerm_storage_container.tfstate.name}"
        key                  = "portarium/azure/terraform.tfstate"
        use_oidc             = true
      }
    }
  EOT
}

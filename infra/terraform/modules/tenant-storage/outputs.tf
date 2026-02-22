# Outputs for the tenant-storage module.
# Bead: bead-0392

output "tier" {
  description = "Resolved storage tier for this tenant."
  value       = var.tier
}

output "db_host" {
  description = "RDS endpoint hostname (dedicated tier) or shared DB host (shared tier)."
  value       = local.is_dedicated ? aws_db_instance.tenant[0].address : var.shared_db_host
}

output "db_port" {
  description = "PostgreSQL port."
  value       = 5432
}

output "db_name" {
  description = "Database name (dedicated) or schema name (shared)."
  value = local.is_dedicated ? replace(var.tenant_id, "-", "_") : "portarium"
}

output "schema_name" {
  description = "Per-tenant schema name (shared tier only; empty for dedicated)."
  value       = local.is_dedicated ? "" : "tenant_${replace(var.tenant_id, "-", "_")}"
}

output "vault_secret_path" {
  description = "Vault KV path where DB credentials are stored."
  value       = "tenants/${var.tenant_id}/db"
}

output "db_arn" {
  description = "RDS instance ARN (dedicated tier only)."
  value       = local.is_dedicated ? aws_db_instance.tenant[0].arn : ""
}

output "backup_vault_name" {
  description = "AWS Backup vault name (dedicated tier only)."
  value       = local.is_dedicated ? aws_backup_vault.tenant[0].name : ""
}

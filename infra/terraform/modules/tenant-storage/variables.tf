# Variables for the tenant-storage module.
# Bead: bead-0392

variable "tenant_id" {
  description = "Unique tenant identifier (kebab-case, e.g. 'acme-corp'). Used as a name prefix."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.tenant_id))
    error_message = "tenant_id must be lowercase alphanumeric with hyphens, 3–63 chars."
  }
}

variable "tier" {
  description = "Storage isolation tier: 'shared' (schema-per-tenant) or 'dedicated' (DB-per-tenant)."
  type        = string

  validation {
    condition     = contains(["shared", "dedicated"], var.tier)
    error_message = "tier must be 'shared' or 'dedicated'."
  }
}

variable "environment" {
  description = "Deployment environment (dev / staging / prod)."
  type        = string
}

variable "namespace" {
  description = "Resource name prefix (e.g. 'portarium')."
  type        = string
  default     = "portarium"
}

variable "vpc_id" {
  description = "VPC ID for the security group (dedicated tier only)."
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "Private subnet IDs for the RDS subnet group (dedicated tier only)."
  type        = list(string)
  default     = []
}

variable "node_sg_id" {
  description = "EKS node security group ID allowed to reach the tenant DB (dedicated tier only)."
  type        = string
  default     = ""
}

variable "kms_key_arn" {
  description = "KMS key ARN for RDS and Backup encryption."
  type        = string
}

variable "shared_db_host" {
  description = "Hostname of the shared PostgreSQL instance (shared tier only)."
  type        = string
  default     = ""
}

variable "vault_kv_mount" {
  description = "Vault KV v2 mount path where tenant secrets are stored."
  type        = string
  default     = "secret"
}

variable "postgres_engine_version" {
  description = "PostgreSQL engine version for the dedicated RDS instance."
  type        = string
  default     = "16.3"
}

variable "postgres_instance_class" {
  description = "RDS instance class for dedicated tenant DB."
  type        = string
  default     = "db.t4g.medium"
}

variable "postgres_allocated_storage" {
  description = "Initial allocated storage in GiB."
  type        = number
  default     = 20
}

variable "postgres_max_allocated_storage" {
  description = "Maximum autoscaled storage in GiB (0 = disabled)."
  type        = number
  default     = 200
}

variable "multi_az" {
  description = "Enable Multi-AZ for the dedicated RDS instance."
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 14

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "backup_retention_days must be between 1 and 35."
  }
}

variable "deletion_protection" {
  description = "Enable RDS deletion protection and final snapshot on destroy."
  type        = bool
  default     = true
}

variable "backup_role_arn" {
  description = "IAM role ARN for AWS Backup to use when backing up RDS (dedicated tier only)."
  type        = string
  default     = ""
}

variable "backup_cross_region_vault_arn" {
  description = "Optional: ARN of an AWS Backup vault in a secondary region for cross-region copies."
  type        = string
  default     = ""
}

variable "extra_tags" {
  description = "Additional resource tags to merge."
  type        = map(string)
  default     = {}
}

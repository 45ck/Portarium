variable "location" {
  type        = string
  description = "Azure region for all platform resources."
  default     = "eastus"
}

variable "namespace" {
  type        = string
  description = "Project namespace used in resource naming."
  default     = "portarium"
}

variable "environment" {
  type        = string
  description = "Deployment environment name (dev, staging, prod)."
  default     = "dev"
}

variable "vnet_cidr" {
  type        = string
  description = "CIDR block for the platform VNet."
  default     = "10.31.0.0/16"
}

variable "public_subnet_cidr" {
  type        = string
  description = "CIDR for public (ingress) subnet."
  default     = "10.31.0.0/24"
}

variable "private_subnet_cidr" {
  type        = string
  description = "CIDR for private (workload) subnet."
  default     = "10.31.1.0/24"
}

variable "aks_kubernetes_version" {
  type        = string
  description = "AKS Kubernetes version."
  default     = "1.31"
}

variable "aks_node_vm_size" {
  type        = string
  description = "VM size for AKS worker nodes."
  default     = "Standard_D2s_v3"
}

variable "aks_node_min_count" {
  type        = number
  description = "Minimum AKS worker count (autoscaling)."
  default     = 1
}

variable "aks_node_max_count" {
  type        = number
  description = "Maximum AKS worker count (autoscaling)."
  default     = 3
}

variable "aks_node_count" {
  type        = number
  description = "Initial AKS worker count."
  default     = 2
}

variable "postgres_sku" {
  type        = string
  description = "Azure Database for PostgreSQL Flexible Server SKU."
  default     = "GP_Standard_D2s_v3"
}

variable "postgres_version" {
  type        = string
  description = "PostgreSQL engine version."
  default     = "16"
}

variable "postgres_storage_mb" {
  type        = number
  description = "PostgreSQL allocated storage in MB."
  default     = 131072
}

variable "postgres_backup_retention_days" {
  type        = number
  description = "PostgreSQL backup retention in days."
  default     = 7
}

variable "postgres_high_availability" {
  type        = bool
  description = "Enable PostgreSQL High Availability mode."
  default     = false
}

variable "postgres_admin_username" {
  type        = string
  description = "PostgreSQL admin username."
  default     = "portarium"
}

variable "postgres_admin_password" {
  type        = string
  description = "PostgreSQL admin password."
  sensitive   = true
  nullable    = false
}

variable "evidence_bucket_name" {
  type        = string
  description = "Base name for the evidence immutability container."
  default     = "evidence"
}

variable "enable_evidence_immutability" {
  type        = bool
  description = "Enable Azure Blob immutability policy on the evidence container."
  default     = true
}

variable "evidence_immutability_days" {
  type        = number
  description = "Immutability policy retention period in days."
  default     = 365
}

variable "tags" {
  type        = map(string)
  description = "Common tags to apply to all resources."
  default     = {}
}

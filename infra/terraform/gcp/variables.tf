variable "gcp_project_id" {
  type        = string
  description = "GCP project ID for all platform resources."
}

variable "gcp_region" {
  type        = string
  description = "GCP region for all platform resources."
  default     = "us-central1"
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

variable "vpc_subnet_cidr" {
  type        = string
  description = "CIDR for the primary platform subnet."
  default     = "10.32.0.0/20"
}

variable "pods_cidr" {
  type        = string
  description = "Secondary CIDR range for GKE pods."
  default     = "10.33.0.0/16"
}

variable "services_cidr" {
  type        = string
  description = "Secondary CIDR range for GKE services."
  default     = "10.34.0.0/20"
}

variable "gke_channel" {
  type        = string
  description = "GKE release channel."
  default     = "REGULAR"

  validation {
    condition     = contains(["RAPID", "REGULAR", "STABLE"], var.gke_channel)
    error_message = "gke_channel must be RAPID, REGULAR, or STABLE."
  }
}

variable "gke_machine_type" {
  type        = string
  description = "GKE node machine type."
  default     = "n2-standard-2"
}

variable "gke_node_count" {
  type        = number
  description = "Initial GKE node count per zone."
  default     = 1
}

variable "gke_min_node_count" {
  type        = number
  description = "Minimum GKE node count (autoscaling)."
  default     = 1
}

variable "gke_max_node_count" {
  type        = number
  description = "Maximum GKE node count (autoscaling)."
  default     = 3
}

variable "postgres_tier" {
  type        = string
  description = "Cloud SQL machine tier."
  default     = "db-g1-small"
}

variable "postgres_version" {
  type        = string
  description = "PostgreSQL version."
  default     = "POSTGRES_16"
}

variable "postgres_backup_enabled" {
  type        = bool
  description = "Enable automated backups."
  default     = true
}

variable "postgres_backup_start_time" {
  type        = string
  description = "Backup window start time (HH:MM UTC)."
  default     = "03:00"
}

variable "postgres_high_availability" {
  type        = bool
  description = "Enable Cloud SQL regional HA failover replica."
  default     = false
}

variable "evidence_bucket_name" {
  type        = string
  description = "Base name segment for the evidence GCS bucket."
  default     = "evidence"
}

variable "enable_evidence_retention" {
  type        = bool
  description = "Enable GCS bucket retention policy (WORM) on the evidence bucket."
  default     = true
}

variable "evidence_retention_seconds" {
  type        = number
  description = "Retention policy duration in seconds (default 365 days)."
  default     = 31536000
}

variable "labels" {
  type        = map(string)
  description = "Common labels to apply to all resources."
  default     = {}
}

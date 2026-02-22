variable "gcp_project_id" {
  type        = string
  description = "GCP project ID for the state bucket."
}

variable "gcp_region" {
  type        = string
  description = "GCP region for the state bucket."
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

variable "labels" {
  type        = map(string)
  description = "Common labels to apply to all resources."
  default     = {}
}

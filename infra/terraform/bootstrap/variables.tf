variable "aws_region" {
  type        = string
  description = "AWS region for the Terraform state backend resources."
  default     = "us-east-1"
}

variable "namespace" {
  type        = string
  description = "Project namespace used in resource naming."
  default     = "portarium"
}

variable "environment" {
  type        = string
  description = "Target environment name (dev, staging, prod)."
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "state_key_deletion_window_days" {
  type        = number
  description = "KMS key deletion window in days for the state bucket KMS key."
  default     = 10
}

variable "noncurrent_version_expiry_days" {
  type        = number
  description = "Number of days before noncurrent state object versions are expired."
  default     = 90
}

variable "noncurrent_versions_to_retain" {
  type        = number
  description = "Minimum number of noncurrent state object versions to retain."
  default     = 10
}

variable "tags" {
  type        = map(string)
  description = "Common tags applied to all managed resources."
  default     = {}
}

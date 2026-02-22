variable "location" {
  type        = string
  description = "Azure region for the state storage account."
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

variable "tags" {
  type        = map(string)
  description = "Common tags to apply to all resources."
  default     = {}
}

variable "aws_region" {
  type        = string
  description = "AWS region for the state bucket and lock table."
  default     = "us-east-1"
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

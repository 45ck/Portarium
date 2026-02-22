# Variables for the finops module.
# Bead: bead-0398

variable "environment" {
  description = "Deployment environment (dev / staging / prod)."
  type        = string
}

variable "namespace" {
  description = "Resource name prefix."
  type        = string
  default     = "portarium"
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget in USD. Alerts fire at 80% (forecasted) and 100% (actual)."
  type        = number

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "monthly_budget_usd must be a positive number."
  }
}

variable "alert_emails" {
  description = "Email addresses to notify on budget alerts and anomalies."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0
    error_message = "At least one alert email must be provided."
  }
}

variable "extra_mandatory_tags" {
  description = "Additional tag keys to require on resources (beyond Project, Environment, ManagedBy)."
  type        = list(string)
  default     = []
}

variable "enable_config_recorder" {
  description = "Create an AWS Config recorder and delivery channel. Set false if Config is already enabled account-wide."
  type        = bool
  default     = false
}

variable "config_s3_bucket" {
  description = "S3 bucket for AWS Config delivery (required when enable_config_recorder = true)."
  type        = string
  default     = ""
}

variable "activate_tenant_id_tag" {
  description = "Activate the TenantId cost allocation tag (enables per-tenant cost breakdown in Cost Explorer)."
  type        = bool
  default     = true
}

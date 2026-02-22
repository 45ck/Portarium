# Variables for the github-oidc module.
# Bead: bead-0395

variable "clouds" {
  description = "List of cloud providers to configure OIDC trust for. Valid values: 'aws', 'azure', 'gcp'."
  type        = list(string)
  default     = ["aws"]

  validation {
    condition     = length([for c in var.clouds : c if !contains(["aws", "azure", "gcp"], c)]) == 0
    error_message = "Each element of clouds must be 'aws', 'azure', or 'gcp'."
  }
}

variable "github_org" {
  description = "GitHub organisation or user name (e.g. '45ck')."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (e.g. 'Portarium')."
  type        = string
}

variable "github_main_branch" {
  description = "Primary branch name (usually 'main')."
  type        = string
  default     = "main"
}

variable "allowed_environments" {
  description = "GitHub Environments whose OIDC tokens are trusted (e.g. ['staging', 'prod'])."
  type        = list(string)
  default     = ["staging", "prod"]
}

variable "extra_subjects" {
  description = "Additional `sub` claim values to trust (e.g. pull-request ref patterns for preview environments)."
  type        = list(string)
  default     = []
}

variable "environment" {
  description = "Deployment tier label (dev / staging / prod)."
  type        = string
}

variable "namespace" {
  description = "Resource name prefix."
  type        = string
  default     = "portarium"
}

# ── AWS ───────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for IAM resource ARNs."
  type        = string
  default     = "us-east-1"
}

variable "aws_create_oidc_provider" {
  description = "Create the GitHub OIDC provider in this AWS account. Set false if it already exists."
  type        = bool
  default     = true
}

variable "aws_deploy_policy_arns" {
  description = "Additional IAM managed policy ARNs to attach to the GitHub CI role."
  type        = list(string)
  default     = []
}

# ── GCP ───────────────────────────────────────────────────────────────────

variable "gcp_project_id" {
  description = "GCP project ID (required when 'gcp' is in clouds)."
  type        = string
  default     = ""
}

# ── Azure ─────────────────────────────────────────────────────────────────
# No extra variables needed; tenant/subscription come from the provider config.

variable "extra_tags" {
  description = "Extra resource tags."
  type        = map(string)
  default     = {}
}

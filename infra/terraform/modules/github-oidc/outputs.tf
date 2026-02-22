# Outputs for the github-oidc module.
# Bead: bead-0395

output "aws_role_arn" {
  description = "ARN of the AWS IAM role that GitHub Actions assumes."
  value       = local.enable_aws ? aws_iam_role.github_ci[0].arn : ""
}

output "gcp_workload_identity_provider" {
  description = "Full resource name of the GCP Workload Identity Pool Provider."
  value = local.enable_gcp ? (
    google_iam_workload_identity_pool_provider.github[0].name
  ) : ""
}

output "gcp_service_account_email" {
  description = "Email of the GCP Service Account impersonated by GitHub Actions."
  value       = local.enable_gcp ? google_service_account.github_ci[0].email : ""
}

output "azure_client_id" {
  description = "Azure App Registration (client) ID for GitHub Actions OIDC."
  value       = local.enable_azure ? azuread_application.github_ci[0].client_id : ""
  sensitive   = false
}

output "azure_service_principal_object_id" {
  description = "Object ID of the Azure service principal."
  value       = local.enable_azure ? azuread_service_principal.github_ci[0].object_id : ""
}

output "state_bucket" {
  description = "GCS bucket name for Terraform remote state."
  value       = google_storage_bucket.tfstate.name
}

output "state_bucket_url" {
  description = "GCS bucket URL for Terraform remote state."
  value       = google_storage_bucket.tfstate.url
}

output "backend_config_snippet" {
  description = "Copy-paste-ready backend block for infra/terraform/gcp/backend.tf."
  value       = <<-EOT
    terraform {
      backend "gcs" {
        bucket = "${google_storage_bucket.tfstate.name}"
        prefix = "portarium/gcp"
      }
    }
  EOT
}

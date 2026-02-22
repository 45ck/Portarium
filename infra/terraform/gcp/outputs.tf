output "project_id" {
  description = "GCP project ID."
  value       = var.gcp_project_id
}

output "region" {
  description = "GCP region."
  value       = var.gcp_region
}

output "vpc_id" {
  description = "Platform VPC ID."
  value       = google_compute_network.main.id
}

output "gke_cluster_name" {
  description = "GKE cluster name."
  value       = google_container_cluster.platform.name
}

output "gke_endpoint" {
  description = "GKE control plane endpoint."
  value       = google_container_cluster.platform.endpoint
  sensitive   = true
}

output "postgres_connection_name" {
  description = "Cloud SQL instance connection name."
  value       = google_sql_database_instance.runtime.connection_name
}

output "postgres_db_name" {
  description = "Portarium database name."
  value       = google_sql_database.portarium.name
}

output "evidence_bucket" {
  description = "Evidence GCS bucket name."
  value       = google_storage_bucket.evidence.name
}

output "kms_key_id" {
  description = "Platform KMS crypto key ID."
  value       = google_kms_crypto_key.platform.id
}

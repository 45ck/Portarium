output "failover_dns" {
  description = "Route53 failover DNS FQDN — resolves to the active region."
  value       = module.multi_region.load_balancer_dns
}

output "primary_endpoint" {
  description = "Primary region ALB DNS name."
  value       = module.multi_region.primary_endpoint
}

output "secondary_endpoint" {
  description = "Secondary region ALB DNS name."
  value       = module.multi_region.secondary_endpoint
}

output "primary_eks_cluster" {
  description = "Primary EKS cluster name."
  value       = module.primary.eks_cluster_name
}

output "secondary_eks_cluster" {
  description = "Secondary EKS cluster name."
  value       = module.secondary.eks_cluster_name
}

output "primary_postgres_endpoint" {
  description = "Primary PostgreSQL endpoint."
  value       = module.primary.postgres_endpoint
}

output "secondary_db_endpoint" {
  description = "Secondary database endpoint (replica or Aurora cluster)."
  value       = module.multi_region.secondary_db_endpoint
}

output "primary_evidence_bucket" {
  description = "Primary evidence S3 bucket name."
  value       = module.primary.evidence_store_bucket
}

output "secondary_evidence_bucket" {
  description = "Secondary evidence S3 bucket name."
  value       = module.secondary.evidence_store_bucket
}

output "health_check_id" {
  description = "Route53 primary health check ID."
  value       = module.multi_region.health_check_id
}

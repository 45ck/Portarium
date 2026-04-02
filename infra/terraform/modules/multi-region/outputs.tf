output "load_balancer_dns" {
  description = "Route53 failover DNS record FQDN (resolves to active region ALB)."
  value       = aws_route53_record.primary.fqdn
}

output "primary_endpoint" {
  description = "Primary region ALB DNS name."
  value       = var.primary_alb_dns_name
}

output "secondary_endpoint" {
  description = "Secondary region ALB DNS name."
  value       = var.secondary_alb_dns_name
}

output "health_check_id" {
  description = "Route53 health check ID for the primary region."
  value       = aws_route53_health_check.primary.id
}

output "s3_replication_role_arn" {
  description = "IAM role ARN used for S3 cross-region replication."
  value       = aws_iam_role.s3_replication.arn
}

output "secondary_db_endpoint" {
  description = "Endpoint of the secondary-region database (Aurora cluster or RDS read replica)."
  value = (
    var.db_replication_mode == "aurora-global"
    ? try(aws_rds_cluster.secondary[0].endpoint, "")
    : try(aws_db_instance.read_replica[0].endpoint, "")
  )
}

output "secondary_db_reader_endpoint" {
  description = "Reader endpoint of the secondary Aurora cluster (empty for RDS read-replica mode)."
  value       = try(aws_rds_cluster.secondary[0].reader_endpoint, "")
}

output "redis_global_replication_group_id" {
  description = "ElastiCache global replication group ID (empty when disabled)."
  value       = try(aws_elasticache_global_replication_group.platform[0].id, "")
}

output "primary_region" {
  description = "Primary AWS region."
  value       = var.primary_region
}

output "secondary_region" {
  description = "Secondary AWS region."
  value       = var.secondary_region
}

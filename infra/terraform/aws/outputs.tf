output "vpc_id" {
  value = aws_vpc.main.id
}

output "eks_cluster_name" {
  value = aws_eks_cluster.platform.name
}

output "eks_cluster_endpoint" {
  value = aws_eks_cluster.platform.endpoint
}

output "eks_cluster_certificate_authority_data" {
  value = aws_eks_cluster.platform.certificate_authority[0].data
}

output "eks_node_group_name" {
  value = aws_eks_node_group.execution.node_group_name
}

output "postgres_endpoint" {
  value = aws_db_instance.runtime.endpoint
}

output "postgres_port" {
  value = aws_db_instance.runtime.port
}

output "postgres_db_name" {
  value = aws_db_instance.runtime.db_name
}

output "evidence_store_bucket" {
  value = aws_s3_bucket.evidence_store.bucket
}

output "evidence_object_lock_enabled" {
  value = var.enable_evidence_object_lock
}

output "platform_kms_key_arn" {
  value = aws_kms_key.platform.arn
}

output "region" {
  value = var.aws_region
}

variable "namespace" {
  type        = string
  description = "Project namespace used in naming."
  default     = "portarium"
}

variable "environment" {
  type        = string
  description = "Deployment environment name."
  default     = "prod"
}

variable "primary_region" {
  type        = string
  description = "AWS region for the primary (active) deployment."
}

variable "secondary_region" {
  type        = string
  description = "AWS region for the secondary (standby) deployment."
}

variable "primary_vpc_cidr" {
  type        = string
  description = "CIDR block for the primary region VPC."
  default     = "10.30.0.0/16"
}

variable "secondary_vpc_cidr" {
  type        = string
  description = "CIDR block for the secondary region VPC."
  default     = "10.31.0.0/16"
}

variable "failover_health_check_path" {
  type        = string
  description = "HTTP path for Route53 health check against control-plane."
  default     = "/healthz"
}

variable "failover_health_check_port" {
  type        = number
  description = "Port for Route53 health check."
  default     = 443
}

variable "failover_threshold" {
  type        = number
  description = "Number of consecutive health check failures before failover."
  default     = 3

  validation {
    condition     = var.failover_threshold >= 1 && var.failover_threshold <= 10
    error_message = "failover_threshold must be between 1 and 10."
  }
}

variable "domain_name" {
  type        = string
  description = "Root domain name for DNS failover routing (e.g. portarium.example.com)."
}

variable "hosted_zone_id" {
  type        = string
  description = "Route53 hosted zone ID for the domain."
}

variable "primary_alb_dns_name" {
  type        = string
  description = "DNS name of the primary region ALB (control-plane ingress)."
}

variable "primary_alb_zone_id" {
  type        = string
  description = "Route53 zone ID of the primary region ALB."
}

variable "secondary_alb_dns_name" {
  type        = string
  description = "DNS name of the secondary region ALB (control-plane ingress)."
}

variable "secondary_alb_zone_id" {
  type        = string
  description = "Route53 zone ID of the secondary region ALB."
}

# ---------- Database replication ----------

variable "db_replication_mode" {
  type        = string
  description = "Cross-region DB replication strategy."
  default     = "aurora-global"

  validation {
    condition     = contains(["aurora-global", "rds-read-replica"], var.db_replication_mode)
    error_message = "db_replication_mode must be aurora-global or rds-read-replica."
  }
}

variable "primary_db_cluster_arn" {
  type        = string
  description = "ARN of the primary Aurora cluster (required when db_replication_mode = aurora-global)."
  default     = ""
}

variable "primary_db_instance_arn" {
  type        = string
  description = "ARN of the primary RDS instance (required when db_replication_mode = rds-read-replica)."
  default     = ""
}

variable "db_instance_class" {
  type        = string
  description = "Instance class for the secondary-region database replica."
  default     = "db.r6g.large"
}

variable "db_subnet_group_name" {
  type        = string
  description = "DB subnet group in the secondary region for the replica."
  default     = ""
}

variable "db_security_group_ids" {
  type        = list(string)
  description = "Security group IDs in the secondary region for the DB replica."
  default     = []
}

# ---------- S3 cross-region replication ----------

variable "primary_evidence_bucket_arn" {
  type        = string
  description = "ARN of the primary evidence S3 bucket."
}

variable "primary_evidence_bucket_id" {
  type        = string
  description = "ID (name) of the primary evidence S3 bucket."
}

variable "secondary_evidence_bucket_arn" {
  type        = string
  description = "ARN of the destination evidence S3 bucket in the secondary region."
}

variable "primary_kms_key_arn" {
  type        = string
  description = "KMS key ARN in the primary region used for S3 encryption."
}

variable "secondary_kms_key_arn" {
  type        = string
  description = "KMS key ARN in the secondary region used for S3 encryption."
}

# ---------- ElastiCache ----------

variable "enable_elasticache_failover" {
  type        = bool
  description = "Enable ElastiCache (Redis) global datastore for cross-region failover."
  default     = false
}

variable "elasticache_node_type" {
  type        = string
  description = "ElastiCache node instance type."
  default     = "cache.r6g.large"
}

variable "elasticache_engine_version" {
  type        = string
  description = "Redis engine version for ElastiCache."
  default     = "7.1"
}

variable "primary_elasticache_subnet_group" {
  type        = string
  description = "ElastiCache subnet group name in the primary region."
  default     = ""
}

variable "secondary_elasticache_subnet_group" {
  type        = string
  description = "ElastiCache subnet group name in the secondary region."
  default     = ""
}

variable "elasticache_security_group_ids" {
  type        = list(string)
  description = "Security group IDs for ElastiCache in primary region."
  default     = []
}

variable "tags" {
  type        = map(string)
  description = "Common tags to apply to all tagged resources."
  default     = {}
}

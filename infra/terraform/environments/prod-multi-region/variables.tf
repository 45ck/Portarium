variable "primary_region" {
  type        = string
  description = "AWS region for the primary (active) deployment."
  default     = "us-east-1"
}

variable "secondary_region" {
  type        = string
  description = "AWS region for the secondary (standby) deployment."
  default     = "us-west-2"
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

variable "domain_name" {
  type        = string
  description = "Root domain for DNS failover routing."
}

variable "hosted_zone_id" {
  type        = string
  description = "Route53 hosted zone ID."
}

variable "primary_alb_dns_name" {
  type        = string
  description = "DNS name of the primary ALB."
}

variable "primary_alb_zone_id" {
  type        = string
  description = "Route53 zone ID of the primary ALB."
}

variable "secondary_alb_dns_name" {
  type        = string
  description = "DNS name of the secondary ALB."
}

variable "secondary_alb_zone_id" {
  type        = string
  description = "Route53 zone ID of the secondary ALB."
}

variable "failover_threshold" {
  type        = number
  description = "Number of consecutive health check failures before failover."
  default     = 3
}

variable "db_replication_mode" {
  type        = string
  description = "Cross-region DB replication strategy."
  default     = "aurora-global"
}

variable "primary_db_cluster_arn" {
  type        = string
  description = "ARN of the primary Aurora cluster."
  default     = ""
}

variable "primary_db_instance_arn" {
  type        = string
  description = "ARN of the primary RDS instance."
  default     = ""
}

variable "eks_cluster_version" {
  type        = string
  default     = "1.31"
}

variable "eks_node_instance_types" {
  type        = list(string)
  default     = ["t3.xlarge"]
}

variable "eks_node_min_size" {
  type        = number
  default     = 3
}

variable "eks_node_max_size" {
  type        = number
  default     = 10
}

variable "eks_node_desired_size" {
  type        = number
  default     = 3
}

variable "postgres_instance_class" {
  type        = string
  default     = "db.r6g.large"
}

variable "enable_elasticache_failover" {
  type        = bool
  default     = false
}

variable "elasticache_node_type" {
  type        = string
  default     = "cache.r6g.large"
}

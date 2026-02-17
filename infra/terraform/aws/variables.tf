variable "aws_region" {
  type        = string
  description = "AWS region for shared Portarium infrastructure."
  default     = "us-east-1"
}

variable "namespace" {
  type        = string
  description = "Project namespace used in naming."
  default     = "portarium"
}

variable "environment" {
  type        = string
  description = "Deployment environment name (local, dev, staging, prod)."
  default     = "dev"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the platform VPC."
  default     = "10.30.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "Optional explicit availability zones; fallbacks to available zones in the selected region."
  default     = []
}

variable "public_subnet_count" {
  type        = number
  description = "Number of public subnets to create."
  default     = 2
}

variable "private_subnet_count" {
  type        = number
  description = "Number of private subnets to create."
  default     = 2
}

variable "eks_cluster_version" {
  type        = string
  description = "EKS control plane version."
  default     = "1.31"
}

variable "eks_node_instance_types" {
  type        = list(string)
  description = "EC2 instance families for execution-plane worker capacity."
  default     = ["t3.medium"]
}

variable "eks_node_min_size" {
  type        = number
  description = "Minimum worker count."
  default     = 1
}

variable "eks_node_max_size" {
  type        = number
  description = "Maximum worker count."
  default     = 3
}

variable "eks_node_desired_size" {
  type        = number
  description = "Starting worker count."
  default     = 2
}

variable "postgres_db_name" {
  type        = string
  description = "PostgreSQL database name."
  default     = "portarium"
}

variable "postgres_username" {
  type        = string
  description = "PostgreSQL admin username."
  default     = "portarium"
}

variable "postgres_password" {
  type        = string
  description = "Optional PostgreSQL admin password. If unset, Terraform generates one."
  default     = null
  sensitive   = true
  nullable    = true
}

variable "postgres_instance_class" {
  type        = string
  description = "PostgreSQL instance class."
  default     = "db.t4g.medium"
}

variable "postgres_engine_version" {
  type        = string
  description = "PostgreSQL engine version."
  default     = "16.2"
}

variable "postgres_allocated_storage" {
  type        = number
  description = "PostgreSQL allocated storage in GB."
  default     = 100
}

variable "postgres_backup_retention_days" {
  type        = number
  description = "PostgreSQL backup retention in days."
  default     = 7
}

variable "postgres_multi_az" {
  type        = bool
  description = "Enable Postgres Multi-AZ deployment."
  default     = false
}

variable "postgres_deletion_protection" {
  type        = bool
  description = "Enable deletion protection for Postgres instances."
  default     = false
}

variable "evidence_bucket_name" {
  type        = string
  description = "Base name segment for evidence object store."
  default     = "evidence"
}

variable "enable_evidence_object_lock" {
  type        = bool
  description = "Enable S3 Object Lock on the evidence bucket."
  default     = true
}

variable "evidence_lock_mode" {
  type        = string
  description = "Object lock mode for the evidence bucket."
  default     = "GOVERNANCE"

  validation {
    condition     = contains(["GOVERNANCE", "COMPLIANCE"], var.evidence_lock_mode)
    error_message = "evidence_lock_mode must be GOVERNANCE or COMPLIANCE."
  }
}

variable "evidence_lock_days" {
  type        = number
  description = "Default evidence retention window in days."
  default     = 365
}

variable "tags" {
  type        = map(string)
  description = "Common tags to apply to all tagged resources."
  default     = {}
}

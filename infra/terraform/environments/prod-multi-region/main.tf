###############################################################################
# Portarium Production Multi-Region Environment
#
# Deploys the single-region AWS stack in two regions and wires up
# cross-region failover via the multi-region module (ADR-0075).
###############################################################################

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    # Configured via -backend-config at init time
  }
}

provider "aws" {
  region = var.primary_region
  alias  = "primary"

  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  region = var.secondary_region
  alias  = "secondary"

  default_tags {
    tags = local.common_tags
  }
}

locals {
  common_tags = {
    Project     = "portarium"
    Environment = "prod"
    ManagedBy   = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# Primary region — reuse existing single-region module
# ---------------------------------------------------------------------------

module "primary" {
  source = "../../aws"

  providers = {
    aws = aws.primary
  }

  aws_region                 = var.primary_region
  namespace                  = "portarium"
  environment                = "prod"
  vpc_cidr                   = var.primary_vpc_cidr
  eks_cluster_version        = var.eks_cluster_version
  eks_node_instance_types    = var.eks_node_instance_types
  eks_node_min_size          = var.eks_node_min_size
  eks_node_max_size          = var.eks_node_max_size
  eks_node_desired_size      = var.eks_node_desired_size
  postgres_instance_class    = var.postgres_instance_class
  postgres_multi_az          = true
  postgres_deletion_protection = true
  postgres_backup_retention_days = 35
  enable_evidence_object_lock = true
  evidence_lock_mode         = "COMPLIANCE"
  evidence_lock_days         = 2555
  tags                       = local.common_tags
}

# ---------------------------------------------------------------------------
# Secondary region — same single-region stack (standby)
# ---------------------------------------------------------------------------

module "secondary" {
  source = "../../aws"

  providers = {
    aws = aws.secondary
  }

  aws_region                 = var.secondary_region
  namespace                  = "portarium"
  environment                = "prod-dr"
  vpc_cidr                   = var.secondary_vpc_cidr
  eks_cluster_version        = var.eks_cluster_version
  eks_node_instance_types    = var.eks_node_instance_types
  eks_node_min_size          = 1
  eks_node_max_size          = var.eks_node_max_size
  eks_node_desired_size      = 1
  postgres_instance_class    = var.postgres_instance_class
  postgres_multi_az          = true
  postgres_deletion_protection = true
  postgres_backup_retention_days = 35
  enable_evidence_object_lock = true
  evidence_lock_mode         = "COMPLIANCE"
  evidence_lock_days         = 2555
  tags                       = local.common_tags
}

# ---------------------------------------------------------------------------
# Multi-region failover orchestration
# ---------------------------------------------------------------------------

module "multi_region" {
  source = "../../modules/multi-region"

  providers = {
    aws           = aws.primary
    aws.secondary = aws.secondary
  }

  namespace        = "portarium"
  environment      = "prod"
  primary_region   = var.primary_region
  secondary_region = var.secondary_region

  # DNS failover
  domain_name          = var.domain_name
  hosted_zone_id       = var.hosted_zone_id
  failover_threshold   = var.failover_threshold
  primary_alb_dns_name   = var.primary_alb_dns_name
  primary_alb_zone_id    = var.primary_alb_zone_id
  secondary_alb_dns_name = var.secondary_alb_dns_name
  secondary_alb_zone_id  = var.secondary_alb_zone_id

  # Database replication
  db_replication_mode     = var.db_replication_mode
  primary_db_cluster_arn  = var.primary_db_cluster_arn
  primary_db_instance_arn = var.primary_db_instance_arn
  db_instance_class       = var.postgres_instance_class

  # S3 evidence replication
  primary_evidence_bucket_arn = module.primary.evidence_store_bucket
  primary_evidence_bucket_id  = module.primary.evidence_store_bucket
  secondary_evidence_bucket_arn = "arn:aws:s3:::${module.secondary.evidence_store_bucket}"
  primary_kms_key_arn         = module.primary.platform_kms_key_arn
  secondary_kms_key_arn       = module.secondary.platform_kms_key_arn

  # ElastiCache
  enable_elasticache_failover = var.enable_elasticache_failover
  elasticache_node_type       = var.elasticache_node_type

  tags = local.common_tags
}

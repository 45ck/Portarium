###############################################################################
# Multi-Region Failover Module — Portarium (ADR-0075)
#
# Implements primary-active / secondary-standby failover using:
#   - Route53 health-checked failover routing
#   - Aurora Global Database (or RDS cross-region read replica)
#   - S3 cross-region replication for evidence artifacts
#   - ElastiCache (Redis) global datastore (optional)
###############################################################################

locals {
  name_prefix = "${var.namespace}-${var.environment}"
  common_tags = merge(
    {
      Project     = var.namespace
      Environment = var.environment
      ManagedBy   = "Terraform"
      MultiRegion = "true"
    },
    var.tags,
  )
}

# ---------------------------------------------------------------------------
# Route53 DNS failover
# ---------------------------------------------------------------------------

resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_alb_dns_name
  port               = var.failover_health_check_port
  type               = "HTTPS"
  resource_path      = var.failover_health_check_path
  failure_threshold  = var.failover_threshold
  request_interval   = 10
  measure_latency    = true

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-primary-hc" })
}

resource "aws_route53_record" "primary" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.primary_alb_dns_name
    zone_id                = var.primary_alb_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier  = "${local.name_prefix}-primary"
  health_check_id = aws_route53_health_check.primary.id
}

resource "aws_route53_record" "secondary" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.secondary_alb_dns_name
    zone_id                = var.secondary_alb_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier = "${local.name_prefix}-secondary"
}

# ---------------------------------------------------------------------------
# Aurora Global Database (when db_replication_mode = "aurora-global")
# ---------------------------------------------------------------------------

resource "aws_rds_global_cluster" "platform" {
  count = var.db_replication_mode == "aurora-global" ? 1 : 0

  global_cluster_identifier = "${local.name_prefix}-global"
  source_db_cluster_identifier = var.primary_db_cluster_arn
  force_destroy                = false
}

resource "aws_rds_cluster" "secondary" {
  count = var.db_replication_mode == "aurora-global" ? 1 : 0

  provider                  = aws.secondary
  cluster_identifier        = "${local.name_prefix}-secondary"
  global_cluster_identifier = aws_rds_global_cluster.platform[0].id
  engine                    = "aurora-postgresql"
  engine_mode               = "provisioned"
  db_subnet_group_name      = var.db_subnet_group_name
  vpc_security_group_ids    = var.db_security_group_ids

  lifecycle {
    ignore_changes = [replication_source_identifier]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-secondary-aurora" })
}

resource "aws_rds_cluster_instance" "secondary" {
  count = var.db_replication_mode == "aurora-global" ? 1 : 0

  provider           = aws.secondary
  identifier         = "${local.name_prefix}-secondary-instance"
  cluster_identifier = aws_rds_cluster.secondary[0].id
  instance_class     = var.db_instance_class
  engine             = "aurora-postgresql"

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-secondary-instance" })
}

# ---------------------------------------------------------------------------
# RDS Cross-Region Read Replica (when db_replication_mode = "rds-read-replica")
# ---------------------------------------------------------------------------

resource "aws_db_instance" "read_replica" {
  count = var.db_replication_mode == "rds-read-replica" ? 1 : 0

  provider               = aws.secondary
  identifier             = "${local.name_prefix}-rr"
  replicate_source_db    = var.primary_db_instance_arn
  instance_class         = var.db_instance_class
  storage_encrypted      = true
  kms_key_id             = var.secondary_kms_key_arn
  publicly_accessible    = false
  multi_az               = true
  auto_minor_version_upgrade = true
  skip_final_snapshot    = true

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-read-replica" })
}

# ---------------------------------------------------------------------------
# S3 Cross-Region Replication for evidence artifacts
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "s3_replication_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "s3_replication" {
  name               = "${local.name_prefix}-s3-replication"
  assume_role_policy = data.aws_iam_policy_document.s3_replication_assume.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "s3_replication" {
  statement {
    sid     = "SourceBucketAccess"
    actions = [
      "s3:GetReplicationConfiguration",
      "s3:ListBucket",
    ]
    resources = [var.primary_evidence_bucket_arn]
  }

  statement {
    sid     = "SourceObjectAccess"
    actions = [
      "s3:GetObjectVersionForReplication",
      "s3:GetObjectVersionAcl",
      "s3:GetObjectVersionTagging",
    ]
    resources = ["${var.primary_evidence_bucket_arn}/*"]
  }

  statement {
    sid     = "DestinationReplication"
    actions = [
      "s3:ReplicateObject",
      "s3:ReplicateDelete",
      "s3:ReplicateTags",
    ]
    resources = ["${var.secondary_evidence_bucket_arn}/*"]
  }

  statement {
    sid     = "SourceKMSDecrypt"
    actions = ["kms:Decrypt"]
    resources = [var.primary_kms_key_arn]
  }

  statement {
    sid     = "DestinationKMSEncrypt"
    actions = ["kms:Encrypt"]
    resources = [var.secondary_kms_key_arn]
  }
}

resource "aws_iam_role_policy" "s3_replication" {
  name   = "${local.name_prefix}-s3-replication"
  role   = aws_iam_role.s3_replication.id
  policy = data.aws_iam_policy_document.s3_replication.json
}

resource "aws_s3_bucket_replication_configuration" "evidence" {
  bucket = var.primary_evidence_bucket_id
  role   = aws_iam_role.s3_replication.arn

  rule {
    id     = "evidence-cross-region"
    status = "Enabled"

    filter {
      prefix = ""
    }

    destination {
      bucket        = var.secondary_evidence_bucket_arn
      storage_class = "STANDARD"

      encryption_configuration {
        replica_kms_key_id = var.secondary_kms_key_arn
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }

    delete_marker_replication {
      status = "Disabled"
    }
  }

  depends_on = [aws_iam_role_policy.s3_replication]
}

# ---------------------------------------------------------------------------
# ElastiCache (Redis) Global Datastore (optional)
# ---------------------------------------------------------------------------

resource "aws_elasticache_global_replication_group" "platform" {
  count = var.enable_elasticache_failover ? 1 : 0

  global_replication_group_id_suffix = "${local.name_prefix}-redis"
  primary_replication_group_id       = aws_elasticache_replication_group.primary[0].id
  global_replication_group_description = "Portarium Redis cross-region failover"
}

resource "aws_elasticache_replication_group" "primary" {
  count = var.enable_elasticache_failover ? 1 : 0

  replication_group_id = "${local.name_prefix}-redis-primary"
  description          = "Portarium Redis primary — ${var.primary_region}"
  node_type            = var.elasticache_node_type
  num_cache_clusters   = 2
  engine_version       = var.elasticache_engine_version
  subnet_group_name    = var.primary_elasticache_subnet_group
  security_group_ids   = var.elasticache_security_group_ids
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = true

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-redis-primary" })
}

resource "aws_elasticache_replication_group" "secondary" {
  count = var.enable_elasticache_failover ? 1 : 0

  provider                      = aws.secondary
  replication_group_id          = "${local.name_prefix}-redis-secondary"
  description                   = "Portarium Redis secondary — ${var.secondary_region}"
  global_replication_group_id   = aws_elasticache_global_replication_group.platform[0].global_replication_group_id
  num_cache_clusters            = 2
  subnet_group_name             = var.secondary_elasticache_subnet_group
  automatic_failover_enabled    = true

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-redis-secondary" })
}

# -----------------------------------------------------------------------------
# Portarium – Terraform remote state bootstrap (AWS)
#
# This stack provisions the S3 bucket and DynamoDB table that serve as the
# remote state backend for all Portarium AWS provider stacks.
#
# Uses LOCAL backend — the state for this bootstrap stack itself lives in
# terraform.tfstate in this directory. Back that file up securely; losing it
# means the state-backend resources become unmanaged.
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.namespace}-${var.environment}"
  common_tags = merge(
    {
      Project     = var.namespace
      Environment = var.environment
      ManagedBy   = "Terraform"
      Component   = "state-backend"
    },
    var.tags
  )
}

resource "random_id" "state_bucket_suffix" {
  byte_length = 4
}

# ── KMS key for state-at-rest encryption ─────────────────────────────────────

resource "aws_kms_key" "tfstate" {
  description             = "KMS key for Portarium Terraform remote state encryption (${var.environment})"
  deletion_window_in_days = var.state_key_deletion_window_days
  enable_key_rotation     = true
  tags                    = local.common_tags
}

resource "aws_kms_alias" "tfstate" {
  name          = "alias/${local.name_prefix}-tfstate"
  target_key_id = aws_kms_key.tfstate.key_id
}

# ── S3 bucket for Terraform state files ──────────────────────────────────────

resource "aws_s3_bucket" "tfstate" {
  bucket = "${local.name_prefix}-tfstate-${random_id.state_bucket_suffix.hex}"
  tags = merge(local.common_tags, {
    Purpose = "Terraform remote state"
  })
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.tfstate.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    id     = "expire-noncurrent-state-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      newer_noncurrent_versions = var.noncurrent_versions_to_retain
      noncurrent_days           = var.noncurrent_version_expiry_days
    }
  }
}

# ── DynamoDB table for state locking ─────────────────────────────────────────

resource "aws_dynamodb_table" "tfstate_lock" {
  name         = "${local.name_prefix}-tfstate-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = merge(local.common_tags, {
    Purpose = "Terraform state locking"
  })
}

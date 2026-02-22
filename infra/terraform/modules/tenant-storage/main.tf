# Module: tenant-storage
#
# Provisions isolated storage for a single Portarium tenant according to their
# storage tier:
#
#   shared  — schema-per-tenant on the shared platform RDS instance.
#             Only IAM role + Vault path are provisioned; no RDS resource.
#   dedicated — dedicated RDS instance (DB-per-tenant).
#               Full lifecycle: create, backup, final snapshot on destroy.
#
# Usage:
#   module "tenant_acme" {
#     source            = "../modules/tenant-storage"
#     tenant_id         = "tenant-acme"
#     tier              = "dedicated"
#     environment       = "prod"
#     namespace         = "portarium"
#     subnet_ids        = module.platform.private_subnet_ids
#     vpc_id            = module.platform.vpc_id
#     node_sg_id        = module.platform.eks_node_sg_id
#     kms_key_arn       = module.platform.kms_key_arn
#     shared_db_host    = module.platform.postgres_host   # used only for shared tier
#   }
#
# Bead: bead-0392

locals {
  name_prefix = "${var.namespace}-${var.environment}-${var.tenant_id}"
  is_dedicated = var.tier == "dedicated"

  common_tags = merge(
    {
      Project     = var.namespace
      Environment = var.environment
      TenantId    = var.tenant_id
      StorageTier = var.tier
      ManagedBy   = "Terraform"
    },
    var.extra_tags,
  )
}

# ── Dedicated tier: RDS instance ───────────────────────────────────────────

resource "random_password" "tenant_db" {
  count   = local.is_dedicated ? 1 : 0
  length  = 24
  special = false
}

resource "aws_security_group" "tenant_db" {
  count       = local.is_dedicated ? 1 : 0
  name        = "${local.name_prefix}-db"
  description = "Allow EKS worker nodes to reach the ${var.tenant_id} tenant DB"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.node_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-db-sg" })
}

resource "aws_db_subnet_group" "tenant" {
  count      = local.is_dedicated ? 1 : 0
  name       = "${local.name_prefix}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = merge(local.common_tags, { Name = "${local.name_prefix}-subnet-group" })
}

resource "aws_db_instance" "tenant" {
  count = local.is_dedicated ? 1 : 0

  identifier     = "${local.name_prefix}-db"
  engine         = "postgres"
  engine_version = var.postgres_engine_version
  instance_class = var.postgres_instance_class

  allocated_storage     = var.postgres_allocated_storage
  max_allocated_storage = var.postgres_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn

  db_name  = replace(var.tenant_id, "-", "_")
  username = "portarium"
  password = random_password.tenant_db[0].result

  db_subnet_group_name   = aws_db_subnet_group.tenant[0].name
  vpc_security_group_ids = [aws_security_group.tenant_db[0].id]

  multi_az                  = var.multi_az
  backup_retention_period   = var.backup_retention_days
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:30-Mon:05:30"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = !var.deletion_protection
  final_snapshot_identifier = var.deletion_protection ? "${local.name_prefix}-final" : null
  auto_minor_version_upgrade = true
  publicly_accessible        = false

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-db" })
}

# Store DB credentials in Vault so the application can retrieve them via VSO.
resource "vault_kv_secret_v2" "tenant_db_creds" {
  count = local.is_dedicated ? 1 : 0
  mount = var.vault_kv_mount
  name  = "tenants/${var.tenant_id}/db"

  data_json = jsonencode({
    host     = aws_db_instance.tenant[0].address
    port     = 5432
    database = replace(var.tenant_id, "-", "_")
    username = "portarium"
    password = random_password.tenant_db[0].result
  })
}

# ── Shared tier: Vault path with schema name only ──────────────────────────
# For shared-tier tenants, the control plane uses the shared RDS instance and
# creates the per-tenant schema on demand (see tenant-storage-provisioner.ts).
# We only record the schema name in Vault so workers know where to connect.

resource "vault_kv_secret_v2" "shared_schema_ref" {
  count = local.is_dedicated ? 0 : 1
  mount = var.vault_kv_mount
  name  = "tenants/${var.tenant_id}/db"

  data_json = jsonencode({
    host     = var.shared_db_host
    port     = 5432
    database = "portarium"
    schema   = "tenant_${replace(var.tenant_id, "-", "_")}"
    username = "portarium_shared"
    # password is shared service-account credential, managed separately
  })
}

# ── Backup automation (dedicated tier only) ────────────────────────────────
# AWS Backup plan: daily snapshots retained for backup_retention_days.

resource "aws_backup_vault" "tenant" {
  count       = local.is_dedicated ? 1 : 0
  name        = "${local.name_prefix}-backup-vault"
  kms_key_arn = var.kms_key_arn
  tags        = local.common_tags
}

resource "aws_backup_plan" "tenant" {
  count = local.is_dedicated ? 1 : 0
  name  = "${local.name_prefix}-backup-plan"

  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.tenant[0].name
    schedule          = "cron(0 3 * * ? *)" # 03:00 UTC daily

    lifecycle {
      delete_after = var.backup_retention_days
    }

    copy_action {
      destination_vault_arn = var.backup_cross_region_vault_arn != "" ? var.backup_cross_region_vault_arn : aws_backup_vault.tenant[0].arn
    }
  }

  tags = local.common_tags
}

resource "aws_backup_selection" "tenant_db" {
  count        = local.is_dedicated ? 1 : 0
  name         = "${local.name_prefix}-db-selection"
  plan_id      = aws_backup_plan.tenant[0].id
  iam_role_arn = var.backup_role_arn

  resources = [aws_db_instance.tenant[0].arn]
}

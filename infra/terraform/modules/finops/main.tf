# Module: finops
#
# Provisions FinOps governance for a Portarium environment:
#   - AWS Budgets: monthly cost threshold alerts (warning at 80%, critical at 100%)
#   - AWS Config: mandatory-tag compliance rules
#   - Cost Allocation Tag activation (required before tags appear in Cost Explorer)
#   - IAM Cost Explorer read policy for the CI role
#
# Usage:
#   module "finops_prod" {
#     source              = "../modules/finops"
#     environment         = "prod"
#     namespace           = "portarium"
#     monthly_budget_usd  = 5000
#     alert_emails        = ["ops@portarium.io", "finance@portarium.io"]
#   }
#
# Bead: bead-0398

locals {
  name_prefix = "${var.namespace}-${var.environment}"
  mandatory_tags = concat(
    ["Project", "Environment", "ManagedBy"],
    var.extra_mandatory_tags,
  )
}

# ── AWS Budgets ────────────────────────────────────────────────────────────

resource "aws_budgets_budget" "monthly" {
  name         = "${local.name_prefix}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Filter to only count costs tagged with this environment.
  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$${var.environment}"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.alert_emails
  }
}

# Anomaly detection budget: alert if daily spend is > 20% above trailing
# 7-day average.
resource "aws_ce_anomaly_monitor" "portarium" {
  name              = "${local.name_prefix}-anomaly-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "portarium" {
  name      = "${local.name_prefix}-anomaly-subscription"
  frequency = "DAILY"

  monitor_arn_list = [aws_ce_anomaly_monitor.portarium.arn]

  subscriber {
    type    = "EMAIL"
    address = var.alert_emails[0]
  }

  threshold_expression {
    and {
      dimension {
        key           = "ANOMALY_TOTAL_IMPACT_PERCENTAGE"
        match_options = ["GREATER_THAN_OR_EQUAL"]
        values        = ["20"]
      }
    }
    and {
      dimension {
        key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
        match_options = ["GREATER_THAN_OR_EQUAL"]
        values        = ["50"]    # alert only if ≥ $50 absolute impact
      }
    }
  }
}

# ── AWS Config: mandatory tag compliance ──────────────────────────────────

# Enable the AWS Config recorder if not already enabled.
resource "aws_config_configuration_recorder" "portarium" {
  count    = var.enable_config_recorder ? 1 : 0
  name     = "${local.name_prefix}-config"
  role_arn = aws_iam_role.config[0].arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = false
  }
}

resource "aws_config_delivery_channel" "portarium" {
  count          = var.enable_config_recorder ? 1 : 0
  name           = "${local.name_prefix}-config-channel"
  s3_bucket_name = var.config_s3_bucket
  depends_on     = [aws_config_configuration_recorder.portarium]
}

resource "aws_config_configuration_recorder_status" "portarium" {
  count      = var.enable_config_recorder ? 1 : 0
  name       = aws_config_configuration_recorder.portarium[0].name
  is_enabled = true
  depends_on = [aws_config_delivery_channel.portarium]
}

resource "aws_iam_role" "config" {
  count = var.enable_config_recorder ? 1 : 0
  name  = "${local.name_prefix}-config-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "config.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "config" {
  count      = var.enable_config_recorder ? 1 : 0
  role       = aws_iam_role.config[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole"
}

# Managed rule: required-tags on EC2 instances, EKS clusters, RDS instances,
# S3 buckets.
resource "aws_config_config_rule" "required_tags" {
  name = "${local.name_prefix}-required-tags"

  source {
    owner             = "AWS"
    source_identifier = "REQUIRED_TAGS"
  }

  input_parameters = jsonencode({
    tag1Key = local.mandatory_tags[0]
    tag2Key = length(local.mandatory_tags) > 1 ? local.mandatory_tags[1] : null
    tag3Key = length(local.mandatory_tags) > 2 ? local.mandatory_tags[2] : null
    tag4Key = length(local.mandatory_tags) > 3 ? local.mandatory_tags[3] : null
  })

  scope {
    compliance_resource_types = [
      "AWS::EC2::Instance",
      "AWS::EKS::Cluster",
      "AWS::RDS::DBInstance",
      "AWS::S3::Bucket",
    ]
  }

  depends_on = [aws_config_configuration_recorder_status.portarium]
}

# ── Cost allocation tags ───────────────────────────────────────────────────
# Tags must be activated in Cost Explorer before they appear in reports.

resource "aws_ce_cost_allocation_tag" "project" {
  tag_key = "Project"
  status  = "Active"
}

resource "aws_ce_cost_allocation_tag" "environment" {
  tag_key = "Environment"
  status  = "Active"
}

resource "aws_ce_cost_allocation_tag" "tenant_id" {
  count   = var.activate_tenant_id_tag ? 1 : 0
  tag_key = "TenantId"
  status  = "Active"
}

resource "aws_ce_cost_allocation_tag" "managed_by" {
  tag_key = "ManagedBy"
  status  = "Active"
}

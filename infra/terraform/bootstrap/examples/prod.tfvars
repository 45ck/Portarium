aws_region  = "us-east-1"
namespace   = "portarium"
environment = "prod"

# Retain more versions for longer in production
noncurrent_versions_to_retain  = 20
noncurrent_version_expiry_days = 365

# Longer KMS key deletion window for production
state_key_deletion_window_days = 30

tags = {
  Team       = "platform"
  CostCenter = "infra"
}

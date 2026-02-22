aws_region  = "us-east-1"
namespace   = "portarium"
environment = "dev"

# Shorter retention for dev: keep 5 versions for 30 days
noncurrent_versions_to_retain  = 5
noncurrent_version_expiry_days = 30

tags = {
  Team       = "platform"
  CostCenter = "infra"
}

aws_region  = "us-east-1"
namespace   = "portarium"
environment = "staging"

noncurrent_versions_to_retain  = 10
noncurrent_version_expiry_days = 60

tags = {
  Team       = "platform"
  CostCenter = "infra"
}

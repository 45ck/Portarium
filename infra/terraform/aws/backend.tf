# ---------------------------------------------------------------------------
# Terraform remote state — AWS S3 + DynamoDB locking
#
# BEFORE USE:
#   1. Run infra/terraform/aws-backend-bootstrap/ once with local state to
#      provision the S3 bucket and DynamoDB lock table.
#   2. Copy the `backend_config_snippet` output, paste it here, and uncomment.
#   3. Run `terraform init -migrate-state` to move local state into S3.
#
# STATE KEY CONVENTION:
#   portarium/<cloud>/<stack>/terraform.tfstate
#   e.g. portarium/aws/platform/terraform.tfstate
# ---------------------------------------------------------------------------

# Uncomment and fill in values produced by aws-backend-bootstrap:
#
# terraform {
#   backend "s3" {
#     bucket         = "<namespace>-<environment>-tfstate"
#     key            = "portarium/aws/platform/terraform.tfstate"
#     region         = "us-east-1"
#     encrypt        = true
#     dynamodb_table = "<namespace>-<environment>-tfstate-lock"
#   }
# }

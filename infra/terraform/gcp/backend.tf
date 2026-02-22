# ---------------------------------------------------------------------------
# Terraform remote state — GCS (native locking via Cloud Storage)
#
# BEFORE USE:
#   1. Run infra/terraform/gcp-backend-bootstrap/ once with local state to
#      provision the GCS bucket.
#   2. Copy the `backend_config_snippet` output, paste it here, and uncomment.
#   3. Run `terraform init -migrate-state` to move local state into GCS.
#
# AUTHENTICATION:
#   Uses Application Default Credentials (ADC).  In CI, bind a Workload
#   Identity service account with roles/storage.objectAdmin on the bucket.
# ---------------------------------------------------------------------------

# Uncomment and fill in values produced by gcp-backend-bootstrap:
#
# terraform {
#   backend "gcs" {
#     bucket = "<namespace>-<environment>-tfstate-<suffix>"
#     prefix = "portarium/gcp/platform"
#   }
# }

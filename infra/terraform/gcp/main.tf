locals {
  prefix = "${var.namespace}-${var.environment}"
}

# ---------------------------------------------------------------------------
# GCP platform implementation — parity with infra/terraform/aws/
# See infra/terraform/README.md for planned module set.
# ---------------------------------------------------------------------------

locals {
  prefix = "${var.namespace}-${var.environment}"
}

resource "random_id" "suffix" {
  byte_length = 3
}

# ---------------------------------------------------------------------------
# GCS bucket — Terraform remote state storage
# GCS provides native state locking via the Storage API (no separate resource needed).
# ---------------------------------------------------------------------------

resource "google_storage_bucket" "tfstate" {
  name          = "${local.prefix}-tfstate-${random_id.suffix.hex}"
  location      = var.gcp_region
  force_destroy = false

  storage_class               = "STANDARD"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 10
    }
    action {
      type = "Delete"
    }
  }

  labels = merge(var.labels, {
    managed-by = "terraform-backend-bootstrap"
  })
}

# Prevent public access at project level (belt-and-suspenders)
resource "google_storage_bucket_iam_binding" "tfstate_no_public" {
  bucket = google_storage_bucket.tfstate.name
  role   = "roles/storage.objectViewer"
  members = []
}

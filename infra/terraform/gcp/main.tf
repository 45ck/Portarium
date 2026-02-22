locals {
  prefix = "${var.namespace}-${var.environment}"
  common_labels = merge(var.labels, {
    namespace   = var.namespace
    environment = var.environment
    managed-by  = "terraform"
  })
}

# ---------------------------------------------------------------------------
# Cloud KMS — platform encryption key ring and key
# ---------------------------------------------------------------------------

resource "google_kms_key_ring" "platform" {
  name     = "${local.prefix}-keyring"
  location = var.gcp_region
}

resource "google_kms_crypto_key" "platform" {
  name     = "${local.prefix}-platform-key"
  key_ring = google_kms_key_ring.platform.id

  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# VPC — network + subnets
# ---------------------------------------------------------------------------

resource "google_compute_network" "main" {
  name                    = "${local.prefix}-vpc"
  auto_create_subnetworks = false
  project                 = var.gcp_project_id
}

resource "google_compute_subnetwork" "platform" {
  name          = "${local.prefix}-sn"
  ip_cidr_range = var.vpc_subnet_cidr
  region        = var.gcp_region
  network       = google_compute_network.main.id
  project       = var.gcp_project_id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr
  }

  private_ip_google_access = true
}

# ---------------------------------------------------------------------------
# GKE — control-plane cluster + execution-plane node pool
# ---------------------------------------------------------------------------

resource "google_container_cluster" "platform" {
  name     = "${local.prefix}-gke"
  location = var.gcp_region
  project  = var.gcp_project_id

  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.platform.id

  # We manage node pools separately
  remove_default_node_pool = true
  initial_node_count       = 1

  release_channel {
    channel = var.gke_channel
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  workload_identity_config {
    workload_pool = "${var.gcp_project_id}.svc.id.goog"
  }

  resource_labels = local.common_labels
}

resource "google_container_node_pool" "execution" {
  name     = "${local.prefix}-execution"
  cluster  = google_container_cluster.platform.name
  location = var.gcp_region
  project  = var.gcp_project_id

  node_count = var.gke_node_count

  autoscaling {
    min_node_count = var.gke_min_node_count
    max_node_count = var.gke_max_node_count
  }

  node_config {
    machine_type = var.gke_machine_type
    disk_size_gb = 100

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
  }
}

# ---------------------------------------------------------------------------
# Cloud SQL — runtime PostgreSQL persistence
# ---------------------------------------------------------------------------

resource "google_sql_database_instance" "runtime" {
  name             = "${local.prefix}-postgres"
  database_version = var.postgres_version
  region           = var.gcp_region
  project          = var.gcp_project_id

  settings {
    tier = var.postgres_tier

    backup_configuration {
      enabled    = var.postgres_backup_enabled
      start_time = var.postgres_backup_start_time

      backup_retention_settings {
        retained_backups = 7
      }
    }

    availability_type = var.postgres_high_availability ? "REGIONAL" : "ZONAL"

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "portarium" {
  name     = "portarium"
  instance = google_sql_database_instance.runtime.name
  project  = var.gcp_project_id
}

# ---------------------------------------------------------------------------
# GCS — evidence store with optional retention policy (WORM)
# ---------------------------------------------------------------------------

resource "random_id" "evidence_suffix" {
  byte_length = 3
}

resource "google_storage_bucket" "evidence" {
  name          = "${local.prefix}-${var.evidence_bucket_name}-${random_id.evidence_suffix.hex}"
  location      = var.gcp_region
  project       = var.gcp_project_id
  force_destroy = false

  storage_class               = "STANDARD"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  dynamic "retention_policy" {
    for_each = var.enable_evidence_retention ? [1] : []

    content {
      retention_period = var.evidence_retention_seconds
      is_locked        = false # set true to lock permanently
    }
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.platform.id
  }

  labels = local.common_labels
}

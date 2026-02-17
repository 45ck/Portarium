# GCP Terraform reference (planned)

GCP implementation is intentionally not implemented in this milestone.

The AWS stack (`infra/terraform/aws`) is the first provider-specific baseline.
Planned equivalents for this layer include:

- GKE control-plane baseline for separate control/execution workloads
- Cloud SQL for runtime persistence
- WORM-like retention controls on object storage
- KMS + Secret Manager-backed credential orchestration
- Optional Artifact Registry and workload identity wiring

Track this folder as the target for future provider parity work.

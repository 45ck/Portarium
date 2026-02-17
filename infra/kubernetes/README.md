# Kubernetes Reference Topology

This folder defines a production-oriented reference topology for Portarium using
Kustomize:

- `base/` contains control-plane and execution-plane runtime objects, OTel collector,
  RBAC, PDB, ingress, and network controls.
- `overlays/dev` pins low-scale defaults for development validation.
- `overlays/staging` mirrors the production topology with moderate scaling.
- `overlays/prod` enables highest resilience settings.

## Design intent

- Control Plane and Execution Plane are separated at the workload level and policy level.
- Network policies default-deny and then opt-in for observability, workflow engine,
  evidence, and secrets.
- Deployment baseline currently uses runnable scaffolds from `infra/docker/*` that provide
  health endpoints and can be replaced with production binaries in later milestones.

## Planned next step

- Add a Temporal dependency deployment chart or platform-managed alternative.
- Move image references from `ghcr.io/your-org/...` to the real registry.
- Add ServiceMonitor / alerting templates and signed image verification.

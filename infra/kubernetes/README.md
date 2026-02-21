# Kubernetes Reference Topology

This folder defines a production-oriented reference topology for Portarium using
Kustomize:

- `base/` contains control-plane and execution-plane runtime objects, OTel collector,
  observability backends (Tempo, Loki, Prometheus, Grafana), RBAC, PDB, ingress,
  and network controls.
- `overlays/dev` pins low-scale defaults for development validation.
- `overlays/staging` mirrors the production topology with moderate scaling.
- `overlays/prod` enables highest resilience settings.

## Design intent

- Control Plane and Execution Plane are separated at the workload level and policy level.
- Network policies default-deny and then opt-in for observability, workflow engine,
  evidence, and secrets.
- OTel Collector routes traces to Tempo, logs to Loki, and exposes Prometheus scrape
  metrics for dashboard and alert wiring.
- Deployment baseline currently uses runnable scaffolds from `infra/docker/*` that provide
  health endpoints and can be replaced with production binaries in later milestones.

## SPIRE mTLS (bead-0671)

`base/spire/` contains SPIRE server and agent manifests for in-cluster mutual TLS:

- **spire-server.yaml**: StatefulSet running the SPIRE server with K8s PSAT node attestation,
  SQLite data store, and disk key manager. Trust domain: `portarium.io`.
- **spire-agent.yaml**: DaemonSet running on each node, attesting workloads via K8s
  WorkloadAttestor. Exposes a Unix domain socket at `/run/spire/sockets/agent.sock`.
- **registration-entries.yaml**: ConfigMap documenting the SPIFFE ID assignments:
  - Control Plane: `spiffe://portarium.io/ns/portarium/sa/portarium-control-plane`
  - Execution Plane: `spiffe://portarium.io/ns/portarium/sa/portarium-execution-plane`
  - Agent: `spiffe://portarium.io/ns/portarium/sa/portarium-agent`

Workloads obtain X.509 SVIDs from the local SPIRE agent socket. The sidecar proxy
(bead-0675) uses these for mTLS between components.

## Egress Network Policies (bead-0673)

`base/network-policies/` contains deny-by-default egress NetworkPolicies:

- **agent-egress-deny.yaml**: Denies all egress from agent pods, then allows
  control-plane API (8080), Vault (8200), and DNS (53).
- **execution-plane-egress.yaml**: Denies all egress from worker pods, then allows
  control-plane API, Vault, Temporal (7233), OTel collector (4317/4318), and DNS.

External SoR egress is not included by default. Per-workspace egress allowlists
will be added via `MachineExecutionPolicyV1.egressAllowlist` in a follow-up.

## Planned next step

- Add a Temporal dependency deployment chart or platform-managed alternative.
- Move image references from `ghcr.io/your-org/...` to the real registry.
- Add ServiceMonitor / alerting templates and signed image verification.

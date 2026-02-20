# Infrastructure Layer Reference Implementation Notes

This folder stores the infrastructure baseline for Portarium and follows ADR-0056.

## Current Baseline (implemented in this repo)

- `docker-compose.yml` at repository root defines local shared dependencies for:
  - PostgreSQL runtime database (`evidence-db`),
  - Temporal runtime (`temporal`),
  - MinIO evidence object store (`evidence-store`),
  - Vault dev instance (`vault`),
  - OpenTelemetry collector (`otel-collector`),
  - Grafana Tempo for distributed trace storage (`tempo`),
  - Grafana for trace visualization (`grafana`, port 3100),
  - NATS JetStream event bus (`nats`, ADR-0074).
- `docker-compose.local.yml` adds placeholder Control Plane and Execution Plane services built from
  `infra/docker/*` for infrastructure parity during local development.
- `.specify/specs/infrastructure-layer-v1.md` defines the infra contract for v1.
- `docs/adr/0056-infrastructure-reference-architecture.md` stores the architectural decision.
- `infra/kubernetes` provides a reference base and `dev|staging|prod` overlays.
- `infra/terraform` contains provider entry points with a concrete AWS baseline.

## Execution model

- The Control Plane remains the canonical boundary for workflow scheduling, approval,
  and evidence metadata.
- Workers are deployed in a separate runtime boundary in later milestones
  (untrusted execution containment).
- Current container artifacts are platform-neutral runnable scaffolds that expose
  health probes for k8s and compose parity validation.

## Reference structure

- `infra/` currently stores infrastructure documentation and
  observability runtime config, plus Terraform and Kubernetes module catalogs.
- `infra/otel/` stores OpenTelemetry collector config plus pack-aware dashboards and
  regression detector alert rules.
- `infra/docker/` stores container image scaffolds for Control Plane / Execution Plane.
- `infra/kubernetes/` stores reference Kubernetes manifests using Kustomize.
- `infra/terraform/` tracks provider-specific IaC entry points (`aws` implemented,
  `azure`/`gcp` planned).

## Workstreams and owners

- Specification and design: ADR-0056 and
  `.specify/specs/infrastructure-layer-v1.md`.
- Local dependency parity: maintain `docker-compose.yml`.
- Security posture: harden worker isolation, secret delivery, and egress controls.

## Observability stack (bead-0679)

All Portarium components export telemetry via OTLP to the OpenTelemetry Collector:

- **Control Plane handler** -- exports traces and metrics for HTTP request handling.
- **Agent Gateway** -- exports traces for proxied requests with injected trace context.
- **Temporal workers** -- exports activity-level spans for workflow execution.

The collector pipeline applies:

- `attributes/redact` processor: hashes `tenant.id`, deletes `user.email`, `user.ip`, and
  authorization headers to prevent sensitive data from reaching trace backends.
- `batch` processor: batches telemetry for efficient export.
- Exports to Grafana Tempo (`otlp/tempo`) and console logging.

Local development visualization:

- Grafana is available at `http://localhost:3100` (auto-provisioned with Tempo datasource).
- Tempo API is available at `http://localhost:3200`.

Config files:

- `infra/otel/collector-config.yaml` -- OTel Collector pipeline config.
- `infra/otel/tempo-config.yaml` -- Grafana Tempo storage config.
- `infra/otel/grafana-datasources.yaml` -- Grafana datasource provisioning.

## Network policies (bead-0673)

Kubernetes NetworkPolicy manifests enforce deny-by-default egress:

- `agent-network-policy.yaml`: Agent pods (`portarium.io/workload: agent`) have all egress
  denied, then explicitly allow only the control-plane service (port 3000) and DNS.
- `execution-plane-network-policy.yaml`: Execution-plane workers
  (`portarium.io/workload: execution-plane`) deny all egress, then allow control-plane,
  Temporal (7233), evidence store (9000), Vault (8200), OTel collector (4317/4318),
  DNS, and HTTPS (443) for SoR egress.

## Current CI/CD references

- `.github/workflows/ci-infra.yml` validates compose, Terraform formatting,
  and Kubernetes overlay builds.
- `.github/workflows/ci-images.yml` builds Control Plane and Execution Plane images.
- `.github/workflows/cd-k8s-deploy.yml` is a gated manual deployment workflow
  for environment overlays.

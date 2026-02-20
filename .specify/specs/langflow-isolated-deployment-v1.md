# Langflow Isolated Deployment v1

## Purpose

Define infrastructure controls for deploying Langflow as an isolated external execution runtime behind a reverse proxy.

## Required Controls

- Deploy Langflow as a dedicated service instance per environment boundary.
- Set `LANGFLOW_AUTO_LOGIN=false`.
- Set `LANGFLOW_ENABLE_SUPERUSER_CLI=false`.
- Provide `LANGFLOW_SECRET_KEY` from a secret source.
- Require API key validation with:
  - `LANGFLOW_API_KEY_SOURCE=env`
  - `LANGFLOW_API_KEY` sourced from secrets
- Expose only reverse proxy ingress externally; do not expose Langflow directly.

## Networking Constraints

- Cluster policies must default deny ingress/egress.
- Only `langflow-proxy` may reach Langflow on TCP `7860`.
- Only ingress controller and approved internal Portarium services may reach `langflow-proxy` on TCP `8080`.
- Langflow and proxy egress must be explicitly allow-listed.

## Evidence Expectations

- Repository includes:
  - compose profile entries for `langflow` and `langflow-proxy`,
  - Kubernetes manifests for deployment, service, ingress, and network policy,
  - operator guidance in `infra/langflow/README.md`.

# Langflow Isolated Deployment Profile

This directory contains reverse-proxy configuration for the Langflow execution
plane profile used by Portarium.

## Security posture

- `LANGFLOW_AUTO_LOGIN=false` to disable implicit login.
- `LANGFLOW_SECRET_KEY` is explicitly configured.
- `LANGFLOW_API_KEY_SOURCE=env` with `LANGFLOW_API_KEY` sourced from secrets.
- Superuser bootstrap requires explicit credentials.
- `LANGFLOW_ENABLE_SUPERUSER_CLI=false` to avoid ad-hoc local superuser creation.
- Langflow is not exposed directly; requests route through `langflow-proxy`.

## Local compose

Langflow services are declared in `docker-compose.yml`:

- `langflow` (internal app)
- `langflow-proxy` (external ingress point)

Proxy configuration source: `infra/langflow/nginx.conf`.

Local API calls should include `x-api-key` using the configured Langflow API key.

## Kubernetes profile

Kubernetes manifests in `infra/kubernetes/base/` define:

- Langflow deployment/service
- NGINX reverse-proxy deployment/service
- ingress route for proxy
- explicit network policies for proxy/Langflow ingress+egress

Environment overlays (`dev`, `staging`, `prod`) patch replica counts to keep
instances isolated by environment deployment boundary.

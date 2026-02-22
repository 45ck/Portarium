# Getting Started: Local Development

This guide is for your first successful local runtime boot.

## Prerequisites

- Node.js `>=22`
- Docker + Docker Compose
- npm

## Install dependencies

```bash
npm ci
```

## Start local infrastructure

```bash
docker compose up -d
```

Services are defined in `docker-compose.yml` and include PostgreSQL, Temporal, MinIO, Vault, and OpenTelemetry collector.

## Run control plane runtime

```bash
npx tsx src/presentation/runtime/control-plane.ts
```

```powershell
npx tsx src/presentation/runtime/control-plane.ts
```

Default bind: `0.0.0.0:8080`

Environment overrides:

- `PORTARIUM_HTTP_PORT`
- `PORTARIUM_PORT`
- `PORTARIUM_CONTAINER_ROLE` or `PORTARIUM_ROLE`

Health checks:

```bash
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/readyz
```

```powershell
Invoke-RestMethod http://localhost:8080/healthz
Invoke-RestMethod http://localhost:8080/readyz
```

## Run execution-plane runtime

```bash
PORTARIUM_ENABLE_TEMPORAL_WORKER=true npx tsx src/presentation/runtime/worker.ts
```

```powershell
$env:PORTARIUM_ENABLE_TEMPORAL_WORKER = "true"
npx tsx src/presentation/runtime/worker.ts
```

Default bind: `0.0.0.0:8081`

Health checks:

```bash
curl -s http://localhost:8081/healthz
curl -s http://localhost:8081/readyz
```

```powershell
Invoke-RestMethod http://localhost:8081/healthz
Invoke-RestMethod http://localhost:8081/readyz
```

## Dev token auth (local bypass)

Protected routes return `401` when no JWKS endpoint is configured. For local
development you can enable a static token bypass instead of running a full IdP:

```bash
export PORTARIUM_DEV_TOKEN=my-local-dev-token
export PORTARIUM_DEV_WORKSPACE_ID=ws-local
# Optional: defaults to "dev-user"
export PORTARIUM_DEV_USER_ID=alice
```

```powershell
$env:PORTARIUM_DEV_TOKEN = "my-local-dev-token"
$env:PORTARIUM_DEV_WORKSPACE_ID = "ws-local"
$env:PORTARIUM_DEV_USER_ID = "alice"
```

Then restart the control-plane runtime. A warning is printed to stderr when dev
auth is active. The token grants `admin` role in the specified workspace.

> **Never set `PORTARIUM_DEV_TOKEN` in staging or production.** It bypasses all
> JWKS signature validation.

### Calling a protected endpoint

```bash
curl -i -H "Authorization: Bearer my-local-dev-token" \
  http://localhost:8080/v1/workspaces/ws-local
```

```powershell
Invoke-WebRequest http://localhost:8080/v1/workspaces/ws-local `
  -Headers @{ Authorization = "Bearer my-local-dev-token" }
```

### Cockpit integration

Cockpit reads `VITE_PORTARIUM_API_BEARER_TOKEN` at build time and falls back to
`localStorage`. Set this to the same value as `PORTARIUM_DEV_TOKEN`:

```bash
VITE_PORTARIUM_API_BEARER_TOKEN=my-local-dev-token npm run dev
```

```powershell
$env:VITE_PORTARIUM_API_BEARER_TOKEN = "my-local-dev-token"
npm run dev
```

Or set it at runtime in the browser console:

```js
localStorage.setItem('portarium_cockpit_bearer_token', 'my-local-dev-token');
location.reload();
```

## Call a v1 endpoint

```bash
curl -i http://localhost:8080/v1/workspaces/demo
```

```powershell
Invoke-WebRequest http://localhost:8080/v1/workspaces/demo -Method GET
```

Expected behavior without auth config: `401 Unauthorized` on protected routes.

## Success Checklist

- `http://localhost:8080/healthz` returns `200`
- `http://localhost:8081/healthz` returns `200`
- `/v1/workspaces/...` returns `401` without auth config (expected)
- With `PORTARIUM_DEV_TOKEN` set, `Authorization: Bearer <token>` returns `200`

## Common Pitfalls

- Port conflicts on `8080`/`8081`: set `PORTARIUM_HTTP_PORT`.
- Missing Docker dependencies: confirm `docker compose ps` is healthy.
- PowerShell env var persistence: remove when done with `Remove-Item Env:PORTARIUM_ENABLE_TEMPORAL_WORKER`.

## Next

- `docs/getting-started/dev-workflow.md`
- `docs/reference/http-api.md`

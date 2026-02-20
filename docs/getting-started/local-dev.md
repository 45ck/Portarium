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
- `/v1/workspaces/...` returns `401` before JWT/JWKS config (expected)

## Common Pitfalls

- Port conflicts on `8080`/`8081`: set `PORTARIUM_HTTP_PORT`.
- Missing Docker dependencies: confirm `docker compose ps` is healthy.
- PowerShell env var persistence: remove when done with `Remove-Item Env:PORTARIUM_ENABLE_TEMPORAL_WORKER`.

## Next

- `docs/getting-started/dev-workflow.md`
- `docs/reference/http-api.md`

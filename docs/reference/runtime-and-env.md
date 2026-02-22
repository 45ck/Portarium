# Reference: Runtime and Environment

## Runtime entrypoints

- Control plane: `src/presentation/runtime/control-plane.ts`
- Execution plane worker: `src/presentation/runtime/worker.ts`
- Health server: `src/presentation/runtime/health-server.ts`

## Control plane env

- `PORTARIUM_HTTP_PORT` or `PORTARIUM_PORT` (default: `8080`)
- `PORTARIUM_CONTAINER_ROLE` or `PORTARIUM_ROLE` (default: `control-plane`)

### Store

- `PORTARIUM_USE_POSTGRES_STORES` — set `true` to use Postgres-backed stores
- `PORTARIUM_DATABASE_URL` — Postgres connection string (required when `PORTARIUM_USE_POSTGRES_STORES=true`)
- `DEV_STUB_STORES` — set `true` (with `NODE_ENV=development` or `test`) to allow in-memory stub stores

### Authentication

- `PORTARIUM_JWKS_URI` — JWKS endpoint; enables JWT auth when set
- `PORTARIUM_JWT_ISSUER` (optional) — expected token issuer
- `PORTARIUM_JWT_AUDIENCE` (optional) — expected token audience
- `ENABLE_DEV_AUTH` — set `true` (with `NODE_ENV=development`) to activate static dev token auth
- `PORTARIUM_DEV_TOKEN` — static bearer token for dev auth (requires `ENABLE_DEV_AUTH=true`)
- `PORTARIUM_DEV_WORKSPACE_ID` — workspace ID injected by the dev token
- `PORTARIUM_DEV_USER_ID` (optional) — user ID injected by the dev token

### Authorisation

- `PORTARIUM_OPENFGA_API_URL` (optional) — OpenFGA API URL; enables fine-grained authz when set with store id
- `PORTARIUM_OPENFGA_STORE_ID` (optional) — OpenFGA store ID (required with API URL)
- `PORTARIUM_OPENFGA_AUTHORIZATION_MODEL_ID` (optional)
- `PORTARIUM_OPENFGA_API_TOKEN` (optional) — bearer token for OpenFGA API

### Rate limiting

- `RATE_LIMIT_STORE` — `redis` to use Redis-backed distributed rate limiting (default: `memory`)
- `REDIS_URL` — Redis connection URL (required when `RATE_LIMIT_STORE=redis`)

## Worker env

- `PORTARIUM_HTTP_PORT` or `PORTARIUM_PORT` (default: `8081`)
- `PORTARIUM_CONTAINER_ROLE` or `PORTARIUM_ROLE` (default: `execution-plane`)
- `PORTARIUM_ENABLE_TEMPORAL_WORKER` — `true|1|yes|on` to start the Temporal worker loop
- `PORTARIUM_TEMPORAL_ADDRESS` (default: `temporal:7233`) — Temporal server address
- `PORTARIUM_TEMPORAL_NAMESPACE` (default: `default`) — Temporal namespace
- `PORTARIUM_TEMPORAL_TASK_QUEUE` (default: `portarium-runs`) — Temporal task queue

## Health endpoints

Available on both runtimes:

- `/healthz`
- `/readyz`
- `/ready`
- `/health`

Response shape:

```json
{ "service": "control-plane", "status": "ok", "startedAt": "..." }
```

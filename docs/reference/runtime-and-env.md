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
- `PORTARIUM_JWT_ISSUER` — expected token issuer; required whenever `PORTARIUM_JWKS_URI` is set
- `PORTARIUM_JWT_AUDIENCE` — expected token audience; required whenever `PORTARIUM_JWKS_URI` is set
- `PORTARIUM_JWT_AUTHORIZED_PARTY` — expected `azp`/client id; required for production JWKS auth
- `PORTARIUM_JWT_TRUSTED_ISSUERS` — comma-separated exact issuer allowlist; required for production JWKS auth and must include `PORTARIUM_JWT_ISSUER`
- `PORTARIUM_JWT_REQUIRED_TOKEN_TYPE` — strict JWT `typ` header, `at+JWT` for new access-token issuances or `JWT` for legacy migration
- `ENABLE_DEV_AUTH` — set `true` with `NODE_ENV=development` or `NODE_ENV=test` to activate static dev token auth
- `PORTARIUM_DEV_TOKEN` — static bearer token for dev auth (requires `ENABLE_DEV_AUTH=true`)
- `PORTARIUM_DEV_WORKSPACE_ID` — workspace ID injected by the dev token
- `PORTARIUM_DEV_USER_ID` (optional) — user ID injected by the dev token

Production deployments must use JWKS auth. Dev-token auth is rejected outside
`development`/`test` and is disabled unless `ENABLE_DEV_AUTH=true`,
`PORTARIUM_DEV_TOKEN`, and `PORTARIUM_DEV_WORKSPACE_ID` are all present.

### Cockpit browser origin and session

The supported production topology is same-origin Cockpit and control-plane
routes behind one reverse proxy. In that mode Cockpit calls relative `/auth/*`
and `/v1/*` URLs and no CORS headers are required.

For deliberate cross-origin deployments, set:

- `PORTARIUM_CORS_ALLOWED_ORIGINS` — comma-separated exact browser origins allowed to call the control plane with credentials. Wildcards, paths, queries, and suffix matching are rejected.

Cockpit web sessions use server-owned HttpOnly cookies:

- `PORTARIUM_COCKPIT_OIDC_ISSUER` — OIDC issuer for Cockpit login; defaults to `PORTARIUM_JWT_ISSUER` when omitted
- `PORTARIUM_COCKPIT_OIDC_CLIENT_ID` — OIDC client id for Cockpit login
- `PORTARIUM_COCKPIT_OIDC_REDIRECT_URI` — callback URL registered with the IdP
- `PORTARIUM_COCKPIT_SESSION_COOKIE` — optional cookie name override
- `PORTARIUM_COCKPIT_SESSION_TTL_SECONDS` — optional web session TTL override

### Authorisation

- `PORTARIUM_OPENFGA_API_URL` (optional) — OpenFGA API URL; enables fine-grained authz when set with store id
- `PORTARIUM_OPENFGA_STORE_ID` (optional) — OpenFGA store ID (required with API URL)
- `PORTARIUM_OPENFGA_AUTHORIZATION_MODEL_ID` (optional)
- `PORTARIUM_OPENFGA_API_TOKEN` (optional) — bearer token for OpenFGA API

### Rate limiting

- `RATE_LIMIT_STORE` — `redis` to use Redis-backed distributed rate limiting (default: `memory`)
- `REDIS_URL` — Redis connection URL (required when `RATE_LIMIT_STORE=redis`)
- Workspace API requests with an empty workspace segment, such as `/v1/workspaces//...`, are counted against the shared malformed-workspace rate-limit scope before routing.

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

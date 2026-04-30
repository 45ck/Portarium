# Container Images

Two multi-stage Dockerfiles build the Portarium control plane and execution worker.

## Images

| File                       | Container role    | Default port |
| -------------------------- | ----------------- | ------------ |
| `control-plane.Dockerfile` | `control-plane`   | 8080         |
| `worker.Dockerfile`        | `execution-plane` | 8081         |

Both images:

- Expose health endpoints at `/healthz` and `/readyz`
- Run as the unprivileged `node` user
- Inherit default env vars from `ENV` directives (overridable via compose or `docker run -e`)

## Running locally with Docker Compose

Wire both images into the full local stack using `docker-compose.local.yml` (cockpit profile):

```bash
COMPOSE_PROFILES=baseline,runtime,auth,cockpit \
  docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
```

Verify health endpoints once containers start:

```bash
curl http://localhost:8080/healthz   # API server  → {"service":"control-plane","status":"ok",...}
curl http://localhost:8081/healthz   # Worker      → {"service":"execution-plane","status":"ok",...}
```

## Key env vars (control plane)

| Variable                            | Required   | Default  | Description                                                            |
| ----------------------------------- | ---------- | -------- | ---------------------------------------------------------------------- |
| `PORTARIUM_HTTP_PORT`               | no         | `8080`   | HTTP listen port                                                       |
| `PORTARIUM_USE_POSTGRES_STORES`     | yes (prod) | —        | Set `true` to use Postgres stores                                      |
| `PORTARIUM_DATABASE_URL`            | yes (prod) | —        | Postgres connection string                                             |
| `PORTARIUM_JWKS_URI`                | prod auth  | —        | JWKS endpoint; requires issuer and audience                            |
| `PORTARIUM_JWT_ISSUER`              | prod auth  | —        | Expected JWT issuer                                                    |
| `PORTARIUM_JWT_AUDIENCE`            | prod auth  | —        | Expected JWT audience                                                  |
| `PORTARIUM_JWT_AUTHORIZED_PARTY`    | prod auth  | —        | Expected `azp` client id                                               |
| `PORTARIUM_JWT_TRUSTED_ISSUERS`     | prod auth  | —        | Comma-separated exact issuer allowlist                                 |
| `PORTARIUM_JWT_REQUIRED_TOKEN_TYPE` | prod auth  | —        | Strict JWT `typ`, normally `at+JWT`                                    |
| `PORTARIUM_CORS_ALLOWED_ORIGINS`    | as needed  | —        | Exact browser origins for deliberate cross-origin Cockpit              |
| `PORTARIUM_OPENFGA_API_URL`         | no         | —        | OpenFGA API URL (enables fine-grained authz)                           |
| `PORTARIUM_OPENFGA_STORE_ID`        | no         | —        | OpenFGA store ID                                                       |
| `ENABLE_DEV_AUTH`                   | dev only   | —        | Set `true` + `NODE_ENV=development` or `test` to enable dev token auth |
| `PORTARIUM_DEV_TOKEN`               | dev only   | —        | Static bearer token for dev auth                                       |
| `PORTARIUM_DEV_WORKSPACE_ID`        | dev only   | —        | Workspace ID injected by dev token                                     |
| `RATE_LIMIT_STORE`                  | no         | `memory` | `redis` to use Redis-backed rate limiting                              |
| `REDIS_URL`                         | no         | —        | Redis URL (required when `RATE_LIMIT_STORE=redis`)                     |

## Key env vars (worker)

| Variable                           | Required | Default          | Description                              |
| ---------------------------------- | -------- | ---------------- | ---------------------------------------- |
| `PORTARIUM_HTTP_PORT`              | no       | `8081`           | HTTP listen port                         |
| `PORTARIUM_ENABLE_TEMPORAL_WORKER` | no       | `false`          | Set `true` to start Temporal worker loop |
| `PORTARIUM_TEMPORAL_ADDRESS`       | no       | `temporal:7233`  | Temporal server address                  |
| `PORTARIUM_TEMPORAL_NAMESPACE`     | no       | `default`        | Temporal namespace                       |
| `PORTARIUM_TEMPORAL_TASK_QUEUE`    | no       | `portarium-runs` | Temporal task queue                      |

See `docs/reference/runtime-and-env.md` for the complete env surface reference.

# Integration Harness

Deterministic bootstrap for local control-plane scenario execution.

## Quick Start

```bash
# Default: dev-token auth, baseline seed
npm run integration:harness

# OIDC/JWKS auth + Odoo ERP seed
npm run integration:harness -- --auth oidc --seed odoo

# Health check only (no compose up, no seed)
npm run integration:harness -- --check-only

# Machine-readable JSON report
npm run integration:harness -- --json
```

## Auth Profiles

### dev-token (default)

Uses a static bearer token for authentication. No external IdP required.

- Profiles started: `baseline`, `runtime`, `auth`
- Token: `PORTARIUM_DEV_TOKEN` env var (default: `portarium-dev-token`)
- Workspace: `PORTARIUM_DEV_WORKSPACE_ID` (default: `ws-local-dev`)

### oidc

Uses Keycloak as an OIDC identity provider with JWKS token validation.

- Profiles started: `baseline`, `runtime`, `auth`, `idp`
- Keycloak URL: `http://localhost:8180`
- Realm: `portarium`
- Test users: alice (approver), bob (operator), carol (auditor)
- Client: `portarium-cockpit` (public, PKCE)
- JWKS endpoint: `http://localhost:8180/realms/portarium/protocol/openid-connect/certs`

## Seed Modes

### baseline (default)

Seeds the canonical demo workspace, policy bundle, and evidence entry via the Portarium HTTP API.

### odoo

Runs baseline seed, then additionally installs Odoo modules (`account`, `project`) via XML-RPC. Idempotent -- skips already-installed modules.

Requires the `erp` compose profile (Odoo + Odoo DB).

## Readiness Report

The `--json` flag outputs a machine-readable report:

```json
{
  "timestamp": "2026-03-02T12:00:00.000Z",
  "authProfile": "dev-token",
  "seedMode": "baseline",
  "services": [
    { "service": "evidence-db", "url": "...", "status": "healthy", "latencyMs": 5 },
    { "service": "temporal", "url": "...", "status": "healthy", "latencyMs": 12 }
  ],
  "seed": { "baseline": "ok" },
  "auth": { "devToken": "ok" },
  "ready": true
}
```

Service status values: `healthy`, `unhealthy`, `skipped`.

## Troubleshooting

### Startup Failures

| Symptom                     | Cause                                  | Fix                                                            |
| --------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `docker compose` not found  | Docker not installed or not in PATH    | Install Docker Desktop; ensure `docker compose` (v2) works     |
| Port already in use         | Another process on 5432/7233/9000/8200 | `netstat -an \| grep <port>` then stop the conflicting process |
| Container exits immediately | Missing config file or bad env var     | `docker compose logs <service>` to see the error               |
| Compose timeout             | Slow machine or large image pulls      | Increase `HARNESS_COMPOSE_TIMEOUT` (default: 120s)             |
| Stale volumes               | Previous data causing schema conflicts | `docker compose down -v` to remove volumes, then retry         |

### Auth Failures

| Symptom                | Cause                     | Fix                                                                     |
| ---------------------- | ------------------------- | ----------------------------------------------------------------------- |
| Dev-token rejected     | Wrong token value         | Check `PORTARIUM_DEV_TOKEN` matches `docker-compose.local.yml`          |
| Dev-token 404          | API container not running | Ensure `cockpit` profile is active if testing against containerized API |
| JWKS fetch fails       | Keycloak not ready        | Keycloak needs 60-90s on first start; wait and retry                    |
| JWKS returns 0 keys    | Realm not imported        | Check `infra/keycloak/realm-portarium.json` is mounted                  |
| Token validation fails | Clock skew                | Ensure host and container clocks are synced                             |

### Seed Failures

| Symptom                       | Cause                                    | Fix                                                         |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `API not reachable`           | API container not running or not healthy | `docker compose logs portarium-api`; check depends_on chain |
| `seed-bundle failed`          | Database not migrated                    | Run `npm run dev:db:init` before seeding                    |
| Odoo XML-RPC fault            | Odoo not fully initialized               | Wait for Odoo health check to pass (60-120s first start)    |
| Odoo auth failure             | Wrong credentials                        | Check `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD` env vars      |
| Idempotency: "already exists" | Seed ran before (expected)               | This is normal; seed scripts are idempotent                 |

### Environment Variables

| Variable                  | Default                 | Description                                    |
| ------------------------- | ----------------------- | ---------------------------------------------- |
| `HARNESS_AUTH_PROFILE`    | `dev-token`             | Auth profile: `dev-token` or `oidc`            |
| `HARNESS_SEED_MODE`       | `baseline`              | Seed mode: `baseline` or `odoo`                |
| `HARNESS_COMPOSE_TIMEOUT` | `120`                   | Seconds to wait for `docker compose up --wait` |
| `LOCAL_STACK_URL`         | `http://localhost:8080` | API base URL                                   |
| `ODOO_URL`                | `http://localhost:4000` | Odoo base URL                                  |
| `KEYCLOAK_URL`            | `http://localhost:8180` | Keycloak base URL                              |
| `PORTARIUM_DEV_TOKEN`     | `portarium-dev-token`   | Static dev bearer token                        |

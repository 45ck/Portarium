# Getting Started: Local Development

This guide walks you through running the full Portarium stack locally in one command.

## Prerequisites

- Node.js `>=22`
- Docker + Docker Compose
- npm

## Quick Start — one-command seeded stack

```bash
npm ci
npm run dev:all
npm run dev:seed
```

This brings up Postgres, Temporal, MinIO, Vault, Keycloak, OpenFGA, Odoo, the control-plane API (port 8080), and the worker, then seeds demo workspace data. Verify the stack is healthy:

```bash
curl -s http://localhost:8080/healthz
# {"status":"ok"}
```

### Dev-auth bypass

Use the static dev token to skip IdP setup during local development:

```bash
export PORTARIUM_DEV_TOKEN=portarium-dev-token
export PORTARIUM_DEV_WORKSPACE_ID=ws-local
# Optional: defaults to "dev-user"
export PORTARIUM_DEV_USER_ID=alice
```

```powershell
$env:PORTARIUM_DEV_TOKEN = "portarium-dev-token"
$env:PORTARIUM_DEV_WORKSPACE_ID = "ws-local"
$env:PORTARIUM_DEV_USER_ID = "alice"
```

> **Never set `PORTARIUM_DEV_TOKEN` in staging or production.** It bypasses all
> JWKS signature validation.

Call a protected endpoint:

```bash
curl -i -H "Authorization: Bearer portarium-dev-token" \
  http://localhost:8080/v1/workspaces/ws-local
```

```powershell
Invoke-WebRequest http://localhost:8080/v1/workspaces/ws-local `
  -Headers @{ Authorization = "Bearer portarium-dev-token" }
```

### Cockpit integration

Cockpit reads `VITE_PORTARIUM_API_BEARER_TOKEN` at build time and falls back to
`localStorage`. Set this to the same value as `PORTARIUM_DEV_TOKEN`:

```bash
VITE_PORTARIUM_API_BEARER_TOKEN=portarium-dev-token npm run dev
```

```powershell
$env:VITE_PORTARIUM_API_BEARER_TOKEN = "portarium-dev-token"
npm run dev
```

Or set it at runtime in the browser console:

```js
localStorage.setItem('portarium_cockpit_bearer_token', 'portarium-dev-token');
location.reload();
```

---

## Local integration stack

`npm run dev:all` starts all infrastructure profiles in one command. The full
service map is:

| Service      | Profile     | URL / Port                             | Purpose                           |
| ------------ | ----------- | -------------------------------------- | --------------------------------- |
| Postgres     | `baseline`  | `localhost:5432`                       | Portarium evidence DB             |
| Temporal     | `runtime`   | `localhost:7233`                       | Workflow orchestration engine     |
| MinIO        | `runtime`   | `localhost:9000` / `9001` (console)    | Evidence object store             |
| Vault        | `auth`      | `localhost:8200`                       | Secret store (dev mode)           |
| **Keycloak** | **`idp`**   | **`http://localhost:8180`**            | OIDC identity provider            |
| **OpenFGA**  | **`authz`** | **`http://localhost:8181`** (HTTP API) | Fine-grained authorization engine |
| **Odoo 17**  | **`erp`**   | **`http://localhost:4000`**            | ERP (account + project modules)   |
| API server   | `cockpit`   | `http://localhost:8080`                | Portarium control-plane API       |
| Worker       | `cockpit`   | `http://localhost:8081`                | Temporal workflow worker          |

### Keycloak (profile: `idp`)

- **Admin console**: `http://localhost:8180` → credentials: `admin / admin`
- **Realm**: `portarium`
- **OIDC issuer**: `http://localhost:8180/realms/portarium`
- **Client**: `portarium-cockpit` (public, PKCE)

Pre-seeded demo users:

| Username | Password | Role       |
| -------- | -------- | ---------- |
| `alice`  | `alice`  | `approver` |
| `bob`    | `bob`    | `operator` |
| `carol`  | `carol`  | `auditor`  |

### OpenFGA (profile: `authz`)

- **HTTP API**: `http://localhost:8181` — used by the Portarium API for policy checks
- **Playground**: `http://localhost:3000` — visual model explorer
- **gRPC**: `localhost:8182`
- Store name: `portarium` (auto-created by `openfga-init` on first start)
- Authorization model: workspace roles (`approver`, `operator`, `auditor`, `member`)

Seed workspace role tuples for demo users:

```bash
npm run dev:seed:openfga
```

### Odoo 17 (profile: `erp`)

- **URL**: `http://localhost:4000` (maps to Odoo port 8069)
- **Database**: `portarium`
- **Admin credentials**: `admin / admin`
- Modules: `account`, `project`

Install required modules (run once after first `dev:all`):

```bash
npm run dev:seed:odoo
```

To start only the integration stack (no API/worker build), override `COMPOSE_PROFILES` before `npm run dev:all`:

```bash
# Bash
COMPOSE_PROFILES=baseline,runtime,auth,idp,authz,erp npm run dev:all
```

```powershell
# PowerShell
$env:COMPOSE_PROFILES = "baseline,runtime,auth,idp,authz,erp"
npm run dev:all
```

---

## Stopping and resetting

```bash
# Stop all services
docker compose -f docker-compose.yml -f docker-compose.local.yml down

# Reset database (destructive)
npm run dev:db:reset
```

---

## Success Checklist

- `http://localhost:8080/healthz` returns `200 {"status":"ok"}`
- With `PORTARIUM_DEV_TOKEN=portarium-dev-token` set, `Authorization: Bearer portarium-dev-token` returns `200` on protected routes

---

## Advanced: Manual component startup

If you want to run components individually without Docker (e.g. for debugging a specific service):

### Run control plane only

```bash
npx tsx src/presentation/runtime/control-plane.ts
```

Default bind: `0.0.0.0:8080`. Environment overrides:

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

### Run execution-plane worker

```bash
PORTARIUM_ENABLE_TEMPORAL_WORKER=true npx tsx src/presentation/runtime/worker.ts
```

```powershell
$env:PORTARIUM_ENABLE_TEMPORAL_WORKER = "true"
npx tsx src/presentation/runtime/worker.ts
```

Default bind: `0.0.0.0:8081`. Health checks:

```bash
curl -s http://localhost:8081/healthz
curl -s http://localhost:8081/readyz
```

```powershell
Invoke-RestMethod http://localhost:8081/healthz
Invoke-RestMethod http://localhost:8081/readyz
```

---

## Common Pitfalls

- Port conflicts on `8080`/`8081`: set `PORTARIUM_HTTP_PORT`.
- Missing Docker dependencies: confirm `docker compose ps` is healthy.
- PowerShell env var persistence: remove when done with `Remove-Item Env:PORTARIUM_ENABLE_TEMPORAL_WORKER`.

## Next

- `docs/getting-started/dev-workflow.md`
- `docs/reference/http-api.md`
- `docs/integration/demo-walkthrough.md` — full integration demo against a live stack

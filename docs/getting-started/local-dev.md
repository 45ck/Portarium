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
npm run seed:cockpit-live:validate
```

This brings up Postgres, Temporal, MinIO, Vault, Keycloak, OpenFGA, Odoo, the control-plane API (port 8080), and the worker, then seeds live Cockpit workspace data for `ws-local-dev`. The validation command checks the same Postgres data from the host and should report all checks as `ok: true`.

Verify the stack is healthy:

```bash
curl -s http://localhost:8080/healthz
# {"status":"ok"}
```

### Dev-auth bypass

Use the static dev token to skip IdP setup during local development:

```bash
export NODE_ENV=development
export ENABLE_DEV_AUTH=true
export PORTARIUM_DEV_TOKEN=portarium-dev-token
export PORTARIUM_DEV_WORKSPACE_ID=ws-local-dev
export PORTARIUM_DEV_USER_ID=user-local-dev
export PORTARIUM_CORS_ALLOWED_ORIGINS=http://cockpit.localhost:1355,http://localhost:1355,http://localhost:5173
```

```powershell
$env:NODE_ENV = "development"
$env:ENABLE_DEV_AUTH = "true"
$env:PORTARIUM_DEV_TOKEN = "portarium-dev-token"
$env:PORTARIUM_DEV_WORKSPACE_ID = "ws-local-dev"
$env:PORTARIUM_DEV_USER_ID = "user-local-dev"
$env:PORTARIUM_CORS_ALLOWED_ORIGINS = "http://cockpit.localhost:1355,http://localhost:1355,http://localhost:5173"
```

> **Never set `PORTARIUM_DEV_TOKEN` in staging or production.** It bypasses all
> JWKS signature validation and is rejected unless `ENABLE_DEV_AUTH=true` and
> `NODE_ENV` is `development` or `test`.

Call a protected endpoint:

```bash
curl -i -H "Authorization: Bearer portarium-dev-token" \
  http://localhost:8080/v1/workspaces/ws-local-dev
```

```powershell
Invoke-WebRequest http://localhost:8080/v1/workspaces/ws-local-dev `
  -Headers @{ Authorization = "Bearer portarium-dev-token" }
```

### Cockpit integration

Cockpit live web uses a same-origin, server-mediated HttpOnly session cookie.
Do not seed bearer tokens into Vite env, `localStorage`, or `sessionStorage`
for live web QA. Keep `PORTARIUM_DEV_TOKEN` on the control-plane server only,
then start Cockpit against the live API. `npm run cockpit:dev` serves the stable
local URL `http://cockpit.localhost:1355`; because that is cross-origin from
`http://localhost:8080`, the control plane must include it in
`PORTARIUM_CORS_ALLOWED_ORIGINS` unless you are using a same-origin reverse
proxy.

```bash
VITE_PORTARIUM_API_BASE_URL=http://localhost:8080 VITE_PORTARIUM_ENABLE_MSW=false npm run cockpit:dev
```

```powershell
$env:VITE_PORTARIUM_API_BASE_URL = "http://localhost:8080"
$env:VITE_PORTARIUM_ENABLE_MSW = "false"
npm run cockpit:dev
```

By default, Cockpit enables MSW in Vite dev mode. Set
`VITE_PORTARIUM_ENABLE_MSW=false` for live API manual QA. If OIDC is not
configured, the login page's **Continue** button requests `/auth/dev-session`;
the server exchanges its own `PORTARIUM_DEV_TOKEN` for the web session cookie
without exposing the token to browser JavaScript.

`VITE_DEMO_MODE=true` does not override `VITE_PORTARIUM_ENABLE_MSW=false`.
Fixture-backed policy simulation, pack runtime previews, and other demo-only
surfaces stay disabled whenever Cockpit is connected to live tenant data.

Live API QA uses live retention semantics: cached tenant payloads are disabled
by default, and switching between demo/MSW and live API modes should be treated
as a site-data boundary. Only set `VITE_PORTARIUM_ENABLE_LIVE_OFFLINE_CACHE=true`
when explicitly testing live offline retention behavior.

The live seed creates deterministic Cockpit records:

| Record       | Seeded ID        | Purpose                                     |
| ------------ | ---------------- | ------------------------------------------- |
| Workspace    | `ws-local-dev`   | Dev-auth tenant and Cockpit workspace       |
| User         | `user-local-dev` | Local admin/operator/approver/auditor actor |
| Pending gate | `apr-live-001`   | Approval decision smoke target              |
| Run          | `run-live-001`   | Waiting-for-approval governed run           |
| Work item    | `wi-live-001`    | Linked approval task                        |

Re-run `npm run dev:seed` after `npm run dev:db:reset`, then confirm with
`npm run seed:cockpit-live:validate`.

For OpenClaw approval-triage demo capture (mock dataset):

```powershell
npm run cockpit:dev:openclaw-demo
```

For automated OpenClaw demo videos (MP4 + WEBM artifacts):

```powershell
npm run cockpit:demo:openclaw:clips
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
- With `ENABLE_DEV_AUTH=true`, `PORTARIUM_DEV_TOKEN=portarium-dev-token`, and `PORTARIUM_DEV_WORKSPACE_ID=ws-local-dev`, `Authorization: Bearer portarium-dev-token` authenticates protected local routes

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

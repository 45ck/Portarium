# First-Run Guide: Local Real-Data Integrations

This guide walks you through standing up a full local integration stack — Keycloak
(OIDC/SSO), OpenFGA (fine-grained authorisation), Odoo sandbox (ERP/finance), and
OpenClaw (execution plane) — so you can run governed workflows against real data rather
than stub fixtures.

**Time to complete:** ~30 minutes on a developer laptop with Docker installed.

---

## Prerequisites

| Requirement                     | Version                                                                | Check                                                                  |
| ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Docker Desktop or Docker Engine | ≥ 24                                                                   | `docker --version`                                                     |
| Docker Compose                  | ≥ 2.20                                                                 | `docker compose version`                                               |
| Node.js                         | ≥ 22                                                                   | `node --version`                                                       |
| `npm`                           | ≥ 9                                                                    | `npm --version`                                                        |
| Free ports                      | 3000, 4000, 5432, 7233, 8080, 8081, 8180, 8181, 8182, 8200, 9000, 9001 | `lsof -i :3000,4000,5432,7233,8080,8081,8180,8181,8182,8200,9000,9001` |

Clone the repo and install dependencies before continuing:

```bash
git clone https://github.com/45ck/Portarium.git
cd Portarium
npm ci
```

---

## 1. Start the local stack

Portarium uses two compose files — `docker-compose.yml` (core infra: Postgres,
Temporal, MinIO, Vault, OTel) and `docker-compose.local.yml` (builds API + worker
from source) — combined with service profiles.

```bash
npm run dev:all
```

`npm run dev:all` is a scripted startup sequence, not a single compose command.
It starts the hardcoded profile set `baseline`, `runtime`, `auth`, `idp`,
`authz`, `erp`, and `tools`, then runs:

```bash
npm run dev:evidence-store:init
npm run dev:openfga:init
npm run dev:db:init -- --tenants ws-local-dev
```

After those init steps complete, it starts the same profile set plus `cockpit`
with `--build`.

Wait for all containers to report **healthy** (usually ~60 s on first run, ~10 s
subsequently). You can watch progress with:

```bash
docker compose \
  --profile baseline --profile runtime --profile auth --profile idp \
  --profile authz --profile erp --profile tools --profile cockpit \
  -f docker-compose.yml -f docker-compose.local.yml ps
```

Expected output once healthy (core infra):

```
NAME                      STATUS              PORTS
portarium-evidence-db     running (healthy)   0.0.0.0:5432->5432/tcp
portarium-temporal        running (healthy)   0.0.0.0:7233->7233/tcp
portarium-evidence-store  running (healthy)   0.0.0.0:9000->9000/tcp
portarium-vault           running             0.0.0.0:8200->8200/tcp
portarium-api             running (healthy)   0.0.0.0:8080->8080/tcp
portarium-worker          running (healthy)   0.0.0.0:8081->8081/tcp
```

> **Dev-auth bypass:** When `NODE_ENV=development`, the API accepts the static token
> `portarium-dev-token` as a bearer token. You can test the API immediately without
> Keycloak:
>
> ```bash
> curl -s http://localhost:8080/healthz
> ```

Seed canonical demo data into the running stack:

```bash
npm run dev:seed
```

Keycloak, OpenFGA, and Odoo are part of the default `dev:all` local stack.
OpenFGA store/model initialization and local DB initialization are also part of
`dev:all`; `npm run dev:seed` only seeds canonical demo and Cockpit data.

---

## 2. Keycloak — OIDC / SSO

**URL:** `http://localhost:8180`
**Admin console:** `http://localhost:8180/admin` (admin / admin)

### What the realm import configures

- Realm: `portarium`
- Client: `portarium-cockpit` (public, PKCE enabled)
- Roles: `approver`, `operator`, `auditor`
- Demo users:

| Username | Email                 | Password | Role       |
| -------- | --------------------- | -------- | ---------- |
| `alice`  | `alice@portarium.dev` | `alice`  | `approver` |
| `bob`    | `bob@portarium.dev`   | `bob`    | `operator` |
| `carol`  | `carol@portarium.dev` | `carol`  | `auditor`  |

### Troubleshooting

- **"Realm not found"** — seed migration has not run yet; wait 10 s and retry.
- **Container not healthy** — check logs with `docker logs <keycloak-container-name>`

---

## 3. OpenFGA — Fine-Grained Authorisation

**HTTP API:** `http://localhost:8181`
**Playground:** `http://localhost:3000`
**gRPC:** `localhost:8182`

`npm run dev:all` runs `dev:openfga:init`, which creates the `portarium` store
and loads the workspace-role authorization model. Demo role tuples are separate:

```bash
npm run dev:seed:openfga
```

The tuple seed defaults to workspace `ws-demo` and writes:

- `user:alice` as `approver`
- `user:bob` as `operator`
- `user:carol` as `auditor`

### Troubleshooting

- **No stores returned** — run `npm run dev:seed:openfga` to re-seed.
- **Check returns `false`** — tuples may not have been applied; re-seed and retry.

---

## 4. Odoo Sandbox — ERP / Finance

**URL:** `http://localhost:4000`
**Login:** `admin` / `admin`

The Odoo container runs a minimal community edition with the `account` and
`project` modules enabled, providing the GL, AR/AP, and invoice lifecycle surfaces
that the FinanceAccounting port family exercises.

### Verify

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/web/health
# Expected: 200
```

### Useful Odoo endpoints

| Path                                               | Description       |
| -------------------------------------------------- | ----------------- |
| `/web#action=account.action_move_journal_line`     | Journal entries   |
| `/web#action=account.action_account_invoice_tree1` | Customer invoices |
| `/web#action=account.action_account_payable_tree`  | Vendor bills      |

### Troubleshooting

- **First boot is slow** (~3–5 min) — Odoo compiles assets on first run.
- **Module not found** — run `npm run dev:seed:odoo` to install the required modules.

---

## 5. OpenClaw — Execution Plane

**URL:** `http://localhost:8080/claw` (proxied via the Portarium API on port 8080)

OpenClaw is the action-runner service that receives `dispatchAction` calls from the
application layer and executes governed steps (shell, HTTP, Terraform, etc.).

### Verify

```bash
curl -s http://localhost:8080/healthz | jq .status
# Expected: "ok"
```

```bash
curl -s http://localhost:8080/claw/health | jq .status
# Expected: "ok"
```

### Run the governed-run integration smoke

With the full stack healthy and seeded, run the smoke tests in integration mode:

```bash
GOVERNED_RUN_INTEGRATION=true LOCAL_STACK_URL=http://localhost:8080 \
  npm run test -- src/infrastructure/adapters/governed-run-smoke.test.ts
```

Or use the one-command pipeline (boots stack, seeds, then runs integration smoke):

```bash
npm run smoke:stack
```

All integration tests (previously skipped in unit mode) will execute against the live
local stack and must pass.

---

## 6. Environment variables reference

Copy `.env.local.example` to `.env.local` and adjust if you changed any default ports:

```bash
cp .env.local.example .env.local
```

| Variable                     | Default                 | Description                        |
| ---------------------------- | ----------------------- | ---------------------------------- |
| `LOCAL_STACK_URL`            | `http://localhost:8080` | Portarium API base URL             |
| `ENABLE_DEV_AUTH`            | `true`                  | Explicit dev-token auth gate       |
| `PORTARIUM_DEV_TOKEN`        | `portarium-dev-token`   | Static bearer token (dev only)     |
| `PORTARIUM_DEV_WORKSPACE_ID` | `ws-local-dev`          | Workspace ID injected by dev token |
| `KEYCLOAK_URL`               | `http://localhost:8180` | Keycloak base URL                  |
| `KEYCLOAK_REALM`             | `portarium`             | Realm name                         |
| `OPENFGA_URL`                | `http://localhost:8181` | OpenFGA HTTP API base URL          |
| `ODOO_URL`                   | `http://localhost:4000` | Odoo base URL                      |
| `GOVERNED_RUN_INTEGRATION`   | `false`                 | Set `true` for integration smoke   |

---

## 7. Stopping and resetting

**Stop (preserve data):**

```bash
docker compose \
  --profile baseline --profile runtime --profile auth --profile idp \
  --profile authz --profile erp --profile tools --profile cockpit \
  -f docker-compose.yml -f docker-compose.local.yml stop
```

**Stop and remove volumes (clean slate):**

```bash
docker compose \
  --profile baseline --profile runtime --profile auth --profile idp \
  --profile authz --profile erp --profile tools --profile cockpit \
  -f docker-compose.yml -f docker-compose.local.yml down -v
```

**Re-seed all services:**

```bash
npm run dev:seed
```

---

## 8. Next steps

- **Run a governed workflow end-to-end:** See [Start-to-Finish Execution Order](./start-to-finish-execution-order.md).
- **Explore the Cockpit UI:** Open `http://cockpit.localhost:1355` in a browser and log in as `alice`.
- **Write an integration adapter:** See [Generate Integration Scaffolds](./generate-integration-scaffolds.md).
- **Run the full CI gate suite:** `npm run ci:pr`

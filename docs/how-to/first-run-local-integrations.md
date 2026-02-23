# First-Run Guide: Local Real-Data Integrations

This guide walks you through standing up a full local integration stack — Keycloak
(OIDC/SSO), OpenFGA (fine-grained authorisation), Odoo sandbox (ERP/finance), and
OpenClaw (execution plane) — so you can run governed workflows against real data rather
than stub fixtures.

**Time to complete:** ~30 minutes on a developer laptop with Docker installed.

---

## Prerequisites

| Requirement                     | Version                      | Check                               |
| ------------------------------- | ---------------------------- | ----------------------------------- |
| Docker Desktop or Docker Engine | ≥ 24                         | `docker --version`                  |
| Docker Compose                  | ≥ 2.20                       | `docker compose version`            |
| Node.js                         | ≥ 22                         | `node --version`                    |
| `npm`                           | ≥ 9                          | `npm --version`                     |
| Free ports                      | 5432, 7233, 8080, 8888, 4000 | `lsof -i :5432,7233,8080,8888,4000` |

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

This is equivalent to:

```bash
docker compose \
  --profile baseline --profile runtime --profile auth --profile cockpit \
  -f docker-compose.yml -f docker-compose.local.yml up --wait
```

Wait for all containers to report **healthy** (usually ~60 s on first run, ~10 s
subsequently). You can watch progress with:

```bash
docker compose \
  --profile baseline --profile runtime --profile auth --profile cockpit \
  -f docker-compose.yml -f docker-compose.local.yml ps
```

Expected output once healthy (core infra):

```
NAME                      STATUS              PORTS
portarium-evidence-db     running (healthy)   0.0.0.0:5432->5432/tcp
portarium-temporal        running             0.0.0.0:7233->7233/tcp
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

> **Integration services (Keycloak, OpenFGA, Odoo, OpenClaw):** Sections 2–5 describe
> these optional services. They are not part of the base `dev:all` command. Bring them
> up separately when doing real-data integration testing.

---

## 2. Keycloak — OIDC / SSO

**URL:** `http://localhost:8080` (separate Keycloak container — port conflicts with
the Portarium API in the default local stack; adjust the Portarium API port or run
Keycloak on a different port as needed)
**Admin console:** `http://localhost:8080/admin` (admin / admin)

### What the seed configures

- Realm: `portarium`
- Client: `portarium-api` (confidential, PKCE enabled)
- Client: `portarium-cockpit` (public, PKCE enabled)
- Roles: `approver`, `operator`, `auditor`, `admin`
- Demo users (password = `password` for all):

| Username                 | Roles                  |
| ------------------------ | ---------------------- |
| `alice@acme.example.com` | `approver`, `operator` |
| `bob@acme.example.com`   | `operator`             |
| `carol@acme.example.com` | `auditor`              |
| `admin@acme.example.com` | `admin`                |

### Verify

```bash
curl -s -X POST http://localhost:8080/realms/portarium/protocol/openid-connect/token \
  -d 'grant_type=password' \
  -d 'client_id=portarium-api' \
  -d 'username=alice@acme.example.com' \
  -d 'password=password' | jq .access_token
```

A non-null JWT string confirms Keycloak is up and the realm is seeded.

### Troubleshooting

- **"Realm not found"** — seed migration has not run yet; wait 10 s and retry.
- **Container not healthy** — check logs with `docker logs <keycloak-container-name>`

---

## 3. OpenFGA — Fine-Grained Authorisation

**URL:** `http://localhost:8888`
**Playground:** `http://localhost:8888/playground`

### What the seed configures

- Store: `portarium-local`
- Authorization model: Portarium RBAC (workspace → run → approval chains)
- Initial tuples:
  - `alice@acme.example.com` is `approver` in `workspace:ws-demo`
  - `bob@acme.example.com` is `operator` in `workspace:ws-demo`

### Verify

```bash
curl -s http://localhost:8888/stores | jq '.[0].name'
# Expected: "portarium-local"
```

```bash
curl -s -X POST http://localhost:8888/stores/<STORE_ID>/check \
  -H 'Content-Type: application/json' \
  -d '{
    "tuple_key": {
      "user": "user:alice@acme.example.com",
      "relation": "approver",
      "object": "workspace:ws-demo"
    }
  }' | jq .allowed
# Expected: true
```

Replace `<STORE_ID>` with the value from the `/stores` response.

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

| Variable                   | Default                 | Description                            |
| -------------------------- | ----------------------- | -------------------------------------- |
| `LOCAL_STACK_URL`          | `http://localhost:8080` | Portarium API base URL                 |
| `PORTARIUM_DEV_TOKEN`      | `portarium-dev-token`   | Static bearer token (dev only)         |
| `KEYCLOAK_URL`             | `http://localhost:8080` | Keycloak base URL (separate container) |
| `KEYCLOAK_REALM`           | `portarium`             | Realm name                             |
| `OPENFGA_URL`              | `http://localhost:8888` | OpenFGA base URL                       |
| `ODOO_URL`                 | `http://localhost:4000` | Odoo base URL                          |
| `GOVERNED_RUN_INTEGRATION` | `false`                 | Set `true` for integration smoke       |

---

## 7. Stopping and resetting

**Stop (preserve data):**

```bash
docker compose \
  --profile baseline --profile runtime --profile auth --profile cockpit \
  -f docker-compose.yml -f docker-compose.local.yml stop
```

**Stop and remove volumes (clean slate):**

```bash
docker compose \
  --profile baseline --profile runtime --profile auth --profile cockpit \
  -f docker-compose.yml -f docker-compose.local.yml down -v
```

**Re-seed all services:**

```bash
npm run dev:seed
```

---

## 8. Next steps

- **Run a governed workflow end-to-end:** See [Start-to-Finish Execution Order](./start-to-finish-execution-order.md).
- **Explore the Cockpit UI:** Open `http://localhost:8080` in a browser and log in as `alice@acme.example.com`.
- **Write an integration adapter:** See [Generate Integration Scaffolds](./generate-integration-scaffolds.md).
- **Run the full CI gate suite:** `npm run ci:pr`

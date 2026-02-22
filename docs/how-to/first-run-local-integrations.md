# First-Run Guide: Local Real-Data Integrations

This guide walks you through standing up a full local integration stack — Keycloak
(OIDC/SSO), OpenFGA (fine-grained authorisation), Odoo sandbox (ERP/finance), and
OpenClaw (execution plane) — so you can run governed workflows against real data rather
than stub fixtures.

**Time to complete:** ~30 minutes on a developer laptop with Docker installed.

---

## Prerequisites

| Requirement                     | Version                | Check                          |
| ------------------------------- | ---------------------- | ------------------------------ |
| Docker Desktop or Docker Engine | ≥ 24                   | `docker --version`             |
| Docker Compose                  | ≥ 2.20                 | `docker compose version`       |
| Node.js                         | ≥ 18                   | `node --version`               |
| `npm`                           | ≥ 9                    | `npm --version`                |
| Free ports                      | 3000, 8080, 8888, 4000 | `lsof -i :3000,8080,8888,4000` |

Clone the repo and install dependencies before continuing:

```bash
git clone https://github.com/45ck/Portarium.git
cd Portarium
npm ci
```

---

## 1. Start the local stack

Portarium ships a `docker-compose.local.yml` that wires all four services together
with shared networking, seed data volumes, and health-check dependencies.

```bash
npm run dev:all
```

This is equivalent to:

```bash
docker compose -f docker-compose.local.yml up --wait
```

Wait for all containers to report **healthy** (usually ~60 s on first run, ~10 s
subsequently). You can watch progress with:

```bash
docker compose -f docker-compose.local.yml ps
```

Expected output once healthy:

```
NAME                    STATUS          PORTS
portarium-keycloak      running (healthy)  0.0.0.0:8080->8080/tcp
portarium-openfga       running (healthy)  0.0.0.0:8888->8888/tcp
portarium-odoo          running (healthy)  0.0.0.0:4000->8069/tcp
portarium-api           running (healthy)  0.0.0.0:3000->3000/tcp
```

---

## 2. Keycloak — OIDC / SSO

**URL:** `http://localhost:8080`
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
- **Container not healthy** — `docker compose -f docker-compose.local.yml logs keycloak`

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

**URL:** `http://localhost:3000/claw` (proxied via the Portarium API)

OpenClaw is the action-runner service that receives `dispatchAction` calls from the
application layer and executes governed steps (shell, HTTP, Terraform, etc.).

### Verify

```bash
curl -s http://localhost:3000/health | jq .status
# Expected: "ok"
```

```bash
curl -s http://localhost:3000/claw/health | jq .status
# Expected: "ok"
```

### Run the governed-run integration smoke

With the full stack healthy, run the smoke tests in integration mode:

```bash
GOVERNED_RUN_INTEGRATION=true npm run test -- \
  src/infrastructure/adapters/governed-run-smoke.test.ts
```

All integration tests (previously skipped in unit mode) will execute against the live
local stack and must pass.

---

## 6. Environment variables reference

Copy `.env.local.example` to `.env.local` and adjust if you changed any default ports:

```bash
cp .env.local.example .env.local
```

| Variable                   | Default                 | Description                      |
| -------------------------- | ----------------------- | -------------------------------- |
| `LOCAL_STACK_URL`          | `http://localhost:3000` | Portarium API base URL           |
| `KEYCLOAK_URL`             | `http://localhost:8080` | Keycloak base URL                |
| `KEYCLOAK_REALM`           | `portarium`             | Realm name                       |
| `OPENFGA_URL`              | `http://localhost:8888` | OpenFGA base URL                 |
| `ODOO_URL`                 | `http://localhost:4000` | Odoo base URL                    |
| `GOVERNED_RUN_INTEGRATION` | `false`                 | Set `true` for integration smoke |

---

## 7. Stopping and resetting

**Stop (preserve data):**

```bash
docker compose -f docker-compose.local.yml stop
```

**Stop and remove volumes (clean slate):**

```bash
docker compose -f docker-compose.local.yml down -v
```

**Re-seed all services:**

```bash
npm run dev:seed
```

---

## 8. Next steps

- **Run a governed workflow end-to-end:** See [Start-to-Finish Execution Order](./start-to-finish-execution-order.md).
- **Explore the Cockpit UI:** Open `http://localhost:3000` in a browser and log in as `alice@acme.example.com`.
- **Write an integration adapter:** See [Generate Integration Scaffolds](./generate-integration-scaffolds.md).
- **Run the full CI gate suite:** `npm run ci:pr`

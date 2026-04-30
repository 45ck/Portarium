# Local Scenario Matrix

Per-scenario prerequisites, exact commands, expected outputs, verification checks, and troubleshooting for the integration test suite.

## Prerequisites (all scenarios)

1. Docker Desktop running with `docker compose` v2 available.
2. Node.js 20+ with `npm` available.
3. Dependencies installed: `npm install` from repo root.
4. Integration harness ready (brings up services and seeds data):

```bash
npm run integration:harness
```

See [integration-harness.md](./integration-harness.md) for auth profiles, seed modes, and environment variables.

## Running Scenarios

All scenario tests live under `scripts/integration/` and run via Vitest:

```bash
# Run all scenarios
npx vitest run scripts/integration/

# Run a single scenario
npx vitest run scripts/integration/scenario-openclaw-dispatch.test.ts

# Watch mode (re-runs on change)
npx vitest watch scripts/integration/scenario-openclaw-dispatch.test.ts
```

Scenarios use deterministic stub servers (no live services required for the test process itself). The harness is needed only when running against real containers.

---

## Scenario 1: OpenClaw Machine Dispatch

**File:** `scripts/integration/scenario-openclaw-dispatch.test.ts`
**Bead:** bead-0844

### What it tests

Full dispatch path from Run creation through Machine invocation to Evidence chain verification. Uses a stub HTTP gateway.

### Prerequisites

- Harness profile: `dev-token` (default)
- Seed mode: `baseline` (default)
- No additional services required (uses in-process HTTP stub)

### Command

```bash
npx vitest run scripts/integration/scenario-openclaw-dispatch.test.ts
```

### Steps and expected output

| Step | Description                            | Key assertions                                                                                                                                                         |
| ---- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Run creation dispatches machine action | Gateway receives POST `/v1/responses` with `model: openclaw:<agentId>`, correlation envelope (`tenantId`, `runId`, `actionId`, `correlationId`) propagated in metadata |
| 2    | Run state transitions                  | Successful gateway response maps to `ok: true` (Succeeded); 429 retries with backoff; 500 after max retries maps to `RemoteError` (Failed)                             |
| 3    | Evidence chain                         | Dispatch entry (category: `Action`) and completion entry (category: `System`) recorded with matching `correlationId`; hash chain links entries via `previousHash`      |
| 4    | API markers                            | Gateway request includes `Authorization: Bearer <token>`, `model` and `input` fields in body; missing token returns `Unauthorized` without contacting gateway          |
| 5    | Policy tier enforcement                | `shell.exec` at Auto tier blocked with `PolicyDenied` before HTTP dispatch; `read:file` at Auto tier dispatches to gateway with session key header                     |

### Verification checklist

- [ ] 11 tests pass
- [ ] No gateway requests for policy-blocked or unauthorized calls
- [ ] Evidence entries carry correct `correlationId` and hash chain

---

## Scenario 2: HumanApprove Pause/Resume

**File:** `scripts/integration/scenario-human-approve.test.ts`
**Bead:** bead-0846

### What it tests

Full Approval Gate lifecycle: Run pauses at HumanApprove tier, MakerChecker SoD constraint rejects the maker, an authorized (distinct) approver resolves the gate, and the Evidence Log records the full audit trail.

### Prerequisites

- Harness profile: `dev-token` (default)
- Seed mode: `baseline` (default)
- No additional services required (uses in-process stubs)

### Command

```bash
npx vitest run scripts/integration/scenario-human-approve.test.ts
```

### Steps and expected output

| Step | Description                       | Key assertions                                                                                                                                                  |
| ---- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Run pauses at Approval Gate       | Approval status is `Pending`; linked to Run and Plan                                                                                                            |
| 2    | MakerChecker rejects maker        | `submitApproval` returns `Forbidden` with `SoD violation: MakerChecker` when maker tries to approve or deny their own request                                   |
| 3    | Authorized approver resolves gate | Distinct approver can `Approved`, `Denied`, or `RequestChanges`; approval persisted with `decidedByUserId`; `ApprovalGranted` domain event published            |
| 4    | Evidence chain                    | Three entries: approval-requested, approval-resolved, run-completed; categories `Approval`, `Approval`, `System`; consistent `correlationId`; hash chain intact |
| 5    | Domain event audit markers        | `ApprovalGranted` event includes workspace and correlation context; `ApprovalDenied` event emitted for denial decisions                                         |

### Verification checklist

- [ ] 10 tests pass
- [ ] MakerChecker enforced for both approve and deny decisions
- [ ] Evidence hash chain links all three entries sequentially

---

## Scenario 3: Odoo FinanceAccounting

**File:** `scripts/integration/scenario-odoo-finance.test.ts`
**Bead:** bead-0845

### What it tests

FinanceAccounting adapter path through a Run step abstraction, using a deterministic JSON-RPC stub as the Odoo backend. Verifies seeded data expectations, evidence logging, diagnostics, and transport negotiation.

### Prerequisites

- Harness profile: `dev-token` (default)
- Seed mode: `odoo` (for real Odoo, or stub-only for tests)
- For stub-only tests: no additional services required

```bash
# If running against real Odoo:
npm run integration:harness -- --seed odoo
```

### Command

```bash
npx vitest run scripts/integration/scenario-odoo-finance.test.ts
```

### Steps and expected output

| Step | Description                    | Key assertions                                                                                                                                                                                                                              |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | FinanceAccounting via Run step | `listAccounts` returns 3 seeded accounts; `listInvoices` returns 2 seeded invoices; `listVendors` returns 2 seeded vendors                                                                                                                  |
| 2    | Seeded data assertions         | Accounts match chart-of-accounts structure (Cash/101000/asset, Accounts Receivable/120000/asset, Revenue/400000/revenue); invoices reflect payment states (paid USD 2500, draft EUR 750); vendors include contact details and `vendor` role |
| 3    | Evidence metadata              | Evidence entry includes `adapterId`, operation name, correlation ID; hash chain links sequential Run steps; failed operations record error details in summary                                                                               |
| 4    | Diagnostics                    | Network failure produces `provider_error` with `ECONNREFUSED`; JSON-RPC error surfaces `Access denied` detail; HTTP 502 from proxy produces clear diagnostic                                                                                |
| 5    | Transport verification         | JSON-RPC authenticates then calls `search_read` for `account.account`; session caching avoids re-authentication on sequential operations (1 auth + 2 data = 3 calls); `createJournalEntry` calls `create` on `account.move`                 |

### Verification checklist

- [ ] 14 tests pass
- [ ] Seeded data matches expected canonical model mappings
- [ ] Evidence entries link to Run with correct `adapterId`

---

## Scenario 4: Auth Negative-Path

**File:** `scripts/integration/scenario-auth-negative-path.test.ts`
**Bead:** bead-0847

### What it tests

Authentication and authorization enforcement across Control Plane endpoints. Validates both `dev-token` and `oidc` auth profiles through configurable stubs. Exercises the negative-path matrix: missing token, invalid/expired token, insufficient role/scope, workspace scope mismatch.

### Prerequisites

- Harness profile: both `dev-token` and `oidc` profiles tested via stubs
- Seed mode: `baseline` (default)
- No additional services required (uses in-process HTTP server stubs)

### Command

```bash
npx vitest run scripts/integration/scenario-auth-negative-path.test.ts
```

### Steps and expected output

| Step | Acceptance Criteria                 | Key assertions                                                                                                                                                                                                                                                                                                                 |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-1 | Missing token returns 401           | ProblemDetails envelope with `type: *unauthorized`, `title: Unauthorized`, `status: 401`; `content-type: application/problem+json`; `x-correlation-id` echoed; `traceparent` header present; audit `logUnauthorized` emitted. Tested across 4 endpoints (GET workspace, GET run, POST machine heartbeat, POST agent heartbeat) |
| AC-2 | Invalid/expired token returns 401   | Expired JWT: detail contains "expired"; invalid signature: detail contains "signature"; dev-token malformed: detail contains "dev-token"                                                                                                                                                                                       |
| AC-3 | Insufficient role/scope returns 403 | No roles: 403 for agent work-items; authorization port denies: 403 even with admin role; ProblemDetails with `type: *forbidden`, `title: Forbidden`                                                                                                                                                                            |
| AC-4 | Workspace scope mismatch rejected   | Token for workspace-A accessing workspace-B: 401 at auth boundary; cross-workspace Run access: 401; cross-workspace machine heartbeat (lenient auth): 403 post-auth                                                                                                                                                            |
| AC-5 | Both profiles consistent            | dev-token missing and OIDC missing produce identical ProblemDetails shape; valid tokens from both profiles reach same downstream 404 for missing Workspace                                                                                                                                                                     |
| AC-6 | Audit-log markers                   | 401 emits `auth.unauthorized` with `correlationId`; 403 emits `auth.forbidden` with `workspaceId`; no token content leaked in audit logs; multiple denials emit separate markers                                                                                                                                               |
| AC-7 | Response headers                    | 401/403 responses include `traceparent`, `x-correlation-id`, `content-type: application/problem+json`                                                                                                                                                                                                                          |

### Verification checklist

- [ ] 16 tests pass
- [ ] ProblemDetails envelope shape consistent across auth profiles
- [ ] No token content leaked in audit log entries

---

## Scenario 5: Policy Bypass Attempts

**File:** `scripts/integration/scenario-policy-bypass.test.ts`
**Bead:** bead-0848

### What it tests

Policy enforcement for attempts to bypass governed execution flow. Validates two enforcement layers: client-side (pre-dispatch tool classification) and server-side (gateway HTTP 409). Includes regression guards for tool blast-radius classification.

### Prerequisites

- Harness profile: `dev-token` (default)
- Seed mode: `baseline` (default)
- No additional services required (uses in-process stub gateway)

### Command

```bash
npx vitest run scripts/integration/scenario-policy-bypass.test.ts
```

### Steps and expected output

| Step       | Acceptance Criteria                       | Key assertions                                                                                                                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-A1..A4  | Non-allowlisted tools denied pre-dispatch | `shell.exec` at Auto: `PolicyDenied`, message contains tool name + `ManualOnly`; `browser.navigate` at Assisted: denied (Dangerous); `write:file` at Auto: denied, message contains `HumanApprove`; unknown `custom.mystery-tool` at Auto: denied. Gateway receives zero requests for all                                                    |
| AC-A5      | Gateway 409 maps to PolicyDenied          | `read:config` passes client policy, gateway returns 409 with ProblemDetails, result `errorKind: PolicyDenied`                                                                                                                                                                                                                                |
| AC-B1..B3  | Evidence for denials                      | Each denial produces evidence entry with `correlationId` and links to `runId`; gateway 409 denial also recorded; multiple denied tools produce separate evidence entries with hash chain                                                                                                                                                     |
| RG-1..RG-6 | Regression guards                         | `shell.exec` classified as `Dangerous`/`ManualOnly`; denied at Auto, Assisted, HumanApprove; allowed at ManualOnly; mutation tools (`write:*`, `create:*`, `delete:*`, `send:*`, `deploy.*`) denied at Auto; read-only tools (`read:*`, `list:*`, `search:*`, `query:*`) allowed at Auto; all dangerous-pattern tools denied at HumanApprove |
| EC-1..EC-2 | Error contract shape                      | Client-side denial includes `runState: PolicyBlocked` and descriptive message with tool name, current tier, and required tier; gateway 409 denial has `runState: undefined`                                                                                                                                                                  |

### Verification checklist

- [ ] 16 tests pass
- [ ] Gateway receives zero requests for all client-side denials
- [ ] Regression guards prevent accidental tool allowlisting

---

## Comparison Matrix

| Scenario           | Auth Profile | Seed Mode   | Components                                        | Stub Type              | Test Count | Key Concern                                      |
| ------------------ | ------------ | ----------- | ------------------------------------------------- | ---------------------- | ---------- | ------------------------------------------------ |
| OpenClaw Dispatch  | dev-token    | baseline    | OpenClaw gateway invoker, Evidence Log            | HTTP stub server       | 11         | Machine dispatch, correlation, retry, policy     |
| HumanApprove       | dev-token    | baseline    | Approval Store, Evidence Log, Event Publisher     | In-memory stubs        | 10         | SoD enforcement, approval lifecycle, audit       |
| Odoo Finance       | dev-token    | odoo (stub) | Odoo adapter, Evidence Log, JSON-RPC stub         | HTTP JSON-RPC stub     | 14         | Adapter integration, seeded data, diagnostics    |
| Auth Negative-Path | both         | baseline    | Control Plane handler, Auth ports, Audit logger   | In-process HTTP server | 16         | 401/403 contracts, ProblemDetails, audit markers |
| Policy Bypass      | dev-token    | baseline    | Machine invoker, Tool policy engine, Evidence Log | HTTP stub server       | 16         | Policy enforcement, blast radius, regression     |

---

## Troubleshooting

### Token failures

| Symptom                                                               | Cause                                                                 | Fix                                                                                                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Unauthorized: Missing bearer token`                                  | No `Authorization` header sent                                        | Enable dev-token auth with `ENABLE_DEV_AUTH=true`, `PORTARIUM_DEV_TOKEN`, and `PORTARIUM_DEV_WORKSPACE_ID`, or pass `--auth oidc` and obtain a JWT |
| `Unauthorized: Invalid dev-token format`                              | Token value does not match expected format or dev auth is not enabled | Check `ENABLE_DEV_AUTH=true` and that `PORTARIUM_DEV_TOKEN` matches value in `docker-compose.local.yml`                                            |
| `Unauthorized: Token expired`                                         | OIDC JWT `exp` claim is in the past                                   | Obtain a fresh token from Keycloak; check host/container clock sync                                                                                |
| `Unauthorized: JWT signature verification failed`                     | JWKS keys do not match token issuer                                   | Verify `infra/keycloak/realm-portarium.json` is mounted; restart Keycloak                                                                          |
| Startup fails with `PORTARIUM_JWT_ISSUER` or `PORTARIUM_JWT_AUDIENCE` | JWKS auth is configured without required issuer/audience validation   | Set `PORTARIUM_JWKS_URI`, `PORTARIUM_JWT_ISSUER`, and `PORTARIUM_JWT_AUDIENCE` as a set                                                            |
| `Unauthorized: Token workspace does not match`                        | Token scoped to workspace-A, request targets workspace-B              | Obtain a token for the correct Workspace or use dev-token mode                                                                                     |

### OpenFGA / authorization failures

| Symptom                                    | Cause                                            | Fix                                                                          |
| ------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `Forbidden: SoD violation: MakerChecker`   | Same user attempting to both request and approve | Use a distinct user (different `userId`) for the approval decision           |
| `Forbidden: Authorization denied`          | `AuthorizationPort.isAllowed` returned false     | Check RBAC role assignments for the principal; verify Workspace membership   |
| `403` on agent work-items with valid token | Token has no roles or insufficient roles         | Ensure token claims include required roles (`admin`, `operator`, `approver`) |

### Odoo failures

| Symptom                                          | Cause                                                   | Fix                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `provider_error: ECONNREFUSED`                   | Odoo container not running or wrong port                | `docker compose logs portarium-odoo`; verify `ODOO_URL` (default: `http://localhost:4000`) |
| `provider_error: Access denied: account.account` | Wrong Odoo credentials or insufficient permissions      | Check `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD` env vars                                     |
| `provider_error: 502`                            | Reverse proxy or network issue between harness and Odoo | Check container networking; restart Odoo: `docker compose restart portarium-odoo`          |
| `validation_error` on `getAccount`               | Missing required `accountId` parameter                  | Provide required parameters for single-entity operations                                   |
| Odoo health check not passing                    | Odoo needs 60-120s to initialize on first start         | Wait and retry: `npm run integration:harness -- --check-only`                              |

### Worker / machine dispatch failures

| Symptom                             | Cause                                                  | Fix                                                                           |
| ----------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `Unauthorized` from machine invoker | `resolveBearerToken` returned `undefined`              | Check Credential Vaulting configuration for the Machine                       |
| `RemoteError` after retries         | Gateway returned 500 on all attempts                   | Check gateway logs; verify gateway URL in adapter config                      |
| `PolicyDenied: shell.exec`          | Tool classified as Dangerous, requires ManualOnly tier | Use `read:*` tools for Auto tier, or escalate to ManualOnly for shell access  |
| `PolicyBlocked` run state           | Client-side policy denied tool before dispatch         | Review tool blast-radius classification in `openclaw-tool-blast-radius-v1.ts` |
| 429 rate limiting from gateway      | Too many requests in short window                      | Increase `retry.initialBackoffMs` or reduce request frequency                 |

### General test failures

| Symptom              | Cause                                      | Fix                                                                 |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| Port already in use  | Stub server cannot bind                    | Kill conflicting process: `netstat -an \| grep <port>`              |
| Test timeout         | Stub server or service not responding      | Increase Vitest timeout: `npx vitest run --timeout 30000 ...`       |
| `Cannot find module` | Missing dependency or broken junction link | `npm install` from repo root; recreate junction links for worktrees |
| Stale test results   | Vitest cache outdated                      | Clear cache: `npx vitest run --no-cache ...`                        |

---

## References

- [Integration Harness](./integration-harness.md) -- service bootstrap and readiness report
- [Glossary](./glossary.md) -- ubiquitous language (Run, Workspace, Approval Gate, Evidence Log, Machine, etc.)
- ADR-0070 -- Hybrid architecture boundary (orchestration + CloudEvents)
- ADR-0115 -- Agent egress enforcement model
- `src/domain/machines/openclaw-tool-blast-radius-v1.ts` -- tool blast-radius classification
- `src/application/commands/submit-approval.ts` -- approval lifecycle with SoD constraints

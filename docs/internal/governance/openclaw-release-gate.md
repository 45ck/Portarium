# OpenClaw Full Integration Release Gate

**Bead:** bead-0803
**Status:** accepted
**Reviewed:** 2026-02-23

This document is the production-readiness gate for the OpenClaw full integration
milestone. All six controls must be green before the integration is considered
shippable.

---

## Control 1 — Multi-Tenant Isolation (ADR-0072)

**Requirement:** Every command that produces workspace side-effects MUST verify
`workspaceId === ctx.tenantId` before executing. A mismatch MUST fail closed.

**Implementation:**

- Application commands (`deactivateMachine`, `syncAgentToGateway`,
  `registerMachine`, `createAgent`, `updateAgentCapabilities`) all carry an explicit
  `tenantId` check.
- Workspace Gateway deployments are scoped per workspace with no cross-workspace
  credential or network access (ADR-0072).
- Data-layer keys are composite `(tenantId, entityId)` to prevent row-level
  cross-tenant reads.

**Canonical test files:**

- `src/presentation/runtime/control-plane-handler.machine-agent.contract.test.ts`
  — cross-workspace rejection tests
- `.specify/specs/openclaw-gateway-workspace-isolation-v1.md`
  — isolation invariants spec

**Reference:** `docs/internal/adr/0072-openclaw-gateway-multi-tenant-isolation.md`

---

## Control 2 — Tool Blast-Radius Policy Gating

**Requirement:** Tools dispatched through OpenClaw MUST be classified (Dangerous /
Mutation / ReadOnly / Unknown) before invocation. The invocation execution tier MUST
meet the minimum required tier for the classification, or the call fails closed with
`PolicyBlocked` run state.

**Classification precedence:** Dangerous > Mutation > ReadOnly > Unknown

**Implementation:**

- `classifyOpenClawToolBlastRadiusV1(toolName)` in
  `src/domain/machines/openclaw-tool-blast-radius-v1.ts` returns the category and
  minimum required tier.
- `isOpenClawToolAllowedAtTierV1()` enforces the tier check before dispatch.
- Policy gating occurs inside `invokeTool()` in the gateway machine invoker before
  any HTTP call is made.

**Canonical test files:**

- `src/domain/machines/openclaw-tool-blast-radius-v1.test.ts`
- `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.test.ts`
  (policy-gating section)

**Reference:** `docs/internal/governance/openclaw-tool-blast-radius-policy.md`

---

## Control 3 — Credential and Token Handling (ADR-0099)

**Requirement:** Gateway bearer tokens MUST NOT be persisted to the database and
MUST NOT appear in any HTTP response exposed to browser clients. The `authConfig`
field MUST be stripped from all `GET` and `LIST` machine responses via
`toMachineApiView()`.

**Implementation:**

- Token is injected at startup from the credential store and held only in a private
  field of `OpenClawGatewayMachineInvoker`; it is never written to any DB column.
- `toMachineApiView()` in `src/presentation/ops-cockpit/types.machines.ts` omits
  `authConfig` from the API shape.
- All management bridge HTTP calls carry `Authorization: Bearer <token>` but the
  token is resolved per-call and never logged or serialised.

**Canonical test files:**

- `src/presentation/runtime/control-plane-handler.machine-agent.contract.test.ts`
  — authConfig stripping assertions
- `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.test.ts`
  — credential resolution tests

**Reference:** `docs/internal/adr/ADR-0099-openclaw-gateway-token-browser-exposure-prevention.md`

---

## Control 4 — Contract Test Coverage

**Requirement:** HTTP contract tests, integration tests, and domain unit tests covering
all six controls must exist and pass in `npm run ci:pr`.

**Canonical test files:**

| Test file                                                                          | Coverage                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.test.ts`             | Retry, backoff, timeout, failure mapping, policy gating, credential resolution |
| `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.integration.test.ts` | Stub-server integration (runAgent, invokeTool end-to-end)                      |
| `src/infrastructure/openclaw/openclaw-http-error-policy.contract.test.ts`          | HTTP error semantics contract                                                  |
| `src/infrastructure/openclaw/openclaw-management-bridge.test.ts`                   | Agent sync, deregister, status                                                 |
| `src/infrastructure/openclaw/openclaw-operator-management-bridge.test.ts`          | WebSocket operator bridge lifecycle                                            |
| `src/infrastructure/openclaw/openclaw-drift-sync-pipeline.test.ts`                 | Drift detection and soft-fail                                                  |
| `src/domain/machines/openclaw-tool-blast-radius-v1.test.ts`                        | Classification correctness for all tier categories                             |
| `src/domain/machines/openclaw-agent-binding-v1.test.ts`                            | Binding validation (identity, liveness, capability)                            |
| `src/presentation/runtime/control-plane-handler.machine-agent.contract.test.ts`    | HTTP API contracts including cross-workspace rejection and token stripping     |
| `src/infrastructure/adapters/openclaw-release-gate.test.ts`                        | Release gate artifact existence (this bead)                                    |

---

## Control 5 — Rollback Procedure

**Requirement:** A rollback runbook must exist and name specific rollback triggers.

**Rollback Triggers:**

1. Gateway bearer token is discovered in any HTTP response body or log line (ADR-0099 violation).
2. Cross-workspace data access detected (tenantId mismatch in live traffic or audit log).
3. A `PolicyBlocked` classification is not honoured and a Dangerous tool executes below ManualOnly tier.
4. Any test in the release gate contract test file fails on a production candidate build.
5. Drift sync pipeline emits consecutive failures without soft-fail containment for more than 5 minutes.

**Reference:** `docs/internal/governance/openclaw-rollback-runbook.md`

---

## Control 6 — Monitoring and Observability

**Requirement:** All gateway operations MUST emit structured logs with `tenantId`,
`runId`, and `correlationId`. Drift sync failures MUST surface as
`BridgeOperationResult` with a non-empty `reason` string rather than propagating
exceptions to callers.

**Implementation:**

- `OpenClawGatewayMachineInvoker.runAgent()` and `invokeTool()` include `correlationId`
  from the run context in request metadata and log structured errors on failure.
- `OpenClawManagementBridge` methods resolve to `BridgeOperationResult` on any HTTP
  error; callers receive `{ ok: false, reason: string }` — no uncaught throws.
- `openclaw-drift-sync-pipeline.ts` catches all pipeline errors and returns
  structured failure results.

**Canonical test files:**

- `src/infrastructure/openclaw/openclaw-drift-sync-pipeline.test.ts`
- `src/infrastructure/openclaw/openclaw-management-bridge.test.ts`

---

## Release Gate Criteria

All of the following must pass before the release is approved:

1. `npm run ci:pr` exits 0 on a clean checkout of the candidate commit.
2. `src/infrastructure/adapters/openclaw-release-gate.test.ts` passes with all
   artifact existence checks green.
3. `src/presentation/runtime/control-plane-handler.machine-agent.contract.test.ts`
   passes with cross-workspace rejection and authConfig-stripping tests green.
4. The rollback runbook at `docs/internal/governance/openclaw-rollback-runbook.md` exists and
   names all five rollback triggers listed under Control 5.
5. ADR-0072 and ADR-0099 status is `accepted` in their respective files.
6. No HIGH or CRITICAL severity vulnerabilities in production dependencies
   (`npm run audit:high` exits 0).

---

## Rollback Triggers

(Summary — full procedure in `docs/internal/governance/openclaw-rollback-runbook.md`)

| #   | Trigger                                                          | Severity                            |
| --- | ---------------------------------------------------------------- | ----------------------------------- |
| 1   | Token exposure in response or logs                               | Critical — immediate rollback       |
| 2   | Cross-workspace data access                                      | Critical — immediate rollback       |
| 3   | PolicyBlocked bypass (Dangerous tool runs below ManualOnly tier) | Critical — immediate rollback       |
| 4   | Release gate contract test failure on production candidate       | High — rollback unless hotfix < 2 h |
| 5   | Drift sync consecutive failures > 5 min without containment      | Medium — rollback if no fix < 1 h   |

---

## Required Artifacts

| Artifact                     | Path                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Gateway machine invoker      | `src/infrastructure/openclaw/openclaw-gateway-machine-invoker.ts`                  |
| Management bridge            | `src/infrastructure/openclaw/openclaw-management-bridge.ts`                        |
| Tool blast-radius classifier | `src/domain/machines/openclaw-tool-blast-radius-v1.ts`                             |
| Agent binding validator      | `src/domain/machines/openclaw-agent-binding-v1.ts`                                 |
| Drift sync pipeline          | `src/infrastructure/openclaw/openclaw-drift-sync-pipeline.ts`                      |
| HTTP error policy            | `src/infrastructure/openclaw/openclaw-http-error-policy.ts`                        |
| Operator management bridge   | `src/infrastructure/openclaw/openclaw-operator-management-bridge.ts`               |
| Workspace isolation spec     | `.specify/specs/openclaw-gateway-workspace-isolation-v1.md`                        |
| Machine invoker spec         | `.specify/specs/openclaw-gateway-machine-invoker-v1.md`                            |
| Tool invoke client spec      | `.specify/specs/openclaw-tools-invoke-client-v1.md`                                |
| Blast-radius policy spec     | `.specify/specs/openclaw-tool-blast-radius-policy-v1.md`                           |
| Blast-radius policy doc      | `docs/internal/governance/openclaw-tool-blast-radius-policy.md`                    |
| Provisioning runbook         | `docs/internal/governance/openclaw-workspace-gateway-provisioning-runbook.md`      |
| Rollback runbook             | `docs/internal/governance/openclaw-rollback-runbook.md`                            |
| ADR-0072                     | `docs/internal/adr/0072-openclaw-gateway-multi-tenant-isolation.md`                |
| ADR-0099                     | `docs/internal/adr/ADR-0099-openclaw-gateway-token-browser-exposure-prevention.md` |
| Release gate doc (this file) | `docs/internal/governance/openclaw-release-gate.md`                                |

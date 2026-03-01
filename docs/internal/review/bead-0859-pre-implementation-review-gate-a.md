# Review: bead-0859 (Pre-Implementation Architecture/Security/V&V Inspection — Gate A)

Reviewed on: 2026-03-02

Scope:

- Architecture boundary enforcement and layer contracts
- Security controls: identity, authorization, egress, credential boundary
- V&V infrastructure: test coverage gates, evidence integrity, fault injection, deterministic diagnostics

---

## 1. Architecture Review

### 1.1 Boundary Enforcement

Result: **PASS**

- `dependency-cruiser` (v17.3.8) scanned 939 modules and 3,108 dependency arcs — **zero violations**.
- `.dependency-cruiser.cjs` enforces six boundary rules:
  - `domain-no-infra`: domain must not import infrastructure or presentation.
  - `domain-no-application`: domain must not import application layer.
  - `application-no-presentation`: application must not import presentation.
  - `infrastructure-no-presentation`: infrastructure must not import presentation.
  - `no-circular`: no circular dependencies anywhere.
  - `no-src-to-test`: production code must not import test code.
- `npm run depcruise` is included in the `ci:pr` gate, enforcing boundaries on every PR.
- Domain layer (`src/domain/`) confirmed to have zero external-layer imports (grep for infrastructure/presentation imports returns empty).

### 1.2 Layer Inventory

- `src/domain/` — 30 subdirectories covering entities, value objects, events, primitives, policy, evidence, credentials, machines, approvals, etc.
- `src/application/` — commands, ports (57 port interfaces), services, IAM/RBAC, event orchestration, idempotency, integration tests.
- `src/infrastructure/` — adapters (OpenClaw gateway, evidence stores, fault injection, V&V), DB, external APIs.
- `src/presentation/` — control-plane HTTP handlers (Hono), ops-cockpit types, V&V contract tests, approval renderer registry.

### 1.3 Control-Plane Choke-Point Invariant (ADR-0073)

Result: **PASS**

- ADR-0073 mandates all external traffic routes through the control-plane API.
- Presentation layer confirms: `control-plane-handler.ts` applies authentication middleware (`authenticate()`) on all `/v1/workspaces/*` routes before any handler executes.
- Metrics endpoint (`/metrics`) is intentionally served before auth middleware (standard Prometheus pattern — no tenant data exposed).
- Agent egress enforcement (ADR-0115) adds a second enforcement layer: K8s NetworkPolicy deny-all + allow-list for control-plane only (`infra/kubernetes/base/agent-network-policy.yaml`).

### 1.4 Contracts

Result: **PASS**

- 57 port interfaces in `src/application/ports/` define typed contracts between application and infrastructure.
- Branded primitives (`TenantId`, `WorkspaceId`, `RunId`, `ActionId`, `CorrelationId`, `MachineId`, etc.) prevent cross-domain type mixing at compile time.
- `APP_ACTIONS` contract test (`src/application/common/actions.test.ts`) asserts all action strings are present, preventing silent action additions without test updates.
- Workspace RBAC matrix (`workspace-rbac.ts`) maps every action to allowed roles with a corresponding test.

### 1.5 Hybrid Architecture Boundary (ADR-0070)

Result: **PASS**

- Orchestration for run correctness (Temporal SDK integration, workflow state machine in domain).
- CloudEvents for external choreography (domain event-stream catalogue with versioned type strings).
- Event schema registry (`event-schema-registry-v1.ts`) provides consumer resilience with version fallback.

Findings: **none**.

---

## 2. Security Review

### 2.1 Identity Posture

Result: **PASS**

- JWT authentication enforced on all workspace routes via `authenticate()` middleware in `control-plane-handler.ts`.
- SPIFFE/SPIRE workload identity model implemented in domain (`src/domain/credentials/spiffe-identity-lifecycle-v1.ts`) with:
  - SPIFFE ID parsing and validation.
  - SVID lifecycle management (issuance, rotation, expiry).
  - Workspace-scoped identity binding (`isSpiffeIdInWorkspace`).
- ADR-0076 (SPIRE workload identity mTLS) formalizes the dual-layer identity model.
- ADR-0100 (JWT short-expiry revocation policy) governs token lifetime.
- ADR-0099 (OpenClaw gateway token browser exposure prevention) prevents credential leakage to client-side.

### 2.2 Authorization / RBAC

Result: **PASS**

- Workspace RBAC enforces role-based access for all actions including the new `tool:invoke` action.
- `ActionGatedToolInvoker` service (bead-0833) implements three-step gate: authorization check, blast-radius policy check, then execute.
- Blast-radius policy (`evaluateOpenClawToolPolicyV1`) classifies tools as ReadOnly/Mutation/Dangerous/Unknown with execution tier requirements (Auto/Assisted/HumanApprove/ManualOnly).
- Denied results include structured reason codes (`authorization` or `policy`) for audit trail.

### 2.3 Egress Controls

Result: **PASS**

- ADR-0115 (agent egress enforcement) defines mandatory no-direct-egress invariant.
- K8s NetworkPolicy manifests enforce deny-all egress by default for both agent and execution-plane workloads.
- Separate allow-list policies permit only control-plane egress for agents, and HTTPS-only SoR egress for execution-plane workers.
- Network policies include bypass-attempt tests (bead-0835/0836 work).

### 2.4 Bypass Controls

Result: **PASS**

- ADR-0073 three-layer enforcement model: identity/credential boundary, network/egress boundary, developer-ergonomics boundary.
- ADR-0074 (untrusted tool sandbox boundaries) constrains tool execution scope.
- ADR-0103 (DDS security defaults enforcement) ensures secure-by-default configuration.
- ADR-0104 (CI OIDC trust policy hardening) secures CI pipeline identity.

### 2.5 Threat Assumptions

Result: **PASS — documented and addressed**

- ADR-0115 explicitly documents threat model: compromised agent, credential theft, lateral movement, data exfiltration.
- Fail-closed behavior: if control-plane is unreachable, agents cannot execute (no fallback to direct calls).
- Evidence integrity: SHA-256 hash chain on all evidence entries (`evidence-chain-v1.ts`) with tamper-evident canonicalization.
- WORM (Write-Once Read-Many) evidence payload store implemented in both in-memory (testing) and S3 (production).

Findings: **none**.

---

## 3. V&V Review

### 3.1 Deterministic Testability

Result: **PASS**

- 418 test files covering 469 production files (0.89 test-to-production file ratio).
- 39 integration tests exercise cross-layer boundaries.
- E2E smoke tests (Playwright, chromium) exercise cockpit UI with deterministic fixture data via `storage-state.json` pre-seeding and MSW mock service worker.
- Quarantine system for flaky tests (`e2e/quarantine.json`, `analyze-flake-rates.mjs`).

### 3.2 Coverage Gates

Result: **PASS**

- Global thresholds enforced in `vitest.config.ts`:
  - statements: 83%, branches: 73%, functions: 88%, lines: 85%.
- Per-layer gates (all >=70%):
  - `src/domain/**`: 70% across all metrics.
  - `src/application/**`: 70% across all metrics.
  - `src/infrastructure/**`: 70% (65% branches).
  - `src/presentation/**`: 70% (65% branches).
- Codecov configured with 70% patch target and 1% project threshold.
- Coverage runs as part of `ci:pr` via `test:unit` (which includes `test:coverage` + `cockpit:test:coverage`).

### 3.3 Evidence Assertions

Result: **PASS**

- Evidence hash chain (`evidence-chain-v1.ts`) implements SHA-256 linked-hash verification with tamper detection.
- Evidence retention and chain continuity tested (`evidence-retention-chain-continuity.test.ts`).
- Approval audit events track `payloadHash` and `payloadHashAtDecision` for decision integrity.
- Agent action evidence hooks and human task evidence hooks provide audit trail for all execution actions.
- Synthetic evidence retention fixtures test long-term retention behavior.

### 3.4 Failure Diagnostics Design

Result: **PASS**

- Fault injection infrastructure (`src/infrastructure/fault-injection/fault-test-workflow.ts`) supports CI fault drills.
- Policy and SoD fault injection tests (`src/domain/services/policy-sod-fault-injection.test.ts`).
- Idempotency failure injection integration test (`src/application/integration/idempotency-failure-injection.integration.test.ts`).
- Workflow durability and outbox evidence test (`src/infrastructure/vv/workflow-durability-outbox-evidence.test.ts`) validates recovery after DB connectivity failures.
- Structured error responses via `respondProblem` in control-plane handlers (RFC 7807 problem details pattern).

### 3.5 CI Pipeline

Result: **PASS**

- `ci:pr` gate includes 13 sequential checks: gates, API drift, migrations, typecheck, lint, format, spelling, dependency-cruiser, knip, unit tests, Storybook build, E2E smoke.
- `ci:nightly` extends with: license audit, mutation testing, dependency graph, strict typecheck, strict knip.
- Architecture guard (`depcruise`) blocks merge on boundary violations.
- Merge guard workflow (`.github/workflows/merge-guard.yml`) runs on `pull_request` and `merge_group`.
- QA metrics tracking: test durations, CI pass rate, flake rates (bead-0825).

Findings: **none**.

---

## 4. Disposition Summary

| Category                  | Finding Count | Severity | Disposition |
| ------------------------- | ------------- | -------- | ----------- |
| Architecture boundaries   | 0             | —        | —           |
| Contracts / ports         | 0             | —        | —           |
| Control-plane choke-point | 0             | —        | —           |
| Identity / authentication | 0             | —        | —           |
| Authorization / RBAC      | 0             | —        | —           |
| Egress controls           | 0             | —        | —           |
| Bypass controls           | 0             | —        | —           |
| Threat assumptions        | 0             | —        | —           |
| Testability               | 0             | —        | —           |
| Coverage gates            | 0             | —        | —           |
| Evidence assertions       | 0             | —        | —           |
| Failure diagnostics       | 0             | —        | —           |
| CI pipeline               | 0             | —        | —           |

**Overall: PASS — no must-fix-now or follow-up findings.**

All four acceptance criteria are satisfied:

1. Architecture review confirms boundaries, contracts, and control-plane choke-point invariants.
2. Security review confirms threat assumptions, bypass controls, and identity posture.
3. V&V review confirms deterministic testability, evidence assertions, and failure diagnostics design.
4. No findings require disposition — implementation closure work may proceed.

---

## Verification Evidence

- Dependency-cruiser: 0 violations across 939 modules, 3,108 dependencies.
- Domain layer: zero imports from infrastructure or presentation (grep-verified).
- K8s NetworkPolicy: deny-all egress + control-plane allow-list confirmed in `infra/kubernetes/base/`.
- Coverage thresholds: global 83/73/88/85% + per-layer 70% gates in `vitest.config.ts`.
- 418 test files, 39 integration tests, E2E smoke suite with quarantine system.
- Evidence hash chain: SHA-256 linked-hash with tamper detection verified in domain.
- Fault injection: CI drill infrastructure in `src/infrastructure/fault-injection/`.
- CI pipeline: 13-check `ci:pr` gate confirmed in `package.json`.

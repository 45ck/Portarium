# Scenario Traceability Matrix

**Campaign:** bead-0842 — Local control-plane test scenarios for runs, approvals, and SoR governance
**Date:** 2026-03-02
**Status:** Complete

## Overview

This matrix maps each scenario test to its originating bead and the baseline
capabilities it validates. All scenarios run locally (no external dependencies)
and in CI as part of the `ci:scenario-gate` check.

## Scenario Matrix

| Scenario File                          | Bead      | Tests | Category      | Validates                                                                      |
| -------------------------------------- | --------- | ----- | ------------- | ------------------------------------------------------------------------------ |
| `scenario-openclaw-dispatch.test.ts`   | bead-0844 | 12    | Run path      | OpenClaw machine dispatch via `/runs` with evidence and trace verification     |
| `scenario-odoo-finance.test.ts`        | bead-0845 | 15    | Run path      | Odoo FinanceAccounting run-path verification with seeded-data assertions       |
| `scenario-human-approve.test.ts`       | bead-0846 | 19    | Approval      | HumanApprove pause/resume with maker-checker and decision audit chain          |
| `scenario-auth-negative-path.test.ts`  | bead-0847 | 19    | Security      | Auth/authz negative-path contract checks (401/403) for control-plane endpoints |
| `scenario-policy-bypass.test.ts`       | bead-0848 | 14    | Security      | Policy enforcement check for control-plane bypass attempts                     |
| `scenario-observability-pack.test.ts`  | bead-0849 | 22    | Cross-cutting | Scenario observability pack: logs, metrics, evidence chain, Temporal history   |
| `scenario-helpers.test.ts`             | bead-0858 | 20    | Shared        | Shared scenario assertion helpers and fixture contracts                        |
| `scenario-outbound-governance.test.ts` | bead-0839 | 21    | Governance    | Outbound-governance invariants with bypass and policy tests                    |

**Total: 8 scenario files, 142 tests**

## Baseline Beads Referenced

Each scenario builds on capabilities delivered in earlier campaign beads:

| Baseline Bead | Capability                                    | Scenarios Using It                           |
| ------------- | --------------------------------------------- | -------------------------------------------- |
| bead-0832     | ADR-0115 design specification                 | All security and governance scenarios        |
| bead-0833     | Action API routing (`ActionGatedToolInvoker`) | OpenClaw dispatch, Odoo finance              |
| bead-0834     | Sidecar proxy default-deny egress             | Outbound governance, policy bypass           |
| bead-0835     | NetworkPolicy and mesh egress gateway         | Auth negative-path, policy bypass            |
| bead-0836     | Workspace JWT and SPIFFE mTLS                 | Auth negative-path, observability pack       |
| bead-0837     | Fail-closed proxy behavior                    | Outbound governance, policy bypass           |
| bead-0838     | Egress observability and evidence chain       | Observability pack                           |
| bead-0839     | Outbound governance integration tests         | Outbound governance scenario                 |
| bead-0840     | Latency/throughput benchmarks                 | Performance assertions in observability pack |
| bead-0843     | Integration harness delta                     | All scenarios (shared test infrastructure)   |

## CI Integration

Scenario tests run in CI via the `ci:scenario-gate` script (bead-0851):

```bash
npm run ci:scenario-gate
```

The gate validates three invariants:

1. **evidence-sequence**: Evidence hash-chain assertions present and passing.
2. **auth-contract**: Auth/authz negative-path contract checks present and passing.
3. **bypass-policy**: Outbound-governance and bypass-policy assertions present and passing.

Deterministic seed: `SCENARIO_SEED=20260302` (configurable via env var).

Artifacts produced:

- `reports/scenarios/scenario-results.json` — full test results
- `reports/scenarios/scenario-summary.json` — gate summary with invariant status
- `test-results/scenario-junit.xml` — JUnit XML for CI integration
- `reports/scenarios/scenario-gate.log` — human-readable log

## Local Execution

All scenarios run locally without external dependencies:

```bash
# Run all scenarios
npm run test:scenarios

# Run scenario gate (with deterministic seed and invariant checks)
npm run ci:scenario-gate

# Run individual scenario
node node_modules/vitest/vitest.mjs run scripts/integration/scenario-openclaw-dispatch.test.ts
```

## Evidence Coverage

The scenarios prove that all external-effecting operations traverse Portarium endpoints:

| External Effect          | Enforcement Verified                | Test Coverage                         |
| ------------------------ | ----------------------------------- | ------------------------------------- |
| SoR API call (OpenClaw)  | Action API interception (Pattern A) | `scenario-openclaw-dispatch.test.ts`  |
| SoR API call (Odoo)      | Action API interception (Pattern A) | `scenario-odoo-finance.test.ts`       |
| Approval decision        | Control-plane approval workflow     | `scenario-human-approve.test.ts`      |
| Direct egress attempt    | NetworkPolicy deny + sidecar block  | `scenario-policy-bypass.test.ts`      |
| Unauthenticated request  | 401 rejection at control plane      | `scenario-auth-negative-path.test.ts` |
| Cross-workspace request  | 403 rejection at control plane      | `scenario-auth-negative-path.test.ts` |
| Evidence chain integrity | SHA-256 hash chain verification     | `scenario-observability-pack.test.ts` |
| Audit trail completeness | Structured log + metrics emission   | `scenario-observability-pack.test.ts` |

## Completion Criteria Verification

1. **Scenario tests are runnable locally and in CI**: All 142 tests pass locally
   (`npm run test:scenarios`) and in CI (`npm run ci:scenario-gate`).

2. **Evidence/log/metrics checks prove all external-effecting operations traverse
   Portarium endpoints**: The evidence coverage table above maps every external
   effect to a scenario that verifies Portarium control-plane routing.

3. **Traceability notes map each scenario to prior baseline beads and the new
   delta assertions**: The scenario matrix and baseline beads tables above
   provide full traceability from scenario to originating bead and the capability
   being validated.

# Governance V&V: Workflow Traceability Matrix

> **Audience**: QA leads, release managers, compliance officers.
>
> **Goal**: Provide a traceability matrix that maps every behavioural specification
> requirement to at least one test, one evidence artefact, and one release-gate check.

---

## 1. Traceability model

```
Spec requirement (`.specify/specs/`)
       │
       ├── ≥ 1 Test (domain / application / infrastructure / E2E)
       │         │
       │         └── Test result in CI → evidence artefact
       │
       └── ≥ 1 Release gate check (`docs/how-to/run-quality-gates.md`)
                 │
                 └── Gate passes → release artefact signed
```

A requirement is **traceable** when:

- It has a stable identifier (e.g. `REQ-RUN-001`)
- At least one test is tagged with that identifier
- The test appears in a CI run linked to the release commit

---

## 2. Core requirement set

### 2.1 Workflow lifecycle requirements

| Req ID      | Requirement statement                                                            | Test coverage                                          | Gate                 |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------- |
| REQ-RUN-001 | A workflow run must be in exactly one status at any time                         | `src/domain/vv/state-machine-invariants.test.ts`       | `npm run typecheck`  |
| REQ-RUN-002 | A Pending run transitions to Running before any step executes                    | `src/domain/runs/run-v1.test.ts`                       | `npm run test`       |
| REQ-RUN-003 | A run with `executionTier: 'HumanApprove'` must pause at each approval step      | `src/application/vv/command-query-conformance.test.ts` | `npm run test`       |
| REQ-RUN-004 | A run reaches a terminal state within its configured timeout                     | `docs/how-to/infrastructure-vv.md` (pending impl)      | `npm run ci:nightly` |
| REQ-RUN-005 | Terminal runs (Succeeded/Failed/Cancelled) cannot transition to any other status | `src/domain/vv/state-machine-invariants.test.ts`       | `npm run test`       |

### 2.2 Evidence chain requirements

| Req ID     | Requirement statement                                                      | Test coverage                                     | Gate                 |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------- | -------------------- |
| REQ-EV-001 | Every state transition emits a corresponding evidence entry                | `src/sdk/evidence-chain-verifier.test.ts`         | `npm run test`       |
| REQ-EV-002 | Evidence entries are hash-chained; each entry references the previous hash | `src/sdk/evidence-chain-verifier.test.ts`         | `npm run test`       |
| REQ-EV-003 | Evidence chain verification detects any tampered entry                     | `src/sdk/evidence-chain-verifier.test.ts`         | `npm run test`       |
| REQ-EV-004 | Evidence entries are never deleted (append-only)                           | `docs/how-to/infrastructure-vv.md` (pending impl) | `npm run ci:nightly` |
| REQ-EV-005 | Evidence payload must not contain credential values                        | `docs/adr/ADR-0080-credential-boundary-model.md`  | Code review gate     |

### 2.3 Approval requirements

| Req ID      | Requirement statement                                                            | Test coverage                                          | Gate                 |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------- |
| REQ-APR-001 | An approval in a terminal state (Denied/RolledBack/Expired) cannot be re-decided | `src/domain/vv/state-machine-invariants.test.ts`       | `npm run test`       |
| REQ-APR-002 | Approval decision must include a comment (non-empty string)                      | `src/application/vv/command-query-conformance.test.ts` | `npm run test`       |
| REQ-APR-003 | `ManualOnly` tier approvals require a human approver (not system)                | `docs/how-to/vv-campaign.md` (pending E2E)             | `npm run ci:nightly` |
| REQ-APR-004 | Expired approvals cause the associated run to fail                               | `src/domain/vv/state-machine-invariants.test.ts`       | `npm run test`       |

### 2.4 Authorization requirements

| Req ID       | Requirement statement                                | Test coverage                                          | Gate            |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------ | --------------- |
| REQ-AUTH-001 | All commands are workspace-scoped                    | `src/application/vv/command-query-conformance.test.ts` | `npm run test`  |
| REQ-AUTH-002 | Workspace A cannot read or modify Workspace B's data | `src/application/vv/command-query-conformance.test.ts` | `npm run test`  |
| REQ-AUTH-003 | Unauthenticated callers receive 401                  | OpenAPI contract tests                                 | `npm run ci:pr` |
| REQ-AUTH-004 | Unauthorised callers receive 403                     | OpenAPI contract tests                                 | `npm run ci:pr` |

---

## 3. Coverage gaps (pending implementation)

| Req ID      | Gap description                                          | Tracking bead |
| ----------- | -------------------------------------------------------- | ------------- |
| REQ-RUN-004 | Timeout handling test not yet implemented                | bead-0761     |
| REQ-EV-004  | Append-only storage enforcement test not yet implemented | bead-0761     |
| REQ-APR-003 | E2E test for ManualOnly tier not yet implemented         | bead-0762     |

---

## 4. Release gate mapping

| Gate                     | Requirements covered                                               | Command              |
| ------------------------ | ------------------------------------------------------------------ | -------------------- |
| Typecheck                | REQ-RUN-001 (type safety)                                          | `npm run typecheck`  |
| Unit + integration tests | REQ-RUN-001–005, REQ-EV-001–003, REQ-APR-001–002, REQ-AUTH-001–002 | `npm run test`       |
| OpenAPI contract         | REQ-AUTH-003–004                                                   | `npm run ci:pr`      |
| Nightly suite            | REQ-RUN-004, REQ-EV-004, REQ-APR-003                               | `npm run ci:nightly` |
| Code review              | REQ-EV-005                                                         | Manual review        |

---

## 5. Traceability completeness metric

| Category           | Total requirements | Covered by test | Coverage % |
| ------------------ | ------------------ | --------------- | ---------- |
| Workflow lifecycle | 5                  | 4               | 80 %       |
| Evidence chain     | 5                  | 3               | 60 %       |
| Approval           | 4                  | 3               | 75 %       |
| Authorization      | 4                  | 4               | 100 %      |
| **Total**          | **18**             | **14**          | **78 %**   |

**Target**: 100 % coverage before first public release.
Remaining gaps tracked in `docs/how-to/vv-campaign.md`.

---

## 6. How to maintain this matrix

1. When adding a new behaviour in `.specify/specs/`, assign a `REQ-XXX-NNN` identifier.
2. Tag the corresponding test with a comment: `// REQ-XXX-NNN`.
3. Add a row to the relevant table in this document.
4. Update the coverage metric at the bottom.
5. If a gate is not yet implemented, add a row to section 3.

---

## 7. Related documents

| Document                                               | Purpose                       |
| ------------------------------------------------------ | ----------------------------- |
| `docs/how-to/vv-campaign.md`                           | V&V campaign overview         |
| `docs/how-to/infrastructure-vv.md`                     | Infrastructure V&V plan       |
| `docs/how-to/run-quality-gates.md`                     | Quality gate reference        |
| `src/sdk/evidence-chain-verifier.ts`                   | Chain verification utility    |
| `src/domain/vv/state-machine-invariants.test.ts`       | Domain invariant tests        |
| `src/application/vv/command-query-conformance.test.ts` | Application conformance tests |

# Execution Order Runbook

This runbook defines the start-to-finish execution order and owner assignments
for the four critical delivery streams:

- Domain Atlas
- Adapter families
- Control-plane API
- Evidence pipeline

## Owner Assignments

| Role                    | Primary owner scope                                              | Backup owner scope              |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------- |
| Principal Engineer (PE) | Cross-stream sequencing, dependency enforcement, gate readiness  | Any blocked stream triage       |
| Domain Atlas Lead       | Upstream intake, CIF extraction, mapping quality, contract stubs | Adapter stream input quality    |
| Control-Plane API Lead  | OpenAPI contract, handler parity, auth/error envelopes           | API release readiness checks    |
| Evidence Pipeline Lead  | Plan/diff/evidence chain, outbox dispatch, immutability controls | Audit and retention evidence    |
| Adapter Family Leads    | Per-family implementation and tests across port families         | Family-level regression triage  |
| QA and Review Lead      | Review-bead closure evidence, doc-review closure, QA sign-off    | Release gate evidence collation |

## Global Rules

1. Follow workflow order from `CLAUDE.md`:
   `Spec -> Tasks (bd) -> Implement -> Tests -> Quality gates -> Review -> QA -> Merge`.
2. Work one bead at a time, and claim before implementation.
3. Treat unresolved blockers as hard stops; do not bypass dependency links.
4. Run and record quality gates for every closure attempt.

## Execution Sequence

### Stage 0: Preflight Governance Setup

Owner: Principal Engineer

- Refresh governance artifacts:
  - `node scripts/beads/generate-execution-dag.mjs`
  - `npm run beads:audit:weekly`
  - `npm run beads:audit:metadata`
  - `npm run beads:audit:scorecard`
  - `npm run beads:stop-loss:status`
- Confirm next ready bead and claim:
  - `npm run bd -- issue next --priority P0`
  - `npm run bd -- issue claim bead-XXXX --by "<owner>"`

Exit criteria:

- Ready queue is known.
- Governance snapshots are current.

### Stage 1: Domain Atlas Foundation

Owner: Domain Atlas Lead

Primary objective: ensure canonical mapping quality before adapter expansion.

Sequence:

1. Refresh/rebuild research index and extraction artifacts.
2. Regenerate operation contract stubs and readiness outputs.
3. Validate Domain Atlas artifacts and mapping evidence.

Core commands:

```bash
npm run domain-atlas:index
npm run domain-atlas:ops-stubs
npm run domain-atlas:validate
npm run domain-atlas:readiness
npm run domain-atlas:ops-stubs:verify
```

Handoff to later stages:

- Contract stubs and canonical mapping outputs are available to API and adapter leads.

### Stage 2: Control-Plane API Contract And Handler Path

Owner: Control-Plane API Lead

Primary objective: keep OpenAPI as source of truth and enforce runtime parity.

Sequence:

1. Update/verify OpenAPI contract and operation schemas.
2. Implement/align handler behavior and Problem Details responses.
3. Validate auth and tenant scoping behavior.

Key checks:

- OpenAPI schema and operation parity gates pass.
- Handler and contract tests cover route behavior.

Handoff to adapter stream:

- Stable API surfaces for workspace/run/approval/evidence/adapter operations.

### Stage 3: Evidence Pipeline Baseline

Owner: Evidence Pipeline Lead

Primary objective: ensure all execution paths produce audit-quality evidence.

Sequence:

1. Validate plan/diff semantics.
2. Validate evidence append/write path and hash-chain integrity.
3. Validate outbox/event emission ordering and replay safety.
4. Validate retention/immutability assumptions.

Required outputs:

- Evidence-chain integrity test evidence.
- Event dispatch and replay behavior evidence.

### Stage 4: Adapter Family Delivery Waves

Owner: Adapter Family Leads (coordinated by PE)

Primary objective: deliver families in controlled waves, not ad hoc.

Per-family order:

1. Confirm Domain Atlas mapping and capability matrix readiness.
2. Implement family foundation bead.
3. Add/expand family integration tests.
4. Complete review bead and test-evidence bead.

Per-family done criteria:

- Contract expectations satisfied.
- Integration tests pass.
- Review evidence recorded in `docs/review/`.

### Stage 5: Cross-Stream Integration And QA

Owner: QA and Review Lead

Primary objective: close implementation with traceable review and QA evidence.

Sequence:

1. Run review beads for completed implementation clusters.
2. Run doc-review beads for domain/app/API/spec alignment.
3. Verify bead prerequisite checks for pending closures.

Checks:

```bash
node scripts/beads/check-bead-prerequisites.mjs bead-XXXX --json
npm run ci:pr
```

### Stage 6: Release Readiness Transition

Owner: Principal Engineer + QA and Review Lead

Primary objective: move phase gates in order with explicit evidence.

Sequence:

1. Validate phase gate closure prerequisites (Foundation -> Domain -> Application
   -> Infrastructure -> Presentation -> Integration -> Security -> Release).
2. Confirm governance audits and runbooks are current.
3. Close gate beads with linked evidence.

## Handoff Checklist Between Stages

- Active bead is claimed.
- Blockers are closed or explicitly documented.
- Relevant runbook/spec/ADR references are updated.
- Review evidence document exists for completed bead(s).
- `ci:pr` attempted and outcome captured.

## Related Runbooks

- Rollback plan: `docs/governance/failing-cycle-rollback-runbook.md`

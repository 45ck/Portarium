# Review: bead-0484 (Infrastructure Adapters Wiring)

Reviewed on: 2026-02-20

Scope:

- bead-0335 wiring verification
- PostgreSQL-backed store/eventing adapters
- application integration path using wired adapters

## Acceptance Criteria Check

1. Every application port in scope has concrete infrastructure wiring:
- Verified concrete adapters under:
  - `src/infrastructure/postgresql/postgres-store-adapters.ts`
  - `src/infrastructure/postgresql/postgres-workforce-store-adapters.ts`
  - `src/infrastructure/postgresql/postgres-eventing.ts`
- Includes workspace/run/workflow/approval/policy/idempotency/work item/workforce/human task/outbox/evidence/event publisher surfaces.

2. Integration suite passes against PostgreSQL adapter contracts:
- Verified by integration tests:
  - `src/infrastructure/postgresql/postgres-store-adapters.integration.test.ts`
  - `src/application/integration/register-workspace-flow.integration.test.ts`
  - `src/application/integration/start-workflow-flow.integration.test.ts`

3. ID generator behavior (deterministic + unique) is covered in runtime path:
- ID generation is exercised through command/integration flows and remains stable in tests using deterministic generators in app-layer tests.

4. Event publisher adapter tested with outbox:
- Verified by:
  - `src/application/services/outbox-dispatcher.test.ts`
  - `src/infrastructure/postgresql/postgres-store-adapters.integration.test.ts`
- Confirms outbox enqueue/dequeue and publish integration path.

## Verification Run

Executed:

```bash
npm run test -- src/infrastructure/postgresql/postgres-store-adapters.integration.test.ts src/application/services/outbox-dispatcher.test.ts src/application/integration/register-workspace-flow.integration.test.ts src/application/integration/start-workflow-flow.integration.test.ts
```

Result:

- 4 test files passed
- 17 tests passed

## Findings

High: none.

Medium: none.

Low:

- Full `ci:pr` remains impacted by existing repository-wide lint debt unrelated to this bead; targeted adapter-wiring verification is green.

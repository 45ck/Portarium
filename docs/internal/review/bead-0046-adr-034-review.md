# Bead-0046 ADR-034 Review

## Review focus

Verified sandbox assertions, egress allowlisting, and per-tenant isolation controls through runtime-focused tests.

## What was verified

- Runtime containment environment contract is validated in `src/presentation/runtime/runtime-containment.ts`:
  - tenant isolation mode must be `per-tenant-worker`
  - sandbox assertions mode must be `strict` or `relaxed`
  - egress allowlist must be HTTPS-only
- Worker startup enforces containment config before serving traffic in `src/presentation/runtime/worker.ts`.
- Integration-oriented runtime tests assert failure on weak isolation and acceptance on valid settings:
  - `src/presentation/runtime/runtime-containment.test.ts`
  - `src/presentation/runtime/worker.test.ts`
  - `src/presentation/runtime/worker-temporal.test.ts`
  - `src/presentation/runtime/worker-temporal-disabled.test.ts`
- Existing domain-level containment assertions from bead-0045 remain covered by:
  - `src/domain/adapters/adapter-registration-v1.test.ts`
  - `src/domain/machines/machine-registration-v1.test.ts`

## Verification results

- Runtime test suite passed:
  - `npm run test -- src/presentation/runtime/runtime-containment.test.ts src/presentation/runtime/worker.test.ts src/presentation/runtime/worker-temporal.test.ts src/presentation/runtime/worker-temporal-disabled.test.ts`
- Typecheck passed:
  - `npm run typecheck`
- `npm run ci:pr` still fails at existing gate baseline mismatch (`package.json` hash mismatch, missing `knip.json`), unchanged by this bead.

# bead-0044 ADR-033 review: trace/span IDs, metrics hooks, and redaction-safe logs

## Trace/span verification

- Request trace context (`traceparent`, `tracestate`) is normalized at ingress and propagated via `AppContext`.
- Workflow orchestration carries trace context from app command to Temporal workflow args.
- Tests verify propagation:
  - `src/presentation/runtime/control-plane-handler.test.ts`
  - `src/application/commands/start-workflow.test.ts`
  - `src/infrastructure/temporal/temporal-workflow-orchestrator.test.ts`

## Metrics hook verification

- Added lightweight metrics hook abstraction:
  - `src/infrastructure/observability/metrics-hooks.ts`
- Critical path counters emitted in temporal activities:
  - `portarium.run.started`
  - `portarium.run.succeeded`
- Verified in `src/infrastructure/temporal/activities.test.ts`.

## Redaction-safe structured logs verification

- Added structured redaction utility:
  - `src/infrastructure/observability/structured-log.ts`
- Temporal workflow startup log now emits structured, redacted fields rather than spreading full payload.
- Verified redaction behavior in `src/infrastructure/observability/structured-log.test.ts`.

## Outcome

- ADR-033 review criteria addressed in critical request/workflow paths with concrete tests.
- Full `ci:pr` remains blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline

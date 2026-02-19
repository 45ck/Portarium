# bead-0043 ADR-033 implementation: OTel trace context propagation

## Implemented paths

- Request ingress:
  - `traceparent` / `tracestate` headers are normalized in `control-plane-handler`.
  - Invalid/missing `traceparent` gets a valid W3C fallback.
  - Response headers now include propagated trace context on both success and problem responses.
- Application context:
  - `AppContext` now carries optional `traceparent` / `tracestate`.
  - `toAppContext` normalizes trace context fields.
  - Authentication input contract extended to accept trace context and pass into app context creation.
- Workflow stack:
  - `WorkflowExecutionInput` carries optional trace context.
  - `startWorkflow` passes trace context from `AppContext` to `WorkflowOrchestrator`.
  - Temporal orchestrator forwards trace context into workflow args.
  - Temporal workflow input and activity inputs carry optional trace context.
- Machine call stack contract:
  - `MachineInvoker` correlation envelope now includes optional trace context.

## Tests added/updated

- New: `src/application/common/trace-context.test.ts`
- Updated:
  - `src/presentation/runtime/control-plane-handler.test.ts`
  - `src/application/commands/start-workflow.test.ts`
  - `src/infrastructure/temporal/temporal-workflow-orchestrator.test.ts`

## Verification

- Targeted tests pass.
- `typecheck` passes.
- `ci:pr` still blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline

# bead-1127 command endpoint security review: Cockpit parity

## Summary

- Runtime parity is incomplete for the high-risk Cockpit command routes.
- Added runtime regressions around cookie-session mutation guardrails on existing run and approval mutations because those are the shared controls the new routes are expected to reuse.
- The largest remaining gaps are route presence, workspace binding on approval creation, least-privilege separation for cancellation, replay handling, and tamper-evident audit coverage.

## Findings

1. High: the published parity routes are not registered in the runtime handler.
   Evidence:
   - [src/presentation/runtime/control-plane-handler.ts](/C:/Projects/Portarium/.trees/bead-1127/src/presentation/runtime/control-plane-handler.ts) registers `GET /v1/workspaces/:workspaceId/runs`, `POST /v1/workspaces/:workspaceId/runs/:runId/interventions`, `GET /v1/workspaces/:workspaceId/approvals`, `GET /v1/workspaces/:workspaceId/approvals/:approvalId`, and `POST /v1/workspaces/:workspaceId/approvals/:approvalId/decide`, but not `POST /v1/workspaces/:workspaceId/runs`, `POST /v1/workspaces/:workspaceId/runs/:runId/cancel`, or `POST /v1/workspaces/:workspaceId/approvals`.
   - [docs/spec/openapi/portarium-control-plane.v1.yaml](/C:/Projects/Portarium/.trees/bead-1127/docs/spec/openapi/portarium-control-plane.v1.yaml) publishes `startRun`, `cancelRun`, and `createApproval`.
   - [apps/cockpit/src/lib/control-plane-client.ts](/C:/Projects/Portarium/.trees/bead-1127/apps/cockpit/src/lib/control-plane-client.ts) and [src/presentation/ops-cockpit/http-client.ts](/C:/Projects/Portarium/.trees/bead-1127/src/presentation/ops-cockpit/http-client.ts) call those routes.
     Risk:
   - The HTTP trust boundary for run create, run cancel, and approval create does not exist yet, so authorization, workspace scoping, cookie-session mutation markers, replay handling, and audit behavior for those routes are currently unimplemented and unverified.
   - [src/presentation/runtime/control-plane-handler.openapi.routes.review.test.ts](/C:/Projects/Portarium/.trees/bead-1127/src/presentation/runtime/control-plane-handler.openapi.routes.review.test.ts) can false-pass here because the OpenAPI operations have `default` responses, so a runtime `404` still counts as documented.

2. High: `createApproval` relies on caller discipline for workspace binding and allows audit-free success.
   Evidence:
   - [src/application/commands/create-approval.ts](/C:/Projects/Portarium/.trees/bead-1127/src/application/commands/create-approval.ts) authorizes `APP_ACTIONS.approvalCreate`, but does not reject `ctx.tenantId !== input.workspaceId`.
   - The command persists using `ctx.tenantId` while the approval payload and evidence entry use `input.workspaceId`.
   - `evidenceLog` is optional, and the command succeeds when it is absent.
     Risk:
   - A future HTTP route, MCP tool, or internal caller that forgets to enforce `expectedWorkspaceId` can create approvals whose payload workspace differs from the authenticated tenant boundary.
   - Approval creation can succeed without a tamper-evident audit record even though approval request creation is a governance-sensitive mutation.

3. Medium: the in-flight cancel command collapses cancel and intervene privileges and has no replay contract.
   Evidence:
   - [src/application/commands/cancel-run.ts](/C:/Projects/Portarium/.trees/bead-1127/src/application/commands/cancel-run.ts) authorizes `APP_ACTIONS.runIntervene` and has no dedicated `runCancel` action.
   - The command takes no idempotency key and uses no idempotency store.
     Risk:
   - Any principal or policy granted run intervention implicitly gains run cancellation unless another layer compensates.
   - A future `POST /runs/:runId/cancel` route has no explicit replay contract yet. Exact-once behavior would depend entirely on storage transaction semantics and client retry behavior.

4. Medium: run creation has replay protection but not tamper-evident evidence parity.
   Evidence:
   - [src/application/commands/start-workflow.ts](/C:/Projects/Portarium/.trees/bead-1127/src/application/commands/start-workflow.ts) uses idempotency and propagates the request key to the orchestrator.
   - [src/application/commands/start-workflow.execute-transaction.ts](/C:/Projects/Portarium/.trees/bead-1127/src/application/commands/start-workflow.execute-transaction.ts) saves the run, starts orchestration, publishes `RunStarted`, and stores idempotency output, but does not append evidence.
     Risk:
   - If the runtime parity work is expected to provide audit symmetry with run cancellation and approval flows, run creation currently lacks a tamper-evident evidence anchor.

## Structured outputs

### Trust-boundary map

- Cockpit browser
  - bearer token or HttpOnly Cockpit web session cookie
- Control-plane runtime
  - shared authentication path in `authenticate(...)`
  - same-origin mutation marker gate for cookie-authenticated writes
- Authorization port
  - action-level allow/deny decision
- Command layer
  - `startWorkflow`
  - `createApproval`
  - `cancelRun` (work in progress)
- Persistence and side effects
  - stores and `unitOfWork`
  - `eventPublisher`
  - `evidenceLog`
  - workflow orchestrator

### Sensitive action matrix

- `startRun`
  - authz action today: `run:start`
  - replay control today: idempotency store
  - evidence today: none
  - workspace binding: route layer required; command-layer binding is implicit, not explicit
- `cancelRun`
  - authz action today: `run:intervene`
  - replay control today: none
  - evidence today: required by the command implementation
  - workspace binding: depends on future route wiring
- `createApproval`
  - authz action today: `approval:create`
  - replay control today: none
  - evidence today: optional
  - workspace binding: route layer required; command-layer binding is not explicit

## Recommendations

- Add explicit runtime route-presence coverage for `startRun`, `cancelRun`, and `createApproval` once the handler wiring lands. Do not rely on the existing OpenAPI route review test alone.
- In `createApproval`, reject `ctx.tenantId !== input.workspaceId` before persistence and fail closed when governance requires `evidenceLog`.
- Introduce a distinct `APP_ACTIONS.runCancel` authorization action and map `POST /runs/:runId/cancel` to it instead of reusing `run:intervene`.
- Define replay semantics for `createApproval` and `cancelRun` before the routes land. The safest default is `Idempotency-Key` plus persisted response replay, matching `startWorkflow`.
- Decide whether `RunStarted` requires evidence parity with `RunCancelled` and approval creation. If yes, add a required evidence append in the start transaction or document why CloudEvents alone are sufficient.

## Residual risk summary

- Current runtime regressions now cover the shared cookie-session mutation guardrails on existing approval and run mutation routes.
- The primary residual risk is not a bug in those shared guards; it is the absence of the new HTTP routes and the missing security contract for how they will bind workspace, privilege, replay, and audit semantics once implemented.

## Recommended next skill

- `security-requirements-writer`

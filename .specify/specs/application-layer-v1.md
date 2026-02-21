# Application Layer v1 (Control-Plane Use Cases)

## Purpose

Record the first application-layer use cases so the command/query boundary is contract-first and
independent of transport/framework concerns.

## Commands

### RegisterWorkspace

- **Name**: `RegisterWorkspace`
- **Action**: `workspace:register`
- **Inputs**
  - `idempotencyKey` (required, non-empty string)
  - `workspace` (required canonical `WorkspaceV1` payload)
- **Core rules**
  - Caller must be authorized for `workspace:register`.
  - `workspace.tenantId` must match `AppContext.tenantId`.
  - Idempotency is enforced by `(tenantId, commandName, idempotencyKey)`.
  - Existing workspace with same `(tenantId, workspaceId)` returns `Conflict`.
  - Workspace name must be unique per tenant; duplicate names with different IDs return `Conflict`.
- On success:
  - workspace is persisted within a unit-of-work boundary
  - one outbox/cloud event is emitted for `WorkspaceCreated`
  - response includes the workspace id
  - output is cached in idempotency store

### StartWorkflow

- **Name**: `StartWorkflow`
- **Action**: `run:start`
- **Inputs**
  - `idempotencyKey` (required, non-empty string)
  - `workspaceId` (required branded `WorkspaceId`)
  - `workflowId` (required branded `WorkflowId`)
- **Core rules**
  - Caller must be authorized for `run:start`.
  - Workflow must exist and be active.
  - `workspaceId` in command input must match returned workflow workspace scope.
  - Workflow version policy: exactly one active version per workflow name, and the selected workflow must be the active head version.
  - Adapter activation policy: every workflow action port family must have exactly one active adapter registration in the workspace.
  - Generated `runId` must be unique in `(tenantId, workspaceId)` before persistence.
  - A durable execution entry is created as a `RunV1` with initial status `Pending`.
  - One orchestrator start event is emitted plus one `PortariumCloudEventV1` envelope.
  - Idempotency replays return identical `runId`.

### SubmitApproval

- **Name**: `SubmitApproval`
- **Action**: `approval:submit`
- **Inputs**
  - `workspaceId` (required branded `WorkspaceId`)
  - `approvalId` (required branded `ApprovalId`)
  - `decision` (`Approved` or `Denied`)
  - `rationale` (required non-empty string)
- **Core rules**
  - Caller must be authorized for `approval:submit`.
  - Submission updates pending approval to decided state.
  - Existing `ApprovalDenied`/`ApprovalGranted` events are emitted.
  - Approved/denied state is persisted in the approval record.

## Queries

### GetWorkspace

- **Name**: `GetWorkspace`
- **Action**: `workspace:read`
- **Inputs**
  - `workspaceId` (non-empty string)
- **Core rules**
  - Caller must be authorized for `workspace:read`.
  - workspace reads are tenant-scoped (`tenantId` + `workspaceId`).
  - missing workspace returns `NotFound`.
  - successful response returns `WorkspaceV1`.

### GetRun

- **Name**: `GetRun`
- **Action**: `run:read`
- **Inputs**
  - `workspaceId`
  - `runId`
- **Core rules**
  - Caller must be authorized for `run:read`.
  - Missing run returns `NotFound`.
  - successful response returns `RunV1`.

### Read-Model Projection and Cache Strategy

- **Projection model**
  - Command-side writes remain authoritative in transactional stores.
  - Query-side read models are denormalized projection tables populated from the outbox/CloudEvents stream.
  - Read models are tenant-scoped and keyed for query patterns used by Cockpit list/detail pages.
- **Caching model**
  - Cache-aside strategy on query handlers (`GetRun`, list/read workspace queries).
  - Cache keys are tenant-scoped and include query parameters (workspaceId, pagination, filters).
  - Cache entries are short-lived and treated as performance optimization, not source of truth.
- **Invalidation triggers**
  - Invalidate run/workflow read-model cache entries on `RunStarted`, `RunStatusChanged`, and approval-decision events.
  - Invalidate workspace/read-model cache entries on `WorkspaceCreated`, membership changes, and policy changes affecting visibility.
  - Invalidate adapter/credential query cache entries on adapter registration and credential grant/revoke events.
- **Failure and recovery**
  - Projection workers are idempotent and replay-safe; replay rebuilds read models without duplicating records.
  - On projection lag or corruption, query handlers can fall back to authoritative reads for bounded endpoints while projections are rebuilt.

## Events

- `WorkspaceCreated` domain event is wrapped in a `PortariumCloudEventV1` envelope with
  `type` set to `com.portarium.workspace.WorkspaceCreated`.
- `RunStarted`, `ApprovalGranted`, and `ApprovalDenied` domain events are wrapped in
  `PortariumCloudEventV1` envelopes during their write-path commands.

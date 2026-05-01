# Agent Action Governance Lifecycle v1

## Purpose

The agent action governance lifecycle defines the propose/approve/execute pipeline through which AI agents request, receive approval for, and execute tool invocations. Every agent action flows through policy evaluation and, depending on tool classification, may require human approval before execution.

## Lifecycle Phases

### 1. Propose (ProposeAgentAction)

An agent proposes a tool invocation. The control plane evaluates the proposal against:

- **Tool blast-radius classification**: Maps tool name to risk category via pattern matching.
- **Policy evaluation**: Evaluates workspace policies (SoD constraints, execution tier requirements).

Input:

- `workspaceId`: branded `WorkspaceId`
- `agentId`: string (agent identity)
- `machineId?`: optional string (machine runtime hosting the agent)
- `actionKind`: string (e.g., `invoke-tool`)
- `toolName`: string (canonical tool name)
- `parameters?`: optional `Record<string, unknown>` (tool-specific input)
- `executionTier`: `ExecutionTier` (`Auto` | `Assisted` | `HumanApprove` | `ManualOnly`)
- `policyIds`: non-empty array of `PolicyId` (policies to evaluate)
- `rationale`: non-empty string (why the action is proposed)
- `requestedByUserId`: branded `UserId`
- `idempotencyKey?`: optional string (deduplication key)

Output:

- `proposalId`: string (unique proposal identifier)
- `evidenceId`: branded `EvidenceId` (tamper-evident audit trail entry)
- `decision`: `Allow` | `NeedsApproval` | `Denied`
- `approvalId?`: optional string (populated when decision is `NeedsApproval`)
- `message?`: optional string (explanation for denial or approval routing)

Authorization: `agent-action:propose` (roles: admin, operator).

### 2. Approve (SubmitApproval)

When the proposal decision is `NeedsApproval`, a human reviewer must decide. The existing approval subsystem handles this:

- The proposal creates an `ApprovalV1` record with status `Pending`.
- A reviewer calls `submitApproval` with decision `Approved` or `Denied`.
- For agent-action approvals, `submitApproval` verifies that the linked
  `AgentActionProposalV1` exists and that its `proposalId`, `approvalId`, and
  `workspaceId` match the approval before accepting a decision.
- Unconditional maker-checker: the deciding user cannot be the requesting user.
- SoD constraints from workspace policies may impose additional restrictions.
- Evidence is recorded for every approval decision.

### 3. Execute (ExecuteApprovedAgentAction)

After approval, the agent (or an operator) calls execute:

Input:

- `workspaceId`: string
- `approvalId`: string
- `flowRef`: string (execution-plane reference: tool name, pipeline ID, or endpoint path)
- `payload?`: optional `Record<string, unknown>` (action-specific parameters)
- `idempotencyKey?`: optional non-empty retry key, normally supplied by `Idempotency-Key` on HTTP

Output:

- `executionId`: string
- `approvalId`: branded `ApprovalId`
- `status`: `Executed` | `Failed`
- `output?`: unknown (execution result on success)
- `errorMessage?`: string (on failure)

Guards:

1. Authorization: `agent-action:execute` (roles: admin, operator).
2. Approval exists and status is `Approved`.
3. Caller workspaceId matches the approval workspaceId.
4. The approval decider cannot execute the same action.

Dispatch delegates to `ActionRunnerPort.dispatchAction()`, which may be backed by:

- `MachineInvokerActionRunner` (OpenClaw gateway → `MachineInvokerPort.invokeTool()`)
- `ActivepiecesActionExecutor` (Activepieces flow trigger)
- Any other `ActionRunnerPort` adapter.

## Tool Blast-Radius Classification Matrix

| Category  | Minimum Tier | Pattern Examples                               | Rationale                                        |
| --------- | ------------ | ---------------------------------------------- | ------------------------------------------------ |
| ReadOnly  | Auto         | read, get, list, search, query, fetch, inspect | No side effects; safe for autonomous execution.  |
| Mutation  | HumanApprove | write, create, update, delete, send, deploy    | Changes external state; requires human sign-off. |
| Dangerous | ManualOnly   | shell, terminal, browser, package-install      | Host-level access; always denied in auto tier.   |
| Unknown   | HumanApprove | (no pattern match)                             | Defaults to HumanApprove to reduce blast radius. |

Classification is performed by `classifyOpenClawToolBlastRadiusV1()` using regex pattern matching against the tool name.

## Policy Evaluation Rules

1. Tool classification determines the minimum required execution tier.
2. If `executionTier` < `minimumTier`, the tool is tier-blocked.
3. Workspace policies are evaluated via `evaluatePolicies()`:
   - `Allow` — no policy violations, tier sufficient.
   - `RequireApproval` — policy mandates human review.
   - `Deny` — policy explicitly blocks the action.
4. SoD violations (e.g., MakerChecker) are detected during policy evaluation.

### Decision Matrix

| Tool Category | Policy Decision | Final Decision |
| ------------- | --------------- | -------------- |
| Dangerous     | _any_           | Denied         |
| _any_         | Deny            | Denied         |
| Mutation      | Allow           | NeedsApproval  |
| Unknown       | Allow           | NeedsApproval  |
| _any_         | RequireApproval | NeedsApproval  |
| ReadOnly      | Allow           | Allow          |

## Approval Routing Rules

When decision is `NeedsApproval`:

1. An `ApprovalV1` record is created with status `Pending`.
2. The approval is assigned to workspace approvers based on RBAC roles.
3. Unconditional maker-checker prevents the requesting user from approving their own proposal.
4. SoD constraints from evaluated policies may impose additional restrictions.

## Execution Gating

Before dispatching a tool invocation, `executeApprovedAgentAction` enforces:

1. The referenced approval must exist.
2. The approval status must be exactly `Approved` (not `Pending`, `Denied`, or `RequestChanges`).
3. The approval's workspaceId must match the caller's workspaceId.
4. The caller must have the `agent-action:execute` permission.

After all guards pass, the command creates or observes a durable execution
reservation, then atomically claims execution by moving the approval from
`Approved` to `Executing` with storage-level compare-and-set semantics. Only the
caller that owns the reservation and wins that claim may dispatch through the
configured `ActionRunnerPort`. The claim must not hold a database transaction
open across the external dispatch.

On successful dispatch, the command finalizes the approval from `Executing` to
`Executed`. If dispatch fails before an external side effect is accepted, the
command releases the claim back to `Approved` and records the failure event and
evidence. Callers that lose the claim return a conflict or replay from
idempotency; they do not dispatch, publish events, append evidence, or overwrite
approval state.

Execution is retry-safe:

- If a caller supplies an `idempotencyKey`, `executeApprovedAgentAction` uses that key for both command replay and downstream dispatch.
- If the caller omits `idempotencyKey`, the command derives a stable dispatch key from `(tenantId, workspaceId, approvalId, flowRef)`.
- A matching retry while the reservation is active returns `Executing` without a second action dispatch, event publish, evidence append, or approval state write.
- A matching replay after completion returns the cached execution response without a second action dispatch, event publish, evidence append, or approval state write.
- Reusing the same idempotency key with a different execution fingerprint returns `Conflict`.
- The dispatch key is used as the stable `actionId` and is forwarded through `ActionRunnerPort` and `MachineInvokerPort`; OpenClaw gateway requests carry it as `Idempotency-Key`.
- First-submission concurrency is closed by the approval execution claim: concurrent callers that all observe `Approved` still converge through a single storage-level `Approved -> Executing` winner before any external dispatch.

## Evidence Chain Requirements

Every phase records a tamper-evident evidence entry via `EvidenceLogPort.appendEntry()`:

- **Propose**: Records proposal details, tool classification, policy evaluation result, and decision.
- **Approve**: Records approval decision, rationale, and maker-checker verification.
- **Execute**: Records execution outcome (success or failure), execution ID, and approval reference.

Evidence entries include:

- `evidenceId`: branded `EvidenceId`
- `workspaceId`: branded `WorkspaceId`
- `correlationId`: branded `CorrelationId`
- `occurredAtIso`: ISO-8601 timestamp
- `category`: `Action` | `Approval` | `Policy`
- `summary`: human-readable description
- `actor`: `{ kind: 'User', userId }` or `{ kind: 'System' }`
- `links`: cross-references to related aggregates (approvalId, runId, planId)

## Maker-Checker SoD Invariants

1. **Unconditional**: The user deciding an approval must never be the same user who requested it. This is enforced before any SoD constraint evaluation.
2. **Policy-based**: Workspace policies may add further SoD constraints (e.g., requiring different roles for proposer and approver).
3. **Evidence-backed**: Both the proposal and the approval decision are recorded as separate evidence entries, creating an auditable separation-of-duties trail.

## Domain Events

- `AgentActionProposed` — emitted when a proposal is evaluated (all decisions).
- `ApprovalDecided` — emitted when an approval is approved or denied.
- `AgentActionExecuted` — emitted on successful tool dispatch.
- `AgentActionExecutionFailed` — emitted when dispatch fails.

All events use CloudEvent format: `com.portarium.<aggregateKind>.<eventType>`.

## Domain Model

### AgentActionProposalV1

Aggregate in `src/domain/machines/`:

- `schemaVersion`: `1`
- `proposalId`: branded `ProposalId`
- `workspaceId`: branded `WorkspaceId`
- `agentId`: branded `AgentId`
- `machineId?`: optional branded `MachineId`
- `actionKind`: string
- `toolName`: string
- `parameters?`: optional `Record<string, unknown>`
- `executionTier`: `ExecutionTier`
- `toolClassification`: embedded value object (toolName, category, minimumTier, rationale)
- `policyDecision`: `Allow` | `Deny` | `RequireApproval`
- `policyIds`: non-empty array of branded `PolicyId`
- `decision`: `Allow` | `NeedsApproval` | `Denied`
- `approvalId?`: optional branded `ApprovalId`
- `rationale`: string
- `requestedByUserId`: branded `UserId`
- `correlationId`: branded `CorrelationId`
- `proposedAtIso`: ISO-8601 timestamp
- `idempotencyKey?`: optional string

### AgentActionProposalStore Port

- `getProposalById(tenantId, proposalId)`: returns `AgentActionProposalV1 | null`
- `getProposalByApprovalId(tenantId, approvalId)`: returns `AgentActionProposalV1 | null`
- `saveProposal(tenantId, proposal)`: persists or upserts the proposal

## Idempotency Semantics

Proposal deduplication prevents duplicate approvals and evidence entries when the same agent action is proposed multiple times (e.g., retries, network duplicates, concurrent requests).

### Deduplication Key

Each proposal may carry an optional `idempotencyKey`. When provided, the key is scoped to `(tenantId, workspaceId)` -- the same key in different workspaces creates independent proposals.

When the caller does not supply an `idempotencyKey`, the system auto-generates one from a SHA-256 hash of `workspaceId + agentId + actionKind + toolName + canonicalParameters`. This ensures that structurally identical proposals are automatically deduplicated.

### Uniqueness Enforcement

- **Database layer**: A partial UNIQUE index `uk_agent_action_proposals_idempotency` on `(tenant_id, workspace_id, idempotency_key) WHERE idempotency_key IS NOT NULL` prevents concurrent inserts from creating duplicate rows.
- **In-memory store**: First-writer-wins semantics -- if a proposal with the same idempotency key already exists for the workspace, the duplicate is silently discarded.
- **Application layer**: After persisting a proposal, the command re-reads the store to detect race losers. If a different proposal won the write, the loser returns the winner's output, ensuring both concurrent callers receive the same `proposalId` and `approvalId`.
- **Approval decision layer**: `submitApproval` re-validates the approval-to-proposal link before recording any decision. Orphaned approvals left behind by a losing concurrent writer are rejected and cannot unblock or pollute the approval decision trail.

### Behaviour Guarantees

1. **At-most-once evaluation**: For a given idempotency key within a workspace, policy evaluation and evidence recording happen exactly once (the first call). Subsequent calls return the cached result.
2. **Consistent output**: All callers with the same idempotency key receive the same `proposalId`, `decision`, and `approvalId` (if applicable).
3. **TTL expiry**: In-memory idempotency entries expire after 24 hours (configurable). After expiry, the same key creates a new proposal.
4. **No cross-workspace leakage**: The same idempotency key in different workspaces creates independent proposals.
5. **Null keys are not deduplicated**: Proposals without an `idempotencyKey` (and without a `proposalStore`) are always treated as distinct.

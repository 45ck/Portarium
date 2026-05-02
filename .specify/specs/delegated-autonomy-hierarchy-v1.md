# Delegated Autonomy Hierarchy v1

## Purpose

Define deterministic configuration semantics for delegated autonomy across Portarium's control
hierarchy. The hierarchy turns the operator interaction model into structured rules that can be
used by policy authoring, simulation, Cockpit/API explanations, runtime checks, and audit review.

## Scope Order

Autonomy controls are evaluated in this fixed order:

1. `PlatformBaseline`
2. `Tenant`
3. `Workspace`
4. `RoleOrQueue`
5. `RunCharter`
6. `Action`

Lower scopes may tighten a control. Lower scopes may replace a higher default with a weaker value.
Lower scopes must not silently weaken a higher `hard-limit`.

## Control Kinds

Version 1 defines three controls:

- `execution-tier`: effective `ExecutionTier` (`Auto`, `Assisted`, `HumanApprove`, `ManualOnly`)
- `budget-limit`: maximum amount in minor currency units
- `action-prohibition`: explicit allow/prohibit result for the target Action

Each control carries a `limitStrength`:

- `default`: lower scopes may override in either direction by precedence.
- `hard-limit`: lower scopes may tighten; weakening requires a valid weakening override.
- `platform-invariant`: non-overridable platform rule. It must be scoped to `PlatformBaseline` and
  cannot allow weakening.

## Weakening and Tightening

Strictness is deterministic:

- For `execution-tier`, stricter means farther along the tier ladder:
  `Auto < Assisted < HumanApprove < ManualOnly`.
- For `budget-limit`, stricter means a lower amount for the same currency.
- For `action-prohibition`, `prohibited: true` is stricter than `prohibited: false`.

If a lower-scope rule is stricter, it becomes effective and the explanation records `tightened`.
If a lower-scope rule is weaker than a higher default, it becomes effective and the explanation
records `precedence-overrode-default`. If it is weaker than a higher hard limit, it is blocked unless
an approved override is live.

## Override Paths

Weakening a higher `hard-limit` is allowed only when all conditions are true:

- the higher rule has `allowWeakeningWithApproval: true`
- the override targets the higher rule and weakening rule by ID
- the override has already been approved and is not expired
- the source is one of:
  - `policy-change-approval`
  - `incident-break-glass`

`policy-change-approval` overrides must reference an `approvalId` or `policyChangeId`.
`incident-break-glass` overrides must include `expiresAtIso` and `postIncidentReviewRequired: true`.

## Non-Overridable Platform Invariants

Platform invariants cannot be bypassed by tenant, Workspace, role or queue, Run charter, or Action
rules. A rule with `limitStrength: platform-invariant`:

- must be scoped to `PlatformBaseline`
- cannot set `allowWeakeningWithApproval`
- ignores policy-change and break-glass overrides
- records blocked weakening attempts with reason `platform-invariant`

The operator interaction model names these invariant categories:

- evidence continuity and traceability for governed decisions
- policy enforcement before external side effects
- attributable actor identity for human and agent commands
- no governance bypass through plugins or generated UI
- isolation between tenants and Workspaces
- fail-closed handling for unknown, ambiguous, or unsupported high-risk Actions

## Effective Explanation Contract

`EffectiveAutonomyControlsV1` is the API and audit shape for explaining a decision. It includes:

- `mode`: `policy-authoring`, `simulation`, `runtime`, or `audit`
- `target`: tenant, Workspace, role, queue, Run, and Action context
- `decision`: `Allow`, `RequireApproval`, or `Deny`
- `effectiveExecutionTier`
- `budgetLimits`
- `prohibited`
- `effectiveControls`
- `traces`
- `blockedWeakeningAttempts`
- `summary`

This is intentionally structured so Cockpit can display why a tier, budget, or prohibition applied;
the API can return the same details; policy authoring can preview a draft; simulation can compare
outcomes; and audit flows can reconstruct blocked or overridden weakening attempts.

## Exception and Anomaly Routing

Delegated autonomy must also define what happens after a Run or Action produces a non-routine
exception signal. Version 1 models those signals as typed anomaly triggers so the platform can
preserve calm operations without hiding risk.

### Exception classes

`AutonomyExceptionClassV1` is the canonical taxonomy for delegated-autonomy exceptions:

- `policy-violation`
- `evidence-gap`
- `anomaly-signal`
- `execution-failure`
- `capability-drift`
- `budget-threshold`
- `approval-fatigue`
- `stale-or-degraded-state`
- `unknown-risk`

Unknown or unmatched exception classes fail closed to alert routing for platform-admin review.

### Routing targets

Exception routing targets are typed and must remain domain concepts:

- `weekly-autonomy-digest`
- `work-item`
- `workforce-queue`
- `workspace-user`
- `approval-gate`
- `policy-owner-review`
- `audit-review`
- `platform-admin`

Calm handling may route only to `weekly-autonomy-digest`, `work-item`, or `audit-review`.
Alert handling may route to live authority targets such as a Workforce Queue, Workspace User,
Approval Gate, policy owner review, or platform admin review.

### Calm versus alert handling

Routing rules choose `calm` or `alert` handling:

- `calm` records the Evidence Log expectation and creates reviewable context without interrupting
  live work.
- `alert` interrupts a specific authority target and must carry an evidence packet expectation and
  explicit next-step options.

Critical alert routes must not be suppressed unless a rule explicitly sets `suppressAlerts: true`.
Alert routes cannot enable batching.

### Suppression, deduplication, and batching order

Routing is deterministic:

1. Select the most specific matching rule by exception class, severity, Action class scope, and
   optional Execution Tier filter.
2. Assess the evidence packet against the rule's required expectations.
3. Apply suppression if enabled and a matching fingerprint exists inside the suppression window.
   Suppression prevents repeated operator notification, not Evidence Log recording.
4. Apply deduplication if enabled and an unresolved matching route exists inside the deduplication
   window. Deduplication must not create a second Approval Gate, Work Item, queue item, or alert.
5. Apply batching only for calm routes. Batching groups repeated low-noise signals until the batch
   reaches `maxBatchSize` or `flushAfterMinutes`, then emits one calm route.
6. Otherwise emit `route-calm` or `route-alert`.

### Evidence packet expectations

Each routing rule declares `evidenceExpectations`. A trigger carries an
`AutonomyExceptionEvidencePacketV1` with:

- packet ID
- assembly timestamp
- Evidence IDs included in the packet
- consulted Evidence IDs
- missing evidence signals

If required evidence is missing, the routing decision must mark evidence as `missing-required` and
prepend `request-more-evidence` and `escalate` to the available next-step options.

### Next-step options

Routing decisions expose typed next-step options so operator surfaces do not infer authority from
free text:

- `observe`
- `annotate`
- `acknowledge-digest`
- `open-work-item`
- `request-more-evidence`
- `pause-run`
- `reroute`
- `escalate`
- `freeze`
- `emergency-disable`
- `draft-policy-change`

## Traceability

- [Operator Interaction Model v1](./operator-interaction-model-v1.md)
- [Policy Change Workflow v1](./policy-change-workflow-v1.md)
- [Agent Action Governance Lifecycle v1](./agent-action-governance-lifecycle-v1.md)
- Implementation: `src/domain/policy/delegated-autonomy-hierarchy-v1.ts`
- Exception routing implementation:
  `src/domain/policy/delegated-autonomy-exceptions-v1.ts`

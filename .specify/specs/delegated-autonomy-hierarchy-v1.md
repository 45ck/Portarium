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

## Traceability

- [Operator Interaction Model v1](./operator-interaction-model-v1.md)
- [Policy Change Workflow v1](./policy-change-workflow-v1.md)
- [Agent Action Governance Lifecycle v1](./agent-action-governance-lifecycle-v1.md)
- Implementation: `src/domain/policy/delegated-autonomy-hierarchy-v1.ts`

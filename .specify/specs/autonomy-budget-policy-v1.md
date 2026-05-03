# Autonomy Budget Policy v1

## Purpose

Autonomy budgets are first-class Policy inputs that cap autonomous work before a
Workspace or Run can spend freely, loop indefinitely, or keep requesting human
approval after the operator-reviewed envelope has been exhausted.

## Policy Inputs

`PolicyV1.autonomyBudgets?` is an optional array of `AutonomyBudgetV1` entries.

Fields:

- `budgetId`: stable non-empty identifier for audit and operator display.
- `scope`: `Workspace` or `Run`.
- `metric`: `ModelSpendCents`, `ToolCalls`, `OutboundActions`, or `ApprovalRequests`.
- `warningAt`: integer soft threshold, `>= 0`.
- `hardStopAt`: integer hard threshold, `>= 1`.
- `hardStopMode`: `FreezeRun`, `FreezeWorkspace`, `KillRun`, or `KillWorkspaceAutomation`.
- `rationale`: non-empty operator-visible rationale.

`warningAt` MUST be lower than `hardStopAt`.

## Evaluation Context

The budget evaluator receives an `AutonomyBudgetEvaluationContextV1`:

- `workspaceId`: branded `WorkspaceId`.
- `runId?`: branded `RunId` for Run-scoped evaluation.
- `evaluatedAtIso`: ISO timestamp for the immutable evaluation point.
- `usage`: observed and pending usage per scope and metric.
- `workspaceFrozen?`, `runFrozen?`: explicit freeze controls.
- `workspaceKillSwitch?`, `runKillSwitch?`: explicit kill-switch controls.
- `runawayDetected?`, `runawayRationale?`: deterministic stop-loss control for runaway behaviour.

Usage is evaluated as `used + pending`, so preflight checks stop the action that
would cross a hard threshold.

## Outcomes

Evaluation returns `Allow`, `Warn`, or `HardStop`.

- `Allow`: no threshold or control fired.
- `Warn`: at least one warning threshold fired, but no hard stop fired.
- `HardStop`: a hard threshold, freeze, kill-switch, or runaway stop fired.

Hard-stop precedence is deterministic:

1. Workspace kill-switch
2. Run kill-switch
3. Runaway hard stop
4. Workspace freeze
5. Run freeze
6. Budget hard stop
7. Budget warning

When a hard stop is present, policy evaluation maps the result to `Deny`. Warning
results remain evidence-only and do not block by themselves.

## Evidence And Operator Rationale

Every evaluation emits `AutonomyBudgetEvidenceV1` with:

- category `Policy`
- decision
- stop class: `none`, `budget`, `policy-control`, or `runaway`
- evaluated policy IDs
- trigger kinds
- operator-visible rationale
- evaluation timestamp

This evidence lets operators distinguish budget and policy-control stops from
infrastructure failures.

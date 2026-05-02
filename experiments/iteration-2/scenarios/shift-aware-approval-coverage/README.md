# Shift-Aware Approval Coverage

Owner Bead: `bead-1069`

Status: runnable deterministic coverage experiment.

## Scenario

A governed Run creates pending approvals when the primary operator is outside
their active window. Coverage rules move eligible approvals to the after-hours
delegate, preserve a waiting approval across the day-to-night shift boundary,
reject an ineligible delegated approver under Separation of Duties, and escalate
one approval after the coverage window closes without a decision.

## Required Evidence

- assignment changes, delegation window open/close events, and escalations are
  recorded in `assignment-evidence.json`
- no pending approval remains silently stalled after the primary operator is
  unavailable
- SoD and eligibility checks still apply to delegated or handed-off approvals
- `report.md` compares after-hours coverage against
  `micro-saas-agent-stack-v2`, the existing operator-team handoff experiment

## Run

```bash
node experiments/iteration-2/scenarios/shift-aware-approval-coverage/run.mjs
```

The script writes `outcome.json`, `queue-metrics.json`,
`evidence-summary.json`, `assignment-evidence.json`, and `report.md` under this
scenario's `results/` directory. CI runs the same experiment with a temporary
result directory through
`scripts/integration/scenario-shift-aware-approval-coverage.test.ts`.

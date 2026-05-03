# shift-aware-approval-coverage deterministic-shift-coverage-v1

Generated: 2026-04-30T23:50:10.000Z

## Metric Artifacts

- `queue-metrics.json`
- `evidence-summary.json`

## Evidence Completeness

Present: 5
Missing: 0

## After-Hours Coverage Comparison

Baseline: `micro-saas-agent-stack-v2` records operator-team handoff while both operators are reachable.
This scenario adds inactive primary operators, bounded delegation windows, missed-window escalation, and eligibility rejection before assignment.

| Behavior | operator-team handoff | shift-aware coverage |
| --- | --- | --- |
| Assignment model | role split between Operator A and Operator B | primary assignee, delegate, and on-call lead |
| Escalations | 0 | 1 |
| Evidence events | queue snapshots only | 17 assignment, delegation, eligibility, escalation, decision, and resume events |
| Stall handling | unrelated approvals continue after denial/request-changes | pending work reroutes or escalates after coverage closes |

## Shift-Aware Metrics

Successful resumes: 4
Escalations: 1
Evidence events recorded: 17

# Micro SaaS Agent Stack v2

Owner Bead: `bead-1043`

Status: runnable deterministic handoff.

## Scenario

One governed micro-SaaS Run creates multiple pending approvals. Operator A
handles low-risk draft approvals. Operator B handles higher-risk publish or send
decisions. At least one item is denied or marked request-changes while unrelated
queued work continues.

## Required Evidence

- Separation of Duties is preserved for approvals that require different people
- one denied or stalled approval does not corrupt unrelated queued work
- queue metrics show approver identity, wait time, and handoff timing
- result artifacts include queue-state snapshots before and after operator
  decisions
- report compares this result to the original micro-SaaS agent stack run

## Run

```bash
node experiments/iteration-2/scenarios/micro-saas-agent-stack-v2/run.mjs
```

The script writes `outcome.json`, `queue-metrics.json`,
`evidence-summary.json`, and `report.md` under this scenario's `results/`
directory. CI runs the same experiment with a temporary result directory through
`scripts/integration/scenario-micro-saas-agent-stack-v2.test.ts`.

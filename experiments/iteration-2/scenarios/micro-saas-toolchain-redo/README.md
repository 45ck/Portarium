# Micro SaaS Toolchain Redo

Owner Bead: `bead-1046`

Status: runnable deterministic toolchain realism check.

## Scenario

This reruns the micro-SaaS flow with Portarium as the governor while treating
Machines as first-class evidence sources. `content-machine` is required and must
pass preflight before any workflow simulation continues. `demo-machine` is used
when runnable, or the run records an explicit skip or failure reason for the
post-validation demo path.

External publish and send Actions stay stubbed. The run never calls real
publisher or email endpoints.

## Required Evidence

- required `content-machine` preflight fails early and clearly when unavailable
- tool usage evidence records runnable Machine probes instead of inferring usage
  from generated outputs only
- `demo-machine` is either runnable or explicitly skipped with a reason
- publish and send effects are represented only by stub receipts
- the report states whether the post-validation demo path is proven or unproven

## Run

```bash
node experiments/iteration-2/scenarios/micro-saas-toolchain-redo/run.mjs
```

The script writes `outcome.json`, `queue-metrics.json`,
`evidence-summary.json`, `report.md`, `toolchain-preflight.json`,
`tool-usage-evidence.json`, `content-machine-output.json`, and
`external-effect-stubs.json` under this scenario's `results/` directory.

The report fixture at `fixtures/report.md` shows the required report sections
without depending on local workstation tool availability.

# Governed Resume Recovery

Bead: `bead-1059`

This deterministic scenario proves that a governed Run can wait on an Approval Gate through realistic interruptions, recover operator-visible state, and resume exactly once after approval.

## Variants

- `process-crash`: agent process disappears while the Approval Gate is pending.
- `service-restart`: control-plane service restarts before the operator decides.
- `deploy-restart`: rolling deploy interrupts the waiting Run.
- `provider-outage`: external provider remains unavailable, so resume is deferred and classified as an environment limitation.

## Acceptance Mapping

- Approval, Plan, Run, and Evidence Artifact state survive the interruption.
- Cockpit recovery posture remains visible through waiting, degraded, or blocked control state.
- Approved variants resume exactly once and do not replay prior writes.
- Product defects are reported separately from host or environment limitations.

## Run

```bash
node experiments/iteration-2/scenarios/governed-resume-recovery/run.mjs
```

The runner writes append-only result artifacts under `experiments/iteration-2/results/governed-resume-recovery/<attempt-id>/` when called by automation with a unique result directory.

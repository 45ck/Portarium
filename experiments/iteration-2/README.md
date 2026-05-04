# Iteration 2 Governed Experiment Suite

Bead: `bead-1040`

This directory defines the second governed experiment wave. It is a suite
contract, not a completed result bundle. The dependent Beads create the runnable
experiments and live result bundles.

## Purpose

Iteration 1 proved the basic Portarium/OpenClaw governance loop in focused
experiments. Iteration 2 tests the behavior that matters when an operator leaves
agents running and returns later to review decisions:

- long-pending approvals and exact resume
- team handoff and out-of-order decisions
- shift-aware approval coverage, delegation windows, and after-hours escalation
- multiple simultaneous governed sessions
- approval backlog, escalation, and expiry pressure
- stronger content-machine and demo-machine realism where those tools are
  available

## Suite Contract

The suite is defined by `suite.manifest.json`. Every Iteration 2 experiment must:

- keep Iteration 1 directories and reports immutable
- write new attempts under an attempt-specific result directory
- record queue, timing, resume, and evidence completeness metrics
- compare results with the prior experiment or baseline named in the manifest
- mark live LLM/provider runs as skipped or inconclusive when the preflight is
  not ready

The shared telemetry helper lives at
`experiments/shared/iteration2-telemetry.js`. Runners should create one collector
per attempt, record approval/queue/resume/evidence events during the scenario,
and call `writeArtifacts()` before returning the final outcome.

## Scenario Directories

The directories under `scenarios/` are placeholders for planned scenario
contracts. They intentionally do not include runnable `run.mjs` files yet; those
belong to the dependent implementation Beads.

| Scenario                         | Owner Bead  | Status                 |
| -------------------------------- | ----------- | ---------------------- |
| `growth-studio-openclaw-live-v2` | `bead-1042` | Runnable deterministic |
| `micro-saas-agent-stack-v2`      | `bead-1043` | Runnable deterministic |
| `openclaw-concurrent-sessions`   | `bead-1044` | Runnable deterministic |
| `approval-backlog-soak`          | `bead-1045` | Runnable deterministic |
| `governed-resume-recovery`       | `bead-1059` | Runnable deterministic |
| `shift-aware-approval-coverage`  | `bead-1069` | Runnable deterministic |
| `execution-reservation-recovery` | `bead-1142` | Runnable deterministic |

## Result Layout

Use this pattern for any live, replay, or rerun attempt:

```text
experiments/iteration-2/results/
  <scenario-id>/
    <attempt-id>/
      outcome.json
      evidence-summary.json
      queue-metrics.json
      report.md
```

`attempt-id` should be stable and sortable, for example
`20260429T113000Z-live-wait`. Do not overwrite a previous attempt. If a run must
be repeated, create a new attempt directory and compare it with the earlier one.

## Closure Notes

The suite scaffold and telemetry helper close the planning and shared metrics
work. The concrete deterministic experiments and reports are owned by their
scenario Beads, and the original Growth Studio showcase epic is closed by
`docs/internal/review/bead-0999-growth-studio-epic-closure.md`.

Live provider-backed reruns remain opt-in evidence. They must use the explicit
live OpenClaw and live model gates, preserve prior attempt directories, and
write redacted provider metadata into a new attempt bundle.

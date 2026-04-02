# Growth Studio OpenClaw Live Report

## Latest Run

- Date: `2026-04-02`
- Outcome: `confirmed`
- Runtime: live OpenClaw local agent + live OpenRouter inference + Portarium dev control plane
- Credential source: process environment for the run, sourced from the sibling `VibeCoord` workspace

## Confirmed

- The runner created an isolated OpenClaw profile under `results/runtime/`.
- The Portarium control plane started successfully in dev stub mode on a free local port.
- `openclaw plugins doctor` passed with `No plugin issues detected.`
- The Portarium governance plugin registered successfully for workspace
  `ws-growth-studio-live`.
- The live agent issued governed `read` and `write` tool calls through the Portarium plugin.
- The auto-operator approved every pending write mutation during the run.
- The final run captured:
  - `15` approvals, all in `Approved` status
  - `42` evidence records at `/v1/workspaces/ws-growth-studio-live/evidence`
  - `5` generated Growth Studio deliverables under `results/runtime/workspace/outputs/`

## Output Bundle

- `research-summary.md`
- `outreach-plan.json`
- `email-draft.md`
- `execution-queue.json`
- `metrics-baseline.json`

All five artifacts were written successfully and grounded in the supplied fixtures for
`Northstar Pipeline` / `Jordan Ellis`.

## Runtime Notes

- The control plane used the local stub action runner because `OPENCLAW_GATEWAY_BASE_URL`
  was not configured in this experiment environment.
- That means no external execution plane dispatch occurred.
- This did not invalidate the experiment because the task explicitly staged execution as a queued
  outreach artifact rather than sending anything live.

## Defect Found And Fixed During The Experiment

The first successful live behavior run exposed a control-plane visibility gap:

- proposal and approval evidence were being written internally
- the runtime `/evidence` endpoint only exposed the presentation-layer human-task cache
- approval-decision handling was not passing `evidenceLog` into `submitApproval`

This branch now mirrors appended evidence into the runtime evidence view and forwards
`evidenceLog` through approval decisions, which is why the latest rerun captured `42`
evidence records instead of `0`.

## Result Artifacts

The raw local artifacts for the confirmed run are captured under `results/`:

- `run-context.json`
- `plugin-doctor.log`
- `control-plane.log`
- `agent.stdout.log`
- `agent.stderr.log`
- `approvals.json`
- `evidence.json`
- `outputs.snapshot.json`
- `outcome.json`

## Interpretation

The experiment now demonstrates the intended governed Growth Studio path:

- live model inference happened through OpenRouter
- governed filesystem reads were allowed
- governed filesystem writes paused for human approval
- approvals were auto-decided by a separate operator identity
- evidence accumulated on the control plane
- the local output bundle was produced deterministically in the experiment workspace

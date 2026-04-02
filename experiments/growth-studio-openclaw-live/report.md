# Growth Studio OpenClaw Live Report

## Latest Run

- Date: `2026-04-02`
- Outcome: `confirmed`
- Runtime: live OpenClaw local agent + live OpenRouter inference + Portarium dev control plane
- Credential source: process environment for the run, sourced from the sibling `VibeCoord` workspace
- OpenClaw version: `2026.2.12`
- Official references pinned in repo:
  - `https://openclaw.ai/`
  - `https://github.com/openclaw/openclaw`

## Confirmed

- The runner created an isolated OpenClaw profile under `results/runtime/`.
- The runner isolated `HOME` / `USERPROFILE` into `results/runtime/home/` to avoid host-profile
  drift.
- The tracked OpenClaw config template lives at `repro/openclaw.template.json` in Git.
- The template uses `plugins.entries.portarium.config`, matching the plugin's exported OpenClaw id.
- `openclaw --version` was captured in the run context.
- `openclaw doctor` and `openclaw plugins doctor` were captured as experiment artifacts.
- The Portarium control plane started successfully in dev stub mode on a free local port.
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
- After isolating the OpenClaw home/state directories, the remaining `openclaw doctor` warning is a
  plugin path-hint mismatch: the plugin package directory is still named `openclaw-plugin` while
  the committed manifest/config id is `portarium`.
- That warning is captured in `openclaw-doctor.log` and `plugin-doctor.log`; it does not block the
  live run or the plugin registration path.

## Defect Found And Fixed During The Experiment

The first successful live behavior run exposed a control-plane visibility gap:

- proposal and approval evidence were being written internally
- the runtime `/evidence` endpoint only exposed the presentation-layer human-task cache
- approval-decision handling was not passing `evidenceLog` into `submitApproval`

This branch now mirrors appended evidence into the runtime evidence view and forwards
`evidenceLog` through approval decisions, which is why the latest rerun captured `42`
evidence records instead of `0`.

This branch also aligns the tracked experiment config with the plugin's OpenClaw manifest id
(`portarium`) so the committed template matches the plugin's runtime identity.

## Result Artifacts

The raw local artifacts for the confirmed run are captured under `results/`:

- `run-context.json`
- `timeline.ndjson`
- `openclaw-doctor.log`
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
- the OpenClaw lifecycle was captured as an ordered `timeline.ndjson` trace
- the local output bundle was produced deterministically in the experiment workspace

# Reproducible OpenClaw Setup

This experiment is pinned to the official OpenClaw project:

- Website: `https://openclaw.ai/`
- Repository: `https://github.com/openclaw/openclaw`

The tracked configuration source for this experiment is
`experiments/growth-studio-openclaw-live/repro/openclaw.template.json`.
That template configures the plugin under `plugins.entries.portarium.config`.

## What Is Reproducible In Git

- The committed OpenClaw config template
- The Portarium plugin config embedded in that template
- The Growth Studio fixture inputs
- The experiment prompt/control files written into the isolated workspace
- The runner logic that renders the config and executes the run

The runtime config itself is rendered to `results/runtime/openclaw.json` during a run so the
effective config remains inspectable after execution.
The runner also isolates `HOME` / `USERPROFILE` into `results/runtime/home/` so the experiment does
not rely on a pre-existing host OpenClaw profile.

## Prerequisites

1. Install the official `openclaw` CLI from the OpenClaw project.
2. Ensure `openclaw --version` works on the host.
3. Provide an `OPENROUTER_API_KEY`.

## Reproduction Command

From the repository root:

```bash
node node_modules/tsx/dist/cli.mjs experiments/growth-studio-openclaw-live/run.mjs
```

Or via the package script:

```bash
npm run experiment:growth-studio:live
```

## Validation Steps

The experiment will:

1. Render the tracked template into an isolated `openclaw.json`.
2. Run `openclaw --version`.
3. Run `openclaw plugins doctor`.
4. Run `openclaw doctor`.
5. Launch `openclaw agent --local`.
6. Record a chronological `timeline.ndjson` covering runner events, Portarium events, OpenClaw
   output, approvals, evidence snapshots, and output file writes.
